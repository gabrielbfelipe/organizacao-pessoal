"""Biblioteca de orações e o acompanhamento das novenas."""

from datetime import date, timedelta

from flask import Blueprint, request
from flask_login import login_required

import constants
from database import db
from models import NovenaProgresso, Oracao
from utils.respostas import criado, erro, ok
from utils.validacao import Validador

bp = Blueprint("oracoes", __name__)


def _ler(dados):
    v = Validador(dados)
    campos = {
        "titulo": v.texto("titulo", obrigatorio=True, max_len=160),
        "texto": v.texto("texto", obrigatorio=True),
        "categoria": v.escolha("categoria", constants.CATEGORIAS_ORACAO, default="pessoal"),
        "favorita": v.booleano("favorita"),
        "e_novena": v.booleano("e_novena"),
        "dias_novena": v.inteiro("dias_novena", minimo=2, maximo=60, default=9),
    }
    v.finalizar()
    return campos


# ─────────────────────────── orações ───────────────────────────


@bp.get("")
@login_required
def listar():
    """Filtros: ?categoria= ?favoritas=1 ?novenas=1 ?busca=.

    A lista vem sem o texto completo: o corpo das orações é longo e só a
    tela de leitura precisa dele.
    """
    query = Oracao.query

    categoria = request.args.get("categoria")
    if categoria:
        if categoria not in constants.CATEGORIAS_ORACAO:
            return erro("Categoria não permitida.", 400)
        query = query.filter(Oracao.categoria == categoria)

    if request.args.get("favoritas") in ("1", "true"):
        query = query.filter(Oracao.favorita.is_(True))

    if request.args.get("novenas") in ("1", "true"):
        query = query.filter(Oracao.e_novena.is_(True))

    busca = request.args.get("busca")
    if busca:
        alvo = f"%{busca}%"
        query = query.filter(db.or_(Oracao.titulo.like(alvo), Oracao.texto.like(alvo)))

    oracoes = query.order_by(Oracao.favorita.desc(), Oracao.titulo).all()
    return ok([o.to_dict(com_texto=False) for o in oracoes])


@bp.get("/<int:id>")
@login_required
def obter(id):
    oracao = db.session.get(Oracao, id)
    if not oracao:
        return erro("Oração não encontrada.", 404)

    dados = oracao.to_dict()
    # A novena em andamento acompanha a oração, para o modo Rezar.
    progresso = (
        NovenaProgresso.query.filter_by(oracao_id=id, concluida=False)
        .order_by(NovenaProgresso.inicio.desc())
        .first()
    )
    dados["novena_ativa"] = progresso.to_dict() if progresso else None
    return ok(dados)


@bp.post("")
@login_required
def criar():
    oracao = Oracao(**_ler(request.get_json(silent=True)))
    db.session.add(oracao)
    db.session.commit()
    return criado(oracao.to_dict())


@bp.put("/<int:id>")
@login_required
def atualizar(id):
    oracao = db.session.get(Oracao, id)
    if not oracao:
        return erro("Oração não encontrada.", 404)
    for campo, valor in _ler(request.get_json(silent=True)).items():
        setattr(oracao, campo, valor)
    db.session.commit()
    return ok(oracao.to_dict())


@bp.patch("/<int:id>/favorita")
@login_required
def alternar_favorita(id):
    oracao = db.session.get(Oracao, id)
    if not oracao:
        return erro("Oração não encontrada.", 404)
    oracao.favorita = not oracao.favorita
    db.session.commit()
    return ok(oracao.to_dict(com_texto=False))


@bp.delete("/<int:id>")
@login_required
def apagar(id):
    oracao = db.session.get(Oracao, id)
    if not oracao:
        return erro("Oração não encontrada.", 404)
    db.session.delete(oracao)  # o progresso das novenas cai por cascade
    db.session.commit()
    return ok()


# ─────────────────────────── novenas ───────────────────────────


@bp.get("/novenas")
@login_required
def listar_novenas():
    """As novenas em andamento, com o título da oração junto."""
    progressos = (
        NovenaProgresso.query.filter_by(concluida=False)
        .order_by(NovenaProgresso.inicio.desc())
        .all()
    )

    saida = []
    for progresso in progressos:
        dados = progresso.to_dict()
        dados["oracao"] = progresso.oracao.to_dict(com_texto=False)
        dados["rezada_hoje"] = progresso.ultimo_dia_em == date.today()
        saida.append(dados)
    return ok(saida)


@bp.post("/<int:id>/novena")
@login_required
def iniciar_novena(id):
    oracao = db.session.get(Oracao, id)
    if not oracao:
        return erro("Oração não encontrada.", 404)
    if not oracao.e_novena:
        return erro("Esta oração não está marcada como novena.", 400)

    em_andamento = NovenaProgresso.query.filter_by(
        oracao_id=id, concluida=False
    ).first()
    if em_andamento:
        return erro("Já existe uma novena em andamento para esta oração.", 409)

    progresso = NovenaProgresso(oracao_id=id, inicio=date.today(), dia_atual=1)
    db.session.add(progresso)
    db.session.commit()
    return criado(progresso.to_dict())


@bp.post("/novenas/<int:id>/avancar")
@login_required
def avancar_novena(id):
    """Marca o dia de hoje como rezado.

    Recusa a segunda marcação no mesmo dia: sem isso, dois cliques
    dariam a novena por cumprida em metade do tempo.
    """
    progresso = db.session.get(NovenaProgresso, id)
    if not progresso:
        return erro("Novena não encontrada.", 404)
    if progresso.concluida:
        return erro("Esta novena já foi concluída.", 409)

    hoje = date.today()
    if progresso.ultimo_dia_em == hoje:
        return erro("O dia de hoje já foi marcado nesta novena.", 409)

    total = progresso.oracao.dias_novena or 9
    progresso.ultimo_dia_em = hoje

    # dia_atual é o dia que está sendo rezado agora. Marcar o último
    # encerra a novena; marcar qualquer outro avança para o seguinte.
    if progresso.dia_atual >= total:
        progresso.concluida = True
    else:
        progresso.dia_atual += 1

    db.session.commit()

    dados = progresso.to_dict()
    dados["total_dias"] = total
    return ok(dados)


@bp.delete("/novenas/<int:id>")
@login_required
def apagar_novena(id):
    progresso = db.session.get(NovenaProgresso, id)
    if not progresso:
        return erro("Novena não encontrada.", 404)
    db.session.delete(progresso)
    db.session.commit()
    return ok()
