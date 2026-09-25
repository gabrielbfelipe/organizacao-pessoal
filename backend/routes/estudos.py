"""Disciplinas, sessões de estudo (Pomodoro), metas e flashcards.

As disciplinas são a espinha do módulo: simulados, anotações, materiais,
sessões, metas e flashcards se penduram nelas.
"""

from datetime import date, datetime, time, timedelta

from flask import Blueprint, request
from flask_login import login_required

import constants
from database import db
from models import Disciplina, Flashcard, Meta, SessaoEstudo
from services.srs import agendar_nova, revisar
from utils.respostas import criado, erro, ok
from utils.validacao import Validador

bp_disciplinas = Blueprint("disciplinas", __name__)
bp_sessoes = Blueprint("sessoes", __name__)
bp_metas = Blueprint("metas", __name__)
bp_flashcards = Blueprint("flashcards", __name__)


def _inicio_da_semana(dia):
    """Segunda-feira da semana de `dia` — a semana ISO."""
    return dia - timedelta(days=dia.weekday())


def _janela_do_periodo(periodo, hoje):
    """(inicio, fim) do período corrente: semana ISO ou mês do calendário."""
    if periodo == "mensal":
        inicio = hoje.replace(day=1)
        proximo = (inicio + timedelta(days=32)).replace(day=1)
        return inicio, proximo - timedelta(days=1)
    inicio = _inicio_da_semana(hoje)
    return inicio, inicio + timedelta(days=6)


def _horas_no_periodo(disciplina_id, inicio, fim):
    minutos = (
        db.session.query(db.func.sum(SessaoEstudo.duracao_min))
        .filter(
            SessaoEstudo.disciplina_id == disciplina_id,
            SessaoEstudo.inicio >= datetime.combine(inicio, time.min),
            SessaoEstudo.inicio <= datetime.combine(fim, time.max),
        )
        .scalar()
    )
    # O SUM do MySQL volta como Decimal, que não opera com float.
    # Converter aqui evita o erro espalhado por quem consome o valor.
    return round(float(minutos or 0) / 60, 2)


# ═══════════════════════ disciplinas ═══════════════════════


@bp_disciplinas.get("")
@login_required
def listar_disciplinas():
    disciplinas = Disciplina.query.order_by(Disciplina.nome).all()
    return ok([d.to_dict() for d in disciplinas])


@bp_disciplinas.post("")
@login_required
def criar_disciplina():
    v = Validador(request.get_json(silent=True))
    campos = {
        "nome": v.texto("nome", obrigatorio=True, max_len=100),
        "cor": v.cor("cor", default="#1B2A41"),
    }
    v.finalizar()

    disciplina = Disciplina(**campos)
    db.session.add(disciplina)
    db.session.commit()
    return criado(disciplina.to_dict())


@bp_disciplinas.put("/<int:id>")
@login_required
def atualizar_disciplina(id):
    disciplina = db.session.get(Disciplina, id)
    if not disciplina:
        return erro("Disciplina não encontrada.", 404)

    v = Validador(request.get_json(silent=True))
    nome = v.texto("nome", max_len=100)
    cor = v.cor("cor")
    v.finalizar()

    if nome:
        disciplina.nome = nome
    if cor:
        disciplina.cor = cor

    db.session.commit()
    return ok(disciplina.to_dict())


@bp_disciplinas.delete("/<int:id>")
@login_required
def apagar_disciplina(id):
    disciplina = db.session.get(Disciplina, id)
    if not disciplina:
        return erro("Disciplina não encontrada.", 404)

    # Flashcards e metas caem junto (CASCADE); questões, anotações,
    # materiais e sessões apenas perdem o vínculo (SET NULL).
    cartas = Flashcard.query.filter_by(disciplina_id=id).count()
    metas = Meta.query.filter_by(disciplina_id=id).count()

    db.session.delete(disciplina)
    db.session.commit()
    return ok({"flashcards_removidos": cartas, "metas_removidas": metas})


# ═══════════════════════ sessões de estudo ═══════════════════════


@bp_sessoes.get("")
@login_required
def listar_sessoes():
    """Filtros: ?disciplina_id= ?inicio= ?fim=. Sem datas, últimos 30 dias."""
    hoje = date.today()

    def ler_data(nome, padrao):
        bruto = request.args.get(nome)
        if not bruto:
            return padrao
        try:
            return date.fromisoformat(bruto)
        except ValueError:
            return None

    inicio = ler_data("inicio", hoje - timedelta(days=30))
    fim = ler_data("fim", hoje)
    if inicio is None or fim is None:
        return erro("Use o formato AAAA-MM-DD em inicio e fim.", 400)

    query = SessaoEstudo.query.filter(
        SessaoEstudo.inicio >= datetime.combine(inicio, time.min),
        SessaoEstudo.inicio <= datetime.combine(fim, time.max),
    )

    disciplina_id = request.args.get("disciplina_id", type=int)
    if disciplina_id:
        query = query.filter(SessaoEstudo.disciplina_id == disciplina_id)

    sessoes = query.order_by(SessaoEstudo.inicio.desc()).all()
    return ok([s.to_dict() for s in sessoes])


