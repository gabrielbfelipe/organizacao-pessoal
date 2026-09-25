"""Categorias dos compromissos: nome, cor e modulo."""

from flask import Blueprint, request
from flask_login import login_required

import constants
from database import db
from models import Categoria, Compromisso
from utils.respostas import criado, erro, ok
from utils.validacao import Validador

bp = Blueprint("categorias", __name__)


def _ler(dados, obrigatorio=True):
    v = Validador(dados)
    campos = {
        "nome": v.texto("nome", obrigatorio=obrigatorio, max_len=60),
        "cor": v.cor("cor", default="#1B2A41"),
        "modulo": v.escolha("modulo", constants.MODULOS, default="geral"),
    }
    v.finalizar()
    return campos


@bp.get("")
@login_required
def listar():
    modulo = request.args.get("modulo")
    query = Categoria.query
    if modulo:
        query = query.filter(Categoria.modulo == modulo)
    return ok([c.to_dict() for c in query.order_by(Categoria.nome).all()])


@bp.post("")
@login_required
def criar():
    categoria = Categoria(**_ler(request.get_json(silent=True)))
    db.session.add(categoria)
    db.session.commit()
    return criado(categoria.to_dict())


@bp.put("/<int:id>")
@login_required
def atualizar(id):
    categoria = db.session.get(Categoria, id)
    if not categoria:
        return erro("Categoria nao encontrada.", 404)
    for campo, valor in _ler(request.get_json(silent=True)).items():
        setattr(categoria, campo, valor)
    db.session.commit()
    return ok(categoria.to_dict())


@bp.delete("/<int:id>")
@login_required
def apagar(id):
    categoria = db.session.get(Categoria, id)
    if not categoria:
        return erro("Categoria nao encontrada.", 404)

    # A FK e ON DELETE SET NULL, entao os compromissos sobrevivem sem
    # categoria. O aviso deixa isso explicito para quem chama a API.
    em_uso = Compromisso.query.filter_by(categoria_id=id).count()
    db.session.delete(categoria)
    db.session.commit()
    return ok({"compromissos_sem_categoria": em_uso})
