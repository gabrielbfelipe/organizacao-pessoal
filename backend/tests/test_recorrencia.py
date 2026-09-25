"""Testes da expansão de compromissos recorrentes.

Tudo aqui roda sem banco: expandir() é pura e recebe objetos simples.
"""

from datetime import date, datetime, timedelta

import pytest

from services.recorrencia import _mesmo_dia_no_mes, expandir


class CompromissoFalso:
    """O mínimo que expandir() consome de um Compromisso."""

    def __init__(self, inicio, fim=None, recorrencia="nenhuma", recorrencia_fim=None):
        self.id = 1
        self.inicio = inicio
        self.fim = fim
        self.recorrencia = recorrencia
        self.recorrencia_fim = recorrencia_fim


class ExcecaoFalsa:
    def __init__(self, cancelada=False, novo_inicio=None, novo_fim=None):
        self.cancelada = cancelada
        self.novo_inicio = novo_inicio
        self.novo_fim = novo_fim


def datas(ocorrencias):
    return [o["data_original"] for o in ocorrencias]


# ─────────────────────── sem recorrência ───────────────────────


def test_compromisso_unico_dentro_da_janela():
    c = CompromissoFalso(datetime(2026, 9, 27, 10, 0))
    saida = expandir(c, date(2026, 9, 1), date(2026, 9, 30))
    assert datas(saida) == [date(2026, 9, 27)]
    assert saida[0]["inicio"] == datetime(2026, 9, 27, 10, 0)


def test_compromisso_unico_fora_da_janela():
    c = CompromissoFalso(datetime(2026, 9, 27, 10, 0))
    assert expandir(c, date(2026, 10, 1), date(2026, 10, 31)) == []
    assert expandir(c, date(2026, 8, 1), date(2026, 8, 31)) == []


def test_janela_nunca_gera_ocorrencia_antes_do_inicio_da_serie():
    """Consultar um mês anterior não pode inventar ocorrências passadas."""
    c = CompromissoFalso(datetime(2026, 9, 7, 19, 0), recorrencia="semanal")
    assert expandir(c, date(2026, 1, 1), date(2026, 8, 31)) == []


# ─────────────────────── diária e semanal ───────────────────────


def test_diaria_respeita_a_data_de_termino():
    c = CompromissoFalso(
        datetime(2026, 9, 1, 7, 0),
        recorrencia="diaria",
        recorrencia_fim=date(2026, 9, 5),
    )
    saida = expandir(c, date(2026, 9, 1), date(2026, 9, 30))
    assert datas(saida) == [date(2026, 9, d) for d in (1, 2, 3, 4, 5)]


def test_semanal_por_oito_semanas():
    c = CompromissoFalso(datetime(2026, 9, 7, 19, 0), recorrencia="semanal")
    saida = expandir(c, date(2026, 9, 1), date(2026, 9, 7) + timedelta(weeks=7))
    assert len(saida) == 8
    # Toda ocorrência cai na mesma segunda-feira e no mesmo horário.
    assert all(o["data_original"].weekday() == 0 for o in saida)
    assert all(o["inicio"].hour == 19 for o in saida)


def test_semanal_atravessa_a_virada_do_mes():
    c = CompromissoFalso(datetime(2026, 9, 21, 19, 0), recorrencia="semanal")
    saida = expandir(c, date(2026, 9, 1), date(2026, 10, 31))
    assert datas(saida) == [
        date(2026, 9, 21),
        date(2026, 9, 28),
        date(2026, 10, 5),
        date(2026, 10, 12),
        date(2026, 10, 19),
        date(2026, 10, 26),
    ]


def test_a_janela_recorta_a_serie_sem_deslocar_as_datas():
    """Pedir só outubro devolve as ocorrências de outubro, nas datas certas."""
    c = CompromissoFalso(datetime(2026, 9, 21, 19, 0), recorrencia="semanal")
    saida = expandir(c, date(2026, 10, 1), date(2026, 10, 31))
    assert datas(saida) == [date(2026, 10, d) for d in (5, 12, 19, 26)]


# ─────────────────────── mensal ───────────────────────


def test_mensal_mantem_o_dia_do_mes():
    c = CompromissoFalso(datetime(2026, 1, 15, 9, 0), recorrencia="mensal")
    saida = expandir(c, date(2026, 1, 1), date(2026, 6, 30))
    assert datas(saida) == [date(2026, m, 15) for m in range(1, 7)]


def test_mensal_no_dia_31_pula_os_meses_curtos():
    """Um compromisso no dia 31 não existe em fevereiro, abril, junho...

    A alternativa seria escorregar para o dia 1º do mês seguinte, o que
    mudaria silenciosamente o compromisso de mês.
    """
    c = CompromissoFalso(datetime(2026, 1, 31, 9, 0), recorrencia="mensal")
    saida = expandir(c, date(2026, 1, 1), date(2026, 12, 31))
    assert datas(saida) == [
        date(2026, m, 31) for m in (1, 3, 5, 7, 8, 10, 12)
    ]


def test_mensal_no_dia_29_em_ano_bissexto():
    c = CompromissoFalso(datetime(2028, 1, 29, 9, 0), recorrencia="mensal")
    saida = expandir(c, date(2028, 1, 1), date(2028, 3, 31))
    # 2028 é bissexto, então 29 de fevereiro existe.
    assert datas(saida) == [date(2028, 1, 29), date(2028, 2, 29), date(2028, 3, 29)]