@bp_sessoes.get("/resumo")
@login_required
def resumo_sessoes():
    """Horas por disciplina e por dia, para os contadores e gráficos."""
    hoje = date.today()
    inicio_semana = _inicio_da_semana(hoje)

    por_disciplina = (
        db.session.query(
            SessaoEstudo.disciplina_id,
            db.func.sum(SessaoEstudo.duracao_min),
        )
        .filter(SessaoEstudo.inicio >= datetime.combine(inicio_semana, time.min))
        .group_by(SessaoEstudo.disciplina_id)
        .all()
    )

    disciplinas = {d.id: d for d in Disciplina.query.all()}
    blocos = [
        {
            "disciplina_id": disciplina_id,
            "nome": (
                disciplinas[disciplina_id].nome
                if disciplina_id in disciplinas
                else "Sem disciplina"
            ),
            "cor": (
                disciplinas[disciplina_id].cor
                if disciplina_id in disciplinas
                else "#7A7568"
            ),
            "horas": round(float(minutos or 0) / 60, 2),
        }
        for disciplina_id, minutos in por_disciplina
    ]
    blocos.sort(key=lambda b: b["horas"], reverse=True)

    # Últimos 14 dias, para o gráfico de barras.
    inicio_serie = hoje - timedelta(days=13)
    linhas = (
        db.session.query(
            db.func.date(SessaoEstudo.inicio),
            db.func.sum(SessaoEstudo.duracao_min),
        )
        .filter(SessaoEstudo.inicio >= datetime.combine(inicio_serie, time.min))
        .group_by(db.func.date(SessaoEstudo.inicio))
        .all()
    )
    minutos_por_dia = {str(dia): float(minutos or 0) for dia, minutos in linhas}

    serie = []
    for n in range(14):
        dia = inicio_serie + timedelta(days=n)
        serie.append(
            {
                "data": dia,
                "horas": round(minutos_por_dia.get(str(dia), 0) / 60, 2),
            }
        )

    return ok(
        {
            "horas_semana": round(sum(b["horas"] for b in blocos), 2),
            "por_disciplina": blocos,
            "serie_14_dias": serie,
        }
    )


@bp_sessoes.post("")
@login_required
def criar_sessao():
    v = Validador(request.get_json(silent=True))
    campos = {
        "disciplina_id": v.inteiro("disciplina_id", minimo=1),
        "inicio": v.data_hora("inicio"),
        "duracao_min": v.inteiro("duracao_min", obrigatorio=True, minimo=1, maximo=1440),
        "tipo": v.escolha("tipo", constants.TIPOS_SESSAO, default="pomodoro"),
    }
    v.finalizar()

    if campos["disciplina_id"] and not db.session.get(
        Disciplina, campos["disciplina_id"]
    ):
        return erro("Dados inválidos.", 400, {"disciplina_id": "Não encontrada."})

    # Sem início informado, assume que a sessão acabou agora.
    if not campos["inicio"]:
        campos["inicio"] = datetime.now() - timedelta(minutes=campos["duracao_min"])

    sessao = SessaoEstudo(**campos)
    db.session.add(sessao)
    db.session.commit()
    return criado(sessao.to_dict())


@bp_sessoes.delete("/<int:id>")
@login_required
def apagar_sessao(id):
    sessao = db.session.get(SessaoEstudo, id)
    if not sessao:
        return erro("Sessão não encontrada.", 404)
    db.session.delete(sessao)
    db.session.commit()
    return ok()


# ═══════════════════════ metas ═══════════════════════


@bp_metas.get("")
@login_required
def listar_metas():
    """Cada meta vem com o progresso do período corrente já calculado."""
    hoje = date.today()
    query = Meta.query

    if request.args.get("ativas") in ("1", "true"):
        query = query.filter(Meta.ativa.is_(True))

    disciplinas = {d.id: d for d in Disciplina.query.all()}
    saida = []

    for meta in query.order_by(Meta.ativa.desc(), Meta.descricao).all():
        inicio, fim = _janela_do_periodo(meta.periodo, hoje)
        horas = _horas_no_periodo(meta.disciplina_id, inicio, fim)
        disciplina = disciplinas.get(meta.disciplina_id)

        dados = meta.to_dict()
        dados["disciplina"] = disciplina.to_dict() if disciplina else None
        dados["periodo_inicio"] = inicio
        dados["periodo_fim"] = fim
        dados["horas_feitas"] = horas
        dados["percentual"] = (
            round(min(horas / meta.alvo_horas * 100, 100), 1)
            if meta.alvo_horas
            else 0
        )
        dados["cumprida"] = bool(meta.alvo_horas and horas >= meta.alvo_horas)
        saida.append(dados)

    return ok(saida)


