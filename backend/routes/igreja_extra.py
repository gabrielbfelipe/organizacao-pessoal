"""Eventos da paróquia e a grade de horários fixos.

Ficam separados de routes/igreja.py, que cuida só das escalas, para que
nenhum arquivo de rota vire um depósito.
"""

from datetime import date, datetime, time, timedelta

from flask import Blueprint, request
from flask_login import login_required

import constants
from database import db
from models import IgrejaEvento, IgrejaHorarioFixo
from services.lembretes import apagar_da_origem
from utils.respostas import criado, erro, ok
from utils.validacao import Validador

bp_eventos = Blueprint("igreja_eventos", __name__)
bp_horarios = Blueprint("igreja_horarios", __name__)


# ═══════════════════════ eventos e missas ═══════════════════════


def _ler_evento(dados):
    v = Validador(dados)
    campos = {
        "titulo": v.texto("titulo", obrigatorio=True, max_len=160),
        "tipo": v.escolha("tipo", constants.TIPOS_EVENTO, default="missa"),
        "data_hora": v.data_hora("data_hora", obrigatorio=True),
        "local": v.texto("local", max_len=160),
        "descricao": v.texto("descricao"),
        "lembrete_min": v.inteiro("lembrete_min", minimo=0, maximo=20160, default=1440),
    }
    v.finalizar()
    return campos


@bp_eventos.get("")
@login_required
def listar_eventos():
    """Filtros: ?tipo= ?inicio= ?fim= ?passados=1."""
    query = IgrejaEvento.query

    tipo = request.args.get("tipo")
    if tipo:
        if tipo not in constants.TIPOS_EVENTO:
            return erro("Tipo de evento não permitido.", 400)
        query = query.filter(IgrejaEvento.tipo == tipo)

    for parametro, comparador in (("inicio", "ge"), ("fim", "le")):
        bruto = request.args.get(parametro)
        if not bruto:
            continue
        try:
            limite = date.fromisoformat(bruto)
        except ValueError:
            return erro(f"Use o formato AAAA-MM-DD em {parametro}.", 400)
        momento = datetime.combine(limite, time.min if comparador == "ge" else time.max)
        query = query.filter(
            IgrejaEvento.data_hora >= momento
            if comparador == "ge"
            else IgrejaEvento.data_hora <= momento
        )

    # Por padrão a tela mostra o que ainda vai acontecer.
    if request.args.get("passados") not in ("1", "true"):
        if not request.args.get("inicio"):
            query = query.filter(IgrejaEvento.data_hora >= datetime.now())
        eventos = query.order_by(IgrejaEvento.data_hora).all()
    else:
        eventos = query.order_by(IgrejaEvento.data_hora.desc()).all()

    return ok([e.to_dict() for e in eventos])


@bp_eventos.get("/<int:id>")
@login_required
def obter_evento(id):
    evento = db.session.get(IgrejaEvento, id)
    if not evento:
        return erro("Evento não encontrado.", 404)
    return ok(evento.to_dict())


@bp_eventos.post("")
@login_required
def criar_evento():
    evento = IgrejaEvento(**_ler_evento(request.get_json(silent=True)))
    db.session.add(evento)
    db.session.commit()
    return criado(evento.to_dict())


@bp_eventos.put("/<int:id>")
@login_required
def atualizar_evento(id):
    evento = db.session.get(IgrejaEvento, id)
    if not evento:
        return erro("Evento não encontrado.", 404)
    for campo, valor in _ler_evento(request.get_json(silent=True)).items():
        setattr(evento, campo, valor)
    apagar_da_origem("evento", evento.id)
    db.session.commit()
    return ok(evento.to_dict())


@bp_eventos.delete("/<int:id>")
@login_required
def apagar_evento(id):
    evento = db.session.get(IgrejaEvento, id)
    if not evento:
        return erro("Evento não encontrado.", 404)
    apagar_da_origem("evento", evento.id)
    db.session.delete(evento)
    db.session.commit()
    return ok()


# ═══════════════════════ horários fixos ═══════════════════════


def _ler_horario(dados):
    v = Validador(dados)
    campos = {
        "tipo": v.escolha("tipo", constants.TIPOS_HORARIO_FIXO, obrigatorio=True),
        # 0 = segunda ... 6 = domingo, o padrão do Python.
        "dia_semana": v.inteiro("dia_semana", obrigatorio=True, minimo=0, maximo=6),
        "horario": v.hora("horario", obrigatorio=True),
        "local": v.texto("local", max_len=160),
        "observacao": v.texto("observacao", max_len=255),
    }
    v.finalizar()
    return campos


@bp_horarios.get("")
@login_required
def listar_horarios():
    """Devolve a grade agrupada por dia da semana, pronta para a tela."""
    query = IgrejaHorarioFixo.query

    tipo = request.args.get("tipo")
    if tipo:
        if tipo not in constants.TIPOS_HORARIO_FIXO:
            return erro("Tipo não permitido.", 400)
        query = query.filter(IgrejaHorarioFixo.tipo == tipo)

    horarios = query.order_by(
        IgrejaHorarioFixo.dia_semana, IgrejaHorarioFixo.horario
    ).all()

    grade = [
        {"dia_semana": dia, "nome": constants.DIAS_SEMANA[dia], "horarios": []}
        for dia in range(7)
    ]
    for horario in horarios:
        grade[horario.dia_semana]["horarios"].append(horario.to_dict())

    return ok({"grade": grade, "total": len(horarios)})


@bp_horarios.post("")
@login_required
def criar_horario():
    horario = IgrejaHorarioFixo(**_ler_horario(request.get_json(silent=True)))
    db.session.add(horario)
    db.session.commit()
    return criado(horario.to_dict())


@bp_horarios.put("/<int:id>")
@login_required
def atualizar_horario(id):
    horario = db.session.get(IgrejaHorarioFixo, id)
    if not horario:
        return erro("Horário não encontrado.", 404)
    for campo, valor in _ler_horario(request.get_json(silent=True)).items():
        setattr(horario, campo, valor)
    db.session.commit()
    return ok(horario.to_dict())


@bp_horarios.delete("/<int:id>")
@login_required
def apagar_horario(id):
    horario = db.session.get(IgrejaHorarioFixo, id)
    if not horario:
        return erro("Horário não encontrado.", 404)
    db.session.delete(horario)
    db.session.commit()
    return ok()


@bp_horarios.get("/proximos")
@login_required
def proximos_horarios():
    """As próximas ocorrências da grade semanal, já com data concreta."""
    from services.dashboard import proximas_ocorrencias_fixas

    tipo = request.args.get("tipo")
    if tipo and tipo not in constants.TIPOS_HORARIO_FIXO:
        return erro("Tipo não permitido.", 400)

    return ok(proximas_ocorrencias_fixas(tipo=tipo, limite=6))