def test_mensal_no_dia_29_em_ano_comum_pula_fevereiro():
    c = CompromissoFalso(datetime(2026, 1, 29, 9, 0), recorrencia="mensal")
    saida = expandir(c, date(2026, 1, 1), date(2026, 3, 31))
    assert datas(saida) == [date(2026, 1, 29), date(2026, 3, 29)]


def test_mensal_atravessa_a_virada_do_ano():
    c = CompromissoFalso(datetime(2026, 11, 10, 9, 0), recorrencia="mensal")
    saida = expandir(c, date(2026, 11, 1), date(2027, 2, 28))
    assert datas(saida) == [
        date(2026, 11, 10),
        date(2026, 12, 10),
        date(2027, 1, 10),
        date(2027, 2, 10),
    ]


@pytest.mark.parametrize(
    "dia,meses_adiante,esperado",
    [
        (date(2026, 1, 31), 1, None),           # fevereiro não tem 31
        (date(2026, 1, 31), 2, date(2026, 3, 31)),
        (date(2026, 12, 5), 1, date(2027, 1, 5)),  # vira o ano
        (date(2026, 12, 5), 13, date(2028, 1, 5)),
    ],
)
def test_mesmo_dia_no_mes(dia, meses_adiante, esperado):
    assert _mesmo_dia_no_mes(dia, meses_adiante) == esperado


# ─────────────────────── duração ───────────────────────


def test_a_duracao_e_preservada_em_todas_as_ocorrencias():
    c = CompromissoFalso(
        datetime(2026, 9, 7, 19, 0),
        fim=datetime(2026, 9, 7, 20, 30),
        recorrencia="semanal",
    )
    saida = expandir(c, date(2026, 9, 1), date(2026, 9, 30))
    assert all(o["fim"] - o["inicio"] == timedelta(minutes=90) for o in saida)


def test_compromisso_sem_fim_gera_ocorrencias_sem_fim():
    c = CompromissoFalso(datetime(2026, 9, 7, 19, 0), recorrencia="semanal")
    saida = expandir(c, date(2026, 9, 1), date(2026, 9, 30))
    assert all(o["fim"] is None for o in saida)


# ─────────────────────── exceções ───────────────────────


def test_cancelar_uma_ocorrencia_nao_afeta_as_outras():
    c = CompromissoFalso(datetime(2026, 9, 7, 19, 0), recorrencia="semanal")
    excecoes = {date(2026, 9, 21): ExcecaoFalsa(cancelada=True)}

    saida = expandir(c, date(2026, 9, 1), date(2026, 9, 30), excecoes)
    assert datas(saida) == [date(2026, 9, 7), date(2026, 9, 14), date(2026, 9, 28)]


def test_remarcar_uma_ocorrencia_move_so_aquele_dia():
    c = CompromissoFalso(
        datetime(2026, 9, 7, 19, 0),
        fim=datetime(2026, 9, 7, 20, 0),
        recorrencia="semanal",
    )
    excecoes = {
        date(2026, 9, 14): ExcecaoFalsa(novo_inicio=datetime(2026, 9, 15, 20, 0))
    }

    saida = expandir(c, date(2026, 9, 1), date(2026, 9, 30), excecoes)
    remarcada = next(o for o in saida if o["data_original"] == date(2026, 9, 14))

    assert remarcada["inicio"] == datetime(2026, 9, 15, 20, 0)
    assert remarcada["remarcada"] is True
    # A duração original é mantida quando o novo fim não é informado.
    assert remarcada["fim"] == datetime(2026, 9, 15, 21, 0)
    # As demais continuam intactas.
    assert next(o for o in saida if o["data_original"] == date(2026, 9, 7))[
        "inicio"
    ] == datetime(2026, 9, 7, 19, 0)


def test_excecao_que_move_a_ocorrencia_para_fora_da_janela():
    c = CompromissoFalso(datetime(2026, 9, 7, 19, 0), recorrencia="semanal")
    excecoes = {
        date(2026, 9, 14): ExcecaoFalsa(novo_inicio=datetime(2026, 12, 1, 19, 0))
    }

    saida = expandir(c, date(2026, 9, 1), date(2026, 9, 30), excecoes)
    assert date(2026, 9, 14) not in datas(saida)
    assert len(saida) == 3


def test_excecao_em_data_que_nao_e_ocorrencia_e_ignorada():
    c = CompromissoFalso(datetime(2026, 9, 7, 19, 0), recorrencia="semanal")
    excecoes = {date(2026, 9, 9): ExcecaoFalsa(cancelada=True)}
    saida = expandir(c, date(2026, 9, 1), date(2026, 9, 30), excecoes)
    assert len(saida) == 4


# ─────────────────────── limites ───────────────────────


def test_recorrencia_desconhecida_nao_gera_nada():
    c = CompromissoFalso(datetime(2026, 9, 7, 19, 0), recorrencia="anual")
    assert expandir(c, date(2026, 1, 1), date(2026, 12, 31)) == []


def test_janela_de_um_unico_dia():
    c = CompromissoFalso(datetime(2026, 9, 1, 7, 0), recorrencia="diaria")
    saida = expandir(c, date(2026, 9, 15), date(2026, 9, 15))
    assert datas(saida) == [date(2026, 9, 15)]


def test_serie_diaria_longa_nao_estoura():
    """Dois anos de uma série diária: limitada, e sem laço infinito."""
    c = CompromissoFalso(datetime(2026, 1, 1, 7, 0), recorrencia="diaria")
    saida = expandir(c, date(2026, 1, 1), date(2027, 12, 31))
    assert len(saida) == 730
