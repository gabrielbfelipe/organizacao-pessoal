"""Leituras: livros com progresso de páginas, notas e citações."""

from flask import Blueprint, request
from flask_login import login_required

import constants
from database import db
from models import Livro, LivroNota
from utils.respostas import criado, erro, ok
from utils.validacao import ErroValidacao, Validador

bp = Blueprint("livros", __name__)


def _ler_livro(dados):
    v = Validador(dados)
    campos = {
        "titulo": v.texto("titulo", obrigatorio=True, max_len=200),
        "autor": v.texto("autor", max_len=160),
        "total_paginas": v.inteiro("total_paginas", minimo=1, maximo=20000),
        "pagina_atual": v.inteiro("pagina_atual", minimo=0, maximo=20000, default=0),
        "status": v.escolha("status", constants.STATUS_LIVRO, default="quero_ler"),
        "modulo": v.escolha("modulo", constants.MODULOS, default="igreja"),
    }
    v.finalizar()

    if (
        campos["total_paginas"]
        and campos["pagina_atual"]
        and campos["pagina_atual"] > campos["total_paginas"]
    ):
        raise ErroValidacao(
            {"pagina_atual": "A página atual não pode passar do total."}
        )

    return campos


@bp.get("")
@login_required
def listar():
    query = Livro.query

    modulo = request.args.get("modulo")
    if modulo:
        query = query.filter(Livro.modulo == modulo)

    status = request.args.get("status")
    if status:
        if status not in constants.STATUS_LIVRO:
            return erro("Status não permitido.", 400)
        query = query.filter(Livro.status == status)

    # Lendo primeiro, depois quero ler, e os lidos por último.
    ordem = db.case(
        {"lendo": 0, "quero_ler": 1, "lido": 2}, value=Livro.status, else_=3
    )
    livros = query.order_by(ordem, Livro.titulo).all()
    return ok([l.to_dict() for l in livros])


@bp.get("/<int:id>")
@login_required
def obter(id):
    livro = db.session.get(Livro, id)
    if not livro:
        return erro("Livro não encontrado.", 404)

    dados = livro.to_dict()
    dados["notas"] = [
        n.to_dict() for n in sorted(livro.notas, key=lambda n: (n.pagina or 0, n.id))
    ]
    return ok(dados)


@bp.post("")
@login_required
def criar():
    livro = Livro(**_ler_livro(request.get_json(silent=True)))
    db.session.add(livro)
    db.session.commit()
    return criado(livro.to_dict())


@bp.put("/<int:id>")
@login_required
def atualizar(id):
    livro = db.session.get(Livro, id)
    if not livro:
        return erro("Livro não encontrado.", 404)
    for campo, valor in _ler_livro(request.get_json(silent=True)).items():
        setattr(livro, campo, valor)
    db.session.commit()
    return ok(livro.to_dict())


@bp.patch("/<int:id>/progresso")
@login_required
def atualizar_progresso(id):
    """Marcar a página de parada sem abrir o formulário inteiro."""
    livro = db.session.get(Livro, id)
    if not livro:
        return erro("Livro não encontrado.", 404)

    v = Validador(request.get_json(silent=True))
    pagina = v.inteiro("pagina_atual", obrigatorio=True, minimo=0, maximo=20000)
    v.finalizar()

    if livro.total_paginas and pagina > livro.total_paginas:
        return erro(
            "Dados inválidos.",
            400,
            {"pagina_atual": "A página atual não pode passar do total."},
        )

    livro.pagina_atual = pagina

    # Começar a ler, ou terminar, muda o status sozinho.
    if pagina and livro.status == "quero_ler":
        livro.status = "lendo"
    if livro.total_paginas and pagina >= livro.total_paginas:
        livro.status = "lido"

    db.session.commit()
    return ok(livro.to_dict())


@bp.delete("/<int:id>")
@login_required
def apagar(id):
    livro = db.session.get(Livro, id)
    if not livro:
        return erro("Livro não encontrado.", 404)
    db.session.delete(livro)  # as notas caem por cascade
    db.session.commit()
    return ok()


# ─────────────────────── notas e citações ───────────────────────


@bp.post("/<int:id>/notas")
@login_required
def criar_nota(id):
    livro = db.session.get(Livro, id)
    if not livro:
        return erro("Livro não encontrado.", 404)

    v = Validador(request.get_json(silent=True))
    campos = {
        "tipo": v.escolha("tipo", constants.TIPOS_NOTA_LIVRO, default="nota"),
        "conteudo": v.texto("conteudo", obrigatorio=True),
        "pagina": v.inteiro("pagina", minimo=0, maximo=20000),
    }
    v.finalizar()

    nota = LivroNota(livro_id=id, **campos)
    db.session.add(nota)
    db.session.commit()
    return criado(nota.to_dict())


@bp.put("/notas/<int:id>")
@login_required
def atualizar_nota(id):
    nota = db.session.get(LivroNota, id)
    if not nota:
        return erro("Nota não encontrada.", 404)

    v = Validador(request.get_json(silent=True))
    tipo = v.escolha("tipo", constants.TIPOS_NOTA_LIVRO)
    conteudo = v.texto("conteudo")
    pagina = v.inteiro("pagina", minimo=0, maximo=20000)
    v.finalizar()

    if tipo:
        nota.tipo = tipo
    if conteudo:
        nota.conteudo = conteudo
    if pagina is not None:
        nota.pagina = pagina

    db.session.commit()
    return ok(nota.to_dict())


@bp.delete("/notas/<int:id>")
@login_required
def apagar_nota(id):
    nota = db.session.get(LivroNota, id)
    if not nota:
        return erro("Nota não encontrada.", 404)
    db.session.delete(nota)
    db.session.commit()
    return ok()
