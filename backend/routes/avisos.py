"""Quadro de avisos: cartões no estilo post-it."""

from datetime import date

from flask import Blueprint, request
from flask_login import login_required

import constants
from database import db
from models import Aviso
from utils.respostas import criado, erro, ok
from utils.validacao import Validador

bp = Blueprint("avisos", __name__)

# Paleta dos post-its, na mesma família do design system.
CORES_SUGERIDAS = [
    "#F4E7B8",  # areia
    "#D9E8D4",  # verde claro
    "#DCE4F0",  # azul claro
    "#F0D9DC",  # rosa claro
    "#E8DCF0",  # lilás
    "#F5E0CC",  # pêssego
]


def _ler(dados):
    v = Validador(dados)
    campos = {
        "titulo": v.texto("titulo", obrigatorio=True, max_len=160),
        "conteudo": v.texto("conteudo"),
        "cor": v.cor("cor", default="#F4E7B8"),
        "prioridade": v.escolha("prioridade", constants.PRIORIDADES, default="media"),
        "fixado": v.booleano("fixado"),
        "expira_em": v.data("expira_em"),
    }
    v.finalizar()
    return campos


@bp.get("")
@login_required
def listar():
    """Por padrão esconde os vencidos. Use ?incluir_vencidos=1 para vê-los.

    Fixados vêm primeiro, depois por prioridade e por data de criação.
    """
    query = Aviso.query

    if request.args.get("incluir_vencidos") not in ("1", "true"):
        query = query.filter(
            db.or_(Aviso.expira_em.is_(None), Aviso.expira_em >= date.today())
        )

    prioridade = request.args.get("prioridade")
    if prioridade:
        if prioridade not in constants.PRIORIDADES:
            return erro("Prioridade não permitida.", 400)
        query = query.filter(Aviso.prioridade == prioridade)

    ordem_prioridade = db.case(
        {"alta": 0, "media": 1, "baixa": 2}, value=Aviso.prioridade, else_=3
    )
    avisos = query.order_by(
        Aviso.fixado.desc(), ordem_prioridade, Aviso.criado_em.desc()
    ).all()

    return ok([a.to_dict() for a in avisos])


@bp.post("")
@login_required
def criar():
    aviso = Aviso(**_ler(request.get_json(silent=True)))
    db.session.add(aviso)
    db.session.commit()
    return criado(aviso.to_dict())


@bp.put("/<int:id>")
@login_required
def atualizar(id):
    aviso = db.session.get(Aviso, id)
    if not aviso:
        return erro("Aviso não encontrado.", 404)
    for campo, valor in _ler(request.get_json(silent=True)).items():
        setattr(aviso, campo, valor)
    db.session.commit()
    return ok(aviso.to_dict())


@bp.patch("/<int:id>/fixado")
@login_required
def alternar_fixado(id):
    aviso = db.session.get(Aviso, id)
    if not aviso:
        return erro("Aviso não encontrado.", 404)
    aviso.fixado = not aviso.fixado
    db.session.commit()
    return ok(aviso.to_dict())


@bp.delete("/<int:id>")
@login_required
def apagar(id):
    aviso = db.session.get(Aviso, id)
    if not aviso:
        return erro("Aviso não encontrado.", 404)
    db.session.delete(aviso)
    db.session.commit()
    return ok()


@bp.get("/cores")
@login_required
def cores():
    return ok(CORES_SUGERIDAS)
