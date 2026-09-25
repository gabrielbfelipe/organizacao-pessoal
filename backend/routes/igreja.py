"""Escala de cerimoniário.

Este arquivo é o molde do padrão CRUD do Ordo. Os outros módulos seguem
a mesma forma: filtros por query string, validação acumulada em
utils.validacao, to_dict() explícito e erros no formato
{"erro": ..., "campos": {...}}.
"""

from datetime import date, datetime, timedelta

from flask import Blueprint, request
from flask_login import login_required

import constants
from database import db
from models import IgrejaEscala
from utils.respostas import criado, erro, ok, paginar
from utils.validacao import ErroValidacao, Validador

bp = Blueprint("igreja_escalas", __name__)


# ─────────────────────────── apoio ───────────────────────────


def _intervalo_do_mes(texto):
    """"2026-09" → (2026-09-01, 2026-09-30). Devolve None se inválido."""
    try:
        ano, mes = (int(p) for p in texto.split("-"))
        primeiro = date(ano, mes, 1)
    except (ValueError, TypeError):
        return None
    if mes == 12:
        ultimo = date(ano, 12, 31)
    else:
        ultimo = date(ano, mes + 1, 1) - timedelta(days=1)
    return primeiro, ultimo


def _ler_escala(dados, prefixo_erro=None):
    """Valida o corpo de uma escala e devolve os campos já convertidos.

    Usado tanto no POST de uma escala quanto no cadastro em lote, para
    que as duas entradas tenham exatamente as mesmas regras.
    """
    v = Validador(dados)
    campos = {
        "data": v.data("data", obrigatorio=True),
        "horario": v.hora("horario", obrigatorio=True),
        "celebracao": v.texto("celebracao", obrigatorio=True, max_len=160),
        "funcao": v.texto("funcao", max_len=80),
        "local": v.texto("local", max_len=160),
        "status": v.escolha("status", constants.STATUS_ESCALA, default="pendente"),
        "observacoes": v.texto("observacoes"),
    }
    if v.erros and prefixo_erro is not None:
        raise ErroValidacao({f"{prefixo_erro}.{k}": m for k, m in v.erros.items()})
    v.finalizar()
    return campos


# ─────────────────────────── leitura ───────────────────────────


@bp.get("")
@login_required
def listar():
    """Filtros: ?mes=AAAA-MM, ou ?inicio=&fim=, mais ?status= e ?funcao=."""
    query = IgrejaEscala.query

    mes = request.args.get("mes")
    if mes:
        intervalo = _intervalo_do_mes(mes)
        if not intervalo:
            return erro("Use o formato AAAA-MM no parâmetro mes.", 400)
        query = query.filter(IgrejaEscala.data.between(*intervalo))
    else:
        for parametro, comparacao in (("inicio", "ge"), ("fim", "le")):
            bruto = request.args.get(parametro)
            if not bruto:
                continue
            try:
                limite = date.fromisoformat(bruto)
            except ValueError:
                return erro(f"Use o formato AAAA-MM-DD no parâmetro {parametro}.", 400)
            coluna = IgrejaEscala.data
            query = query.filter(
                coluna >= limite if comparacao == "ge" else coluna <= limite
            )

    status = request.args.get("status")
    if status:
        if status not in constants.STATUS_ESCALA:
            return erro("Status não permitido.", 400)
        query = query.filter(IgrejaEscala.status == status)

    funcao = request.args.get("funcao")
    if funcao:
        query = query.filter(IgrejaEscala.funcao == funcao)

    query = query.order_by(IgrejaEscala.data, IgrejaEscala.horario)

    return ok(
        paginar(
            query,
            pagina=request.args.get("pagina", 1, type=int),
            por_pagina=request.args.get("por_pagina", 100, type=int),
        )
    )


@bp.get("/proxima")
@login_required
def proxima():
    """A próxima escala a partir de agora. O dashboard usa a mesma lógica."""
    from services.dashboard import proxima_escala

    escala = proxima_escala()
    return ok(escala.to_dict() if escala else None)


@bp.get("/resumo")
@login_required
def resumo():
    """Contagem por status no mês, para os contadores da tela."""
    mes = request.args.get("mes") or date.today().strftime("%Y-%m")
    intervalo = _intervalo_do_mes(mes)
    if not intervalo:
        return erro("Use o formato AAAA-MM no parâmetro mes.", 400)

    linhas = (
        db.session.query(IgrejaEscala.status, db.func.count(IgrejaEscala.id))
        .filter(IgrejaEscala.data.between(*intervalo))
        .group_by(IgrejaEscala.status)
        .all()
    )
    contagem = {status: 0 for status in constants.STATUS_ESCALA}
    for status, total in linhas:
        contagem[status] = total
    contagem["total"] = sum(contagem[s] for s in constants.STATUS_ESCALA)
    return ok(contagem)


@bp.get("/<int:id>")
@login_required
def obter(id):
    escala = db.session.get(IgrejaEscala, id)
    if not escala:
        return erro("Escala não encontrada.", 404)
    return ok(escala.to_dict())


# ─────────────────────────── escrita ───────────────────────────


@bp.post("")
@login_required
def criar():
    campos = _ler_escala(request.get_json(silent=True))
    escala = IgrejaEscala(**campos)
    db.session.add(escala)
    db.session.commit()
    return criado(escala.to_dict())


@bp.post("/lote")
@login_required
def criar_lote():
    """Cadastro da escala do mês de uma vez.

    Ou entra tudo, ou nada: os erros de validação são devolvidos com o
    índice da linha, e nenhuma escala é gravada se qualquer uma falhar.
    """
    v = Validador(request.get_json(silent=True))
    linhas = v.lista("escalas", obrigatorio=True)
    v.finalizar()

    if not linhas:
        return erro("Envie ao menos uma escala.", 400)
    if len(linhas) > 200:
        return erro("Envie no máximo 200 escalas por vez.", 400)

    erros = {}
    validadas = []
    for indice, linha in enumerate(linhas):
        try:
            validadas.append(_ler_escala(linha, prefixo_erro=f"escalas[{indice}]"))
        except ErroValidacao as e:
            erros.update(e.campos)

    if erros:
        return erro("Dados inválidos.", 400, erros)

    escalas = [IgrejaEscala(**campos) for campos in validadas]
    db.session.add_all(escalas)
    db.session.commit()
    return criado({"criadas": len(escalas), "escalas": [e.to_dict() for e in escalas]})


@bp.put("/<int:id>")
@login_required
def atualizar(id):
    escala = db.session.get(IgrejaEscala, id)
    if not escala:
        return erro("Escala não encontrada.", 404)

    campos = _ler_escala(request.get_json(silent=True))
    for campo, valor in campos.items():
        setattr(escala, campo, valor)
    db.session.commit()
    return ok(escala.to_dict())


@bp.patch("/<int:id>/status")
@login_required
def mudar_status(id):
    """Confirmar a escala ou pedir troca, sem reenviar o resto."""
    escala = db.session.get(IgrejaEscala, id)
    if not escala:
        return erro("Escala não encontrada.", 404)

    v = Validador(request.get_json(silent=True))
    status = v.escolha("status", constants.STATUS_ESCALA, obrigatorio=True)
    v.finalizar()

    escala.status = status
    db.session.commit()
    return ok(escala.to_dict())


@bp.delete("/<int:id>")
@login_required
def apagar(id):
    escala = db.session.get(IgrejaEscala, id)
    if not escala:
        return erro("Escala não encontrada.", 404)
    db.session.delete(escala)
    db.session.commit()
    return ok()