@bp_metas.post("")
@login_required
def criar_meta():
    v = Validador(request.get_json(silent=True))
    campos = {
        "disciplina_id": v.inteiro("disciplina_id", obrigatorio=True, minimo=1),
        "descricao": v.texto("descricao", obrigatorio=True, max_len=200),
        "alvo_horas": v.decimal("alvo_horas", obrigatorio=True, minimo=0.5),
        "periodo": v.escolha("periodo", constants.PERIODOS_META, default="semanal"),
        "ativa": v.booleano("ativa", default=True),
    }
    v.finalizar()

    if not db.session.get(Disciplina, campos["disciplina_id"]):
        return erro("Dados inválidos.", 400, {"disciplina_id": "Não encontrada."})

    meta = Meta(**campos)
    db.session.add(meta)
    db.session.commit()
    return criado(meta.to_dict())


@bp_metas.put("/<int:id>")
@login_required
def atualizar_meta(id):
    meta = db.session.get(Meta, id)
    if not meta:
        return erro("Meta não encontrada.", 404)

    v = Validador(request.get_json(silent=True))
    campos = {
        "descricao": v.texto("descricao", max_len=200),
        "alvo_horas": v.decimal("alvo_horas", minimo=0.5),
        "periodo": v.escolha("periodo", constants.PERIODOS_META),
        "disciplina_id": v.inteiro("disciplina_id", minimo=1),
    }
    ativa = v.booleano("ativa", default=meta.ativa)
    v.finalizar()

    for campo, valor in campos.items():
        if valor is not None:
            setattr(meta, campo, valor)
    meta.ativa = ativa

    db.session.commit()
    return ok(meta.to_dict())


@bp_metas.delete("/<int:id>")
@login_required
def apagar_meta(id):
    meta = db.session.get(Meta, id)
    if not meta:
        return erro("Meta não encontrada.", 404)
    db.session.delete(meta)
    db.session.commit()
    return ok()


# ═══════════════════════ flashcards ═══════════════════════


@bp_flashcards.get("")
@login_required
def listar_flashcards():
    query = Flashcard.query

    disciplina_id = request.args.get("disciplina_id", type=int)
    if disciplina_id:
        query = query.filter(Flashcard.disciplina_id == disciplina_id)

    cartas = query.order_by(Flashcard.proxima_revisao, Flashcard.id).all()
    return ok([c.to_dict() for c in cartas])


@bp_flashcards.get("/fila")
@login_required
def fila_do_dia():
    """As cartas que vencem hoje ou já venceram."""
    hoje = date.today()
    query = Flashcard.query.filter(
        db.or_(
            Flashcard.proxima_revisao.is_(None), Flashcard.proxima_revisao <= hoje
        )
    )

    disciplina_id = request.args.get("disciplina_id", type=int)
    if disciplina_id:
        query = query.filter(Flashcard.disciplina_id == disciplina_id)

    cartas = query.order_by(Flashcard.proxima_revisao, Flashcard.id).limit(60).all()
    total = Flashcard.query.count()

    return ok({"fila": [c.to_dict() for c in cartas], "total_cartas": total})


@bp_flashcards.post("")
@login_required
def criar_flashcard():
    v = Validador(request.get_json(silent=True))
    campos = {
        "disciplina_id": v.inteiro("disciplina_id", minimo=1),
        "frente": v.texto("frente", obrigatorio=True),
        "verso": v.texto("verso", obrigatorio=True),
    }
    v.finalizar()

    carta = Flashcard(**campos)
    agendar_nova(carta)
    db.session.add(carta)
    db.session.commit()
    return criado(carta.to_dict())


@bp_flashcards.put("/<int:id>")
@login_required
def atualizar_flashcard(id):
    carta = db.session.get(Flashcard, id)
    if not carta:
        return erro("Flashcard não encontrado.", 404)

    v = Validador(request.get_json(silent=True))
    frente = v.texto("frente")
    verso = v.texto("verso")
    disciplina_id = v.inteiro("disciplina_id", minimo=1)
    v.finalizar()

    if frente:
        carta.frente = frente
    if verso:
        carta.verso = verso
    if disciplina_id:
        carta.disciplina_id = disciplina_id

    db.session.commit()
    return ok(carta.to_dict())


@bp_flashcards.post("/<int:id>/revisar")
@login_required
def revisar_flashcard(id):
    """Recebe a dificuldade e reagenda a carta (services/srs.py)."""
    carta = db.session.get(Flashcard, id)
    if not carta:
        return erro("Flashcard não encontrado.", 404)

    v = Validador(request.get_json(silent=True))
    dificuldade = v.escolha(
        "dificuldade", constants.DIFICULDADES_FLASHCARD, obrigatorio=True
    )
    v.finalizar()

    revisar(carta, dificuldade)
    db.session.commit()
    return ok(carta.to_dict())


@bp_flashcards.delete("/<int:id>")
@login_required
def apagar_flashcard(id):
    carta = db.session.get(Flashcard, id)
    if not carta:
        return erro("Flashcard não encontrado.", 404)
    db.session.delete(carta)
    db.session.commit()
    return ok()
