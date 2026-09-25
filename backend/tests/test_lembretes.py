"""Testes da materialização de lembretes.

O ponto central é a idempotência: /api/lembretes/pendentes é chamada a
cada minuto pelo navegador e chama materializar() toda vez. Se a
operação não for idempotente, o usuário recebe o mesmo aviso repetido.
"""

from datetime import date, datetime, timedelta

import pytest

from database import db
from models import Compromisso, IgrejaEscala, IgrejaEvento, Lembrete, Tarefa
from services.lembretes import apagar_da_origem, materializar, pendentes

AGORA = datetime(2026, 9, 24, 12, 0)


def criar_compromisso(**kwargs):
    padrao = {
        "titulo": "Reunião do grupo",
        "inicio": AGORA + timedelta(days=2),
        "recorrencia": "nenhuma",
        "lembrete_min": 60,
    }
    compromisso = Compromisso(**{**padrao, **kwargs})
    db.session.add(compromisso)
    db.session.commit()
    return compromisso


# ─────────────────────── idempotência ───────────────────────


def test_materializar_duas_vezes_nao_duplica(contexto):
    criar_compromisso()

    primeira = materializar(agora=AGORA)
    segunda = materializar(agora=AGORA)
    terceira = materializar(agora=AGORA)

    assert primeira == 1
    assert segunda == 0
    assert terceira == 0
    assert Lembrete.query.count() == 1


def test_materializar_muitas_vezes_com_varias_origens(contexto):
    """Simula o polling de um minuto rodando várias vezes seguidas."""
    criar_compromisso()
    db.session.add(
        IgrejaEscala(
            data=(AGORA + timedelta(days=3)).date(),
            horario=datetime(2026, 1, 1, 10, 0).time(),
            celebracao="Missa Dominical",
            funcao="Turiferário",
        )
    )
    db.session.add(
        IgrejaEvento(titulo="Retiro", data_hora=AGORA + timedelta(days=5), lembrete_min=1440)
    )
    db.session.add(
        Tarefa(titulo="Entregar o relatório", prazo=(AGORA + timedelta(days=4)).date())
    )
    db.session.commit()

    criados = materializar(agora=AGORA)
    assert criados == 4

    for _ in range(5):
        assert materializar(agora=AGORA) == 0
    assert Lembrete.query.count() == 4


# ─────────────────────── recorrência ───────────────────────


def test_compromisso_semanal_gera_um_lembrete_por_ocorrencia(contexto):
    criar_compromisso(
        inicio=AGORA + timedelta(days=1),
        recorrencia="semanal",
        recorrencia_fim=(AGORA + timedelta(days=22)).date(),
    )

    assert materializar(agora=AGORA) == 4
    assert materializar(agora=AGORA) == 0

    horarios = sorted(l.disparar_em for l in Lembrete.query.all())
    # Uma semana entre cada lembrete, todos 60 min antes do compromisso.
    for anterior, seguinte in zip(horarios, horarios[1:]):
        assert seguinte - anterior == timedelta(days=7)
    assert horarios[0] == AGORA + timedelta(days=1) - timedelta(minutes=60)


def test_ocorrencia_cancelada_nao_gera_lembrete(contexto):
    from models import CompromissoExcecao

    compromisso = criar_compromisso(
        inicio=AGORA + timedelta(days=1),
        recorrencia="semanal",
        recorrencia_fim=(AGORA + timedelta(days=22)).date(),
    )
    db.session.add(
        CompromissoExcecao(
            compromisso_id=compromisso.id,
            data_original=(AGORA + timedelta(days=8)).date(),
            cancelada=True,
        )
    )
    db.session.commit()

    assert materializar(agora=AGORA) == 3


# ─────────────────────── janela e carência ───────────────────────


def test_compromisso_sem_lembrete_configurado_e_ignorado(contexto):
    criar_compromisso(lembrete_min=None)
    assert materializar(agora=AGORA) == 0


def test_compromisso_alem_da_janela_nao_entra(contexto):
    criar_compromisso(inicio=AGORA + timedelta(days=90))
    assert materializar(agora=AGORA, janela_dias=30) == 0


def test_lembrete_muito_antigo_nao_e_criado(contexto):
    """Se o Ordo ficou dias fechado, não faz sentido avisar do que passou."""
    criar_compromisso(inicio=AGORA - timedelta(days=5))
    assert materializar(agora=AGORA) == 0


def test_lembrete_dentro_da_carencia_ainda_e_criado(contexto):
    """Fechou o Ordo por algumas horas: o aviso ainda vale."""
    criar_compromisso(inicio=AGORA - timedelta(hours=2), lembrete_min=60)
    assert materializar(agora=AGORA) == 1


# ─────────────────────── pendentes ───────────────────────


def test_pendentes_traz_so_o_que_ja_venceu(contexto):
    db.session.add_all(
        [
            Lembrete(titulo="Já venceu", disparar_em=AGORA - timedelta(minutes=5)),
            Lembrete(titulo="Ainda não", disparar_em=AGORA + timedelta(hours=3)),
        ]
    )
    db.session.commit()

    lista = pendentes(agora=AGORA)
    assert [l.titulo for l in lista] == ["Já venceu"]


def test_pendentes_ignora_o_que_ja_foi_enviado(contexto):
    db.session.add(
        Lembrete(
            titulo="Mostrado", disparar_em=AGORA - timedelta(minutes=5), enviado=True
        )
    )
    db.session.commit()
    assert pendentes(agora=AGORA) == []


def test_pendentes_vem_em_ordem_cronologica(contexto):
    db.session.add_all(
        [
            Lembrete(titulo="Segundo", disparar_em=AGORA - timedelta(minutes=5)),
            Lembrete(titulo="Primeiro", disparar_em=AGORA - timedelta(hours=2)),
        ]
    )
    db.session.commit()
    assert [l.titulo for l in pendentes(agora=AGORA)] == ["Primeiro", "Segundo"]


# ─────────────────────── limpeza ───────────────────────


def test_apagar_da_origem_remove_lembretes_orfaos(contexto):
    compromisso = criar_compromisso()
    materializar(agora=AGORA)
    assert Lembrete.query.count() == 1

    apagar_da_origem("compromisso", compromisso.id)
    db.session.commit()
    assert Lembrete.query.count() == 0


def test_titulo_da_escala_traz_a_funcao(contexto):
    db.session.add(
        IgrejaEscala(
            data=(AGORA + timedelta(days=3)).date(),
            horario=datetime(2026, 1, 1, 10, 0).time(),
            celebracao="Missa Dominical",
            funcao="Mestre de Cerimônias",
        )
    )
    db.session.commit()
    materializar(agora=AGORA)

    lembrete = Lembrete.query.filter_by(origem_tipo="escala").one()
    assert "Missa Dominical" in lembrete.titulo
    assert "Mestre de Cerimônias" in lembrete.titulo


def test_tarefa_concluida_nao_gera_lembrete(contexto):
    db.session.add(
        Tarefa(
            titulo="Já feita",
            prazo=(AGORA + timedelta(days=2)).date(),
            status="feito",
        )
    )
    db.session.commit()
    assert materializar(agora=AGORA) == 0
