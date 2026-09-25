"""Lembretes pendentes.

Nao ha agendador em segundo plano: o frontend consulta /pendentes a cada
minuto e essa rota materializa os lembretes antes de responder.
"""

from flask import Blueprint
from flask_login import login_required

from database import db
from models import Lembrete
from services.lembretes import materializar, pendentes
from utils.respostas import erro, ok

bp = Blueprint("lembretes", __name__)


@bp.get("/pendentes")
@login_required
def listar_pendentes():
    materializar()
    return ok([l.to_dict() for l in pendentes()])


@bp.get("/proximos")
@login_required
def listar_proximos():
    """Os proximos lembretes ainda nao disparados, para a tela da agenda."""
    materializar()
    lista = (
        Lembrete.query.filter(Lembrete.enviado.is_(False))
        .order_by(Lembrete.disparar_em)
        .limit(20)
        .all()
    )
    return ok([l.to_dict() for l in lista])


@bp.patch("/<int:id>/enviado")
@login_required
def marcar_enviado(id):
    lembrete = db.session.get(Lembrete, id)
    if not lembrete:
        return erro("Lembrete nao encontrado.", 404)
    lembrete.enviado = True
    db.session.commit()
    return ok(lembrete.to_dict())


@bp.delete("/<int:id>")
@login_required
def apagar(id):
    lembrete = db.session.get(Lembrete, id)
    if not lembrete:
        return erro("Lembrete nao encontrado.", 404)
    db.session.delete(lembrete)
    db.session.commit()
    return ok()
