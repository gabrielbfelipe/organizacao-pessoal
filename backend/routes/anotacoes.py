"""Anotações em Markdown, compartilhadas pelos módulos.

A mesma tabela atende geral, igreja e estudos pelo campo `modulo`, como
previsto no planejamento. O Markdown é renderizado no cliente, sempre
passando por DOMPurify antes de ir ao DOM.
"""

from flask import Blueprint, request
from flask_login import login_required

import constants
from database import db
from models import Anotacao, Disciplina
from utils.respostas import criado, erro, ok
from utils.validacao import ErroValidacao, Validador

bp = Blueprint("anotacoes", __name__)


def _ler(dados):
    v = Validador(dados)
    campos = {
        "titulo": v.texto("titulo", obrigatorio=True, max_len=200),
        "conteudo_md": v.texto("conteudo_md"),
        "modulo": v.escolha("modulo", constants.MODULOS, default="geral"),
        "disciplina_id": v.inteiro("disciplina_id", minimo=1),
        "fixada": v.booleano("fixada"),
    }
    v.finalizar()

    if campos["disciplina_id"] and not db.session.get(
        Disciplina, campos["disciplina_id"]
    ):
        raise ErroValidacao({"disciplina_id": "Disciplina não encontrada."})

    return campos


@bp.get("")
@login_required
def listar():
    """Filtros: ?modulo= ?disciplina_id= ?busca=.

    A lista não traz o corpo em Markdown, que pode ser longo.
    """
    query = Anotacao.query

    modulo = request.args.get("modulo")
    if modulo:
        if modulo not in constants.MODULOS:
            return erro("Módulo não permitido.", 400)
        query = query.filter(Anotacao.modulo == modulo)

    disciplina_id = request.args.get("disciplina_id", type=int)
    if disciplina_id:
        query = query.filter(Anotacao.disciplina_id == disciplina_id)

    busca = request.args.get("busca")
    if busca:
        alvo = f"%{busca}%"
        query = query.filter(
            db.or_(Anotacao.titulo.like(alvo), Anotacao.conteudo_md.like(alvo))
        )

    anotacoes = query.order_by(
        Anotacao.fixada.desc(), Anotacao.atualizado_em.desc()
    ).all()
    return ok([a.to_dict(com_conteudo=False) for a in anotacoes])


@bp.get("/<int:id>")
@login_required
def obter(id):
    anotacao = db.session.get(Anotacao, id)
    if not anotacao:
        return erro("Anotação não encontrada.", 404)
    return ok(anotacao.to_dict())


@bp.post("")
@login_required
def criar():
    anotacao = Anotacao(**_ler(request.get_json(silent=True)))
    db.session.add(anotacao)
    db.session.commit()
    return criado(anotacao.to_dict())


@bp.put("/<int:id>")
@login_required
def atualizar(id):
    anotacao = db.session.get(Anotacao, id)
    if not anotacao:
        return erro("Anotação não encontrada.", 404)
    for campo, valor in _ler(request.get_json(silent=True)).items():
        setattr(anotacao, campo, valor)
    db.session.commit()
    return ok(anotacao.to_dict())


@bp.patch("/<int:id>/fixada")
@login_required
def alternar_fixada(id):
    anotacao = db.session.get(Anotacao, id)
    if not anotacao:
        return erro("Anotação não encontrada.", 404)
    anotacao.fixada = not anotacao.fixada
    db.session.commit()
    return ok(anotacao.to_dict(com_conteudo=False))


@bp.delete("/<int:id>")
@login_required
def apagar(id):
    anotacao = db.session.get(Anotacao, id)
    if not anotacao:
        return erro("Anotação não encontrada.", 404)
    db.session.delete(anotacao)
    db.session.commit()
    return ok()
