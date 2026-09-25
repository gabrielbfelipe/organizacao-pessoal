"""Compromissos e a agenda unificada.

São dois blueprints:

- bp_compromissos (/api/compromissos) — CRUD da série, mais as rotas de
  ocorrência, que cancelam ou remarcam um único dia sem tocar no resto.
- bp_agenda (/api/agenda) — a alimentação do FullCalendar, que junta
  compromissos expandidos, escalas e eventos da paróquia num só array.
"""

from datetime import date, datetime, time, timedelta

from flask import Blueprint, request
from flask_login import login_required

import constants
from database import db
from models import (
    Categoria,
    Compromisso,
    CompromissoExcecao,
    IgrejaEscala,
    IgrejaEvento,
)
from services.lembretes import apagar_da_origem
from services.recorrencia import expandir_varios
from utils.respostas import criado, erro, ok, paginar
from utils.validacao import ErroValidacao, Validador

bp_compromissos = Blueprint("compromissos", __name__)
bp_agenda = Blueprint("agenda", __name__)

# Cores das fontes que não têm categoria própria.
COR_ESCALA = "#B8963E"
COR_EVENTO = "#6B3FA0"


def _cor_do_texto(fundo):
    """Branco ou tinta, conforme a luminância do bloco.

    A cor do bloco vem da categoria, que o usuário escolhe: forçar texto
    branco deixaria ilegível qualquer categoria clara — o ouro sobre
    branco dá 2,81:1, abaixo do mínimo. A escolha aqui é feita por
    luminância relativa, a mesma fórmula da WCAG.
    """
    try:
        cru = fundo.lstrip("#")
        canais = [int(cru[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    except (ValueError, IndexError):
        return "#FFFFFF"

    def linearizar(c):
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (linearizar(c) for c in canais)
    luminancia = 0.2126 * r + 0.7152 * g + 0.0722 * b

    # 0,179 é o ponto em que o contraste com branco e com preto se iguala.
    return "#1B2A41" if luminancia > 0.179 else "#FFFFFF"


# ─────────────────────────── apoio ───────────────────────────


def _ler_compromisso(dados):
    v = Validador(dados)
    campos = {
        "titulo": v.texto("titulo", obrigatorio=True, max_len=160),
        "descricao": v.texto("descricao"),
        "inicio": v.data_hora("inicio", obrigatorio=True),
        "fim": v.data_hora("fim"),
        "dia_inteiro": v.booleano("dia_inteiro"),
        "local": v.texto("local", max_len=160),
        "categoria_id": v.inteiro("categoria_id", minimo=1),
        "recorrencia": v.escolha("recorrencia", constants.RECORRENCIAS, default="nenhuma"),
        "recorrencia_fim": v.data("recorrencia_fim"),
        "lembrete_min": v.inteiro("lembrete_min", minimo=0, maximo=20160),
    }
    v.finalizar()

    if campos["fim"] and campos["fim"] < campos["inicio"]:
        raise ErroValidacao({"fim": "O fim não pode ser antes do início."})

    if campos["recorrencia_fim"] and campos["recorrencia_fim"] < campos["inicio"].date():
        raise ErroValidacao(
            {"recorrencia_fim": "O término da recorrência não pode ser antes do início."}
        )

    if campos["categoria_id"] and not db.session.get(Categoria, campos["categoria_id"]):
        raise ErroValidacao({"categoria_id": "Categoria não encontrada."})

    return campos


def _intervalo_da_query():
    """Lê ?inicio= e ?fim=. Sem eles, usa o mês corrente com folga."""
    hoje = date.today()
    padrao_inicio = hoje.replace(day=1) - timedelta(days=7)
    padrao_fim = hoje + timedelta(days=60)

    def ler(nome, padrao):
        bruto = request.args.get(nome)
        if not bruto:
            return padrao
        try:
            return date.fromisoformat(bruto[:10])
        except ValueError:
            return None

    inicio = ler("inicio", padrao_inicio)
    fim = ler("fim", padrao_fim)
    return inicio, fim


# ═══════════════════════ compromissos ═══════════════════════


@bp_compromissos.get("")
@login_required
def listar():
    query = Compromisso.query

    categoria_id = request.args.get("categoria_id", type=int)
    if categoria_id:
        query = query.filter(Compromisso.categoria_id == categoria_id)

    query = query.order_by(Compromisso.inicio.desc())
    return ok(
        paginar(
            query,
            pagina=request.args.get("pagina", 1, type=int),
            por_pagina=request.args.get("por_pagina", 50, type=int),
        )
    )


@bp_compromissos.get("/<int:id>")
@login_required
def obter(id):
    compromisso = db.session.get(Compromisso, id)
    if not compromisso:
        return erro("Compromisso não encontrado.", 404)
    dados = compromisso.to_dict()
    dados["excecoes"] = [e.to_dict() for e in compromisso.excecoes]
    return ok(dados)


@bp_compromissos.post("")
@login_required
def criar():
    compromisso = Compromisso(**_ler_compromisso(request.get_json(silent=True)))
    db.session.add(compromisso)
    db.session.commit()
    return criado(compromisso.to_dict())


@bp_compromissos.put("/<int:id>")
@login_required
def atualizar(id):
    compromisso = db.session.get(Compromisso, id)
    if not compromisso:
        return erro("Compromisso não encontrado.", 404)

    campos = _ler_compromisso(request.get_json(silent=True))
    for campo, valor in campos.items():
        setattr(compromisso, campo, valor)

    # Os lembretes são refeitos a partir dos novos horários.
    apagar_da_origem("compromisso", compromisso.id)
    db.session.commit()
    return ok(compromisso.to_dict())


@bp_compromissos.delete("/<int:id>")
@login_required
def apagar(id):
    compromisso = db.session.get(Compromisso, id)
    if not compromisso:
        return erro("Compromisso não encontrado.", 404)

    apagar_da_origem("compromisso", compromisso.id)
    db.session.delete(compromisso)
    db.session.commit()
    return ok()


# ─────────────── uma ocorrência da série ───────────────


def _data_da_ocorrencia():
    bruto = request.args.get("data")
    if not bruto:
        return None, erro("Informe a data da ocorrência em ?data=AAAA-MM-DD.", 400)
    try:
        return date.fromisoformat(bruto), None
    except ValueError:
        return None, erro("Use o formato AAAA-MM-DD no parâmetro data.", 400)


def _excecao(compromisso_id, data_original):
    return CompromissoExcecao.query.filter_by(
        compromisso_id=compromisso_id, data_original=data_original
    ).first()


@bp_compromissos.delete("/<int:id>/ocorrencia")
@login_required
def cancelar_ocorrencia(id):
    """Cancela um único dia da série, em vez de apagar tudo."""
    compromisso = db.session.get(Compromisso, id)
    if not compromisso:
        return erro("Compromisso não encontrado.", 404)

    data_original, falha = _data_da_ocorrencia()
    if falha:
        return falha

    excecao = _excecao(id, data_original)
    if excecao:
        excecao.cancelada = True
        excecao.novo_inicio = None
        excecao.novo_fim = None
    else:
        db.session.add(
            CompromissoExcecao(
                compromisso_id=id, data_original=data_original, cancelada=True
            )
        )

    # O lembrete daquele dia deixa de fazer sentido; a próxima
    # materialização não o recria, porque a ocorrência sumiu.
    apagar_da_origem("compromisso", id)
    db.session.commit()
    return ok()


@bp_compromissos.put("/<int:id>/ocorrencia")
@login_required
def remarcar_ocorrencia(id):
    """Move um único dia da série — é o que o arrastar do calendário faz."""
    compromisso = db.session.get(Compromisso, id)
    if not compromisso:
        return erro("Compromisso não encontrado.", 404)

    data_original, falha = _data_da_ocorrencia()
    if falha:
        return falha

    v = Validador(request.get_json(silent=True))
    novo_inicio = v.data_hora("inicio", obrigatorio=True)
    novo_fim = v.data_hora("fim")
    v.finalizar()

    excecao = _excecao(id, data_original)
    if not excecao:
        excecao = CompromissoExcecao(compromisso_id=id, data_original=data_original)
        db.session.add(excecao)

    excecao.cancelada = False
    excecao.novo_inicio = novo_inicio
    excecao.novo_fim = novo_fim

    apagar_da_origem("compromisso", id)
    db.session.commit()
    return ok(excecao.to_dict())


@bp_compromissos.delete("/<int:id>/ocorrencia/restaurar")
@login_required
def restaurar_ocorrencia(id):
    """Desfaz um cancelamento ou remarcação daquele dia."""
    data_original, falha = _data_da_ocorrencia()
    if falha:
        return falha

    excecao = _excecao(id, data_original)
    if excecao:
        db.session.delete(excecao)
        db.session.commit()
    return ok()


# ═══════════════════════ agenda unificada ═══════════════════════


@bp_agenda.get("/eventos")
@login_required
def eventos():
    """Tudo o que aparece no calendário, no formato do FullCalendar.

    Junta três fontes numa resposta só: compromissos já expandidos em
    ocorrências, escalas de cerimoniário e eventos da paróquia.
    Filtre com ?tipos=compromisso,escala,evento.
    """
    inicio, fim = _intervalo_da_query()
    if inicio is None or fim is None:
        return erro("Use o formato AAAA-MM-DD em inicio e fim.", 400)
    if fim < inicio:
        return erro("O fim do intervalo não pode ser antes do início.", 400)
    if (fim - inicio).days > 400:
        return erro("Consulte no máximo 400 dias por vez.", 400)

    tipos = request.args.get("tipos")
    tipos = set(tipos.split(",")) if tipos else {"compromisso", "escala", "evento"}
    categoria_id = request.args.get("categoria_id", type=int)

    saida = []

    if "compromisso" in tipos:
        query = Compromisso.query
        if categoria_id:
            query = query.filter(Compromisso.categoria_id == categoria_id)

        for compromisso, ocorrencia in expandir_varios(query.all(), inicio, fim):
            cor = compromisso.categoria.cor if compromisso.categoria else "#4A6FA5"
            saida.append(
                {
                    # O id carrega a data da ocorrência: é o que permite
                    # editar ou cancelar um dia só da série.
                    "id": f"compromisso:{compromisso.id}:{ocorrencia['data_original']}",
                    "title": compromisso.titulo,
                    "start": ocorrencia["inicio"],
                    "end": ocorrencia["fim"],
                    "allDay": compromisso.dia_inteiro,
                    "backgroundColor": cor,
                    "borderColor": cor,
                    "textColor": _cor_do_texto(cor),
                    "extendedProps": {
                        "tipo": "compromisso",
                        "registro_id": compromisso.id,
                        "data_original": ocorrencia["data_original"],
                        "recorrente": compromisso.recorrencia != "nenhuma",
                        "remarcada": ocorrencia["remarcada"],
                        "local": compromisso.local,
                        "descricao": compromisso.descricao,
                        "categoria": (
                            compromisso.categoria.nome if compromisso.categoria else None
                        ),
                    },
                }
            )

    if "escala" in tipos:
        escalas = IgrejaEscala.query.filter(IgrejaEscala.data.between(inicio, fim)).all()
        for escala in escalas:
            saida.append(
                {
                    "id": f"escala:{escala.id}",
                    "title": f"⛪ {escala.celebracao}"
                    + (f" — {escala.funcao}" if escala.funcao else ""),
                    "start": escala.inicio,
                    "end": None,
                    "allDay": False,
                    "backgroundColor": COR_ESCALA,
                    "borderColor": COR_ESCALA,
                    "textColor": _cor_do_texto(COR_ESCALA),
                    "extendedProps": {
                        "tipo": "escala",
                        "registro_id": escala.id,
                        "local": escala.local,
                        "status": escala.status,
                        "funcao": escala.funcao,
                        "descricao": escala.observacoes,
                    },
                }
            )

    if "evento" in tipos:
        eventos_igreja = IgrejaEvento.query.filter(
            IgrejaEvento.data_hora >= datetime.combine(inicio, time.min),
            IgrejaEvento.data_hora <= datetime.combine(fim, time.max),
        ).all()
        for evento in eventos_igreja:
            saida.append(
                {
                    "id": f"evento:{evento.id}",
                    "title": evento.titulo,
                    "start": evento.data_hora,
                    "end": None,
                    "allDay": False,
                    "backgroundColor": COR_EVENTO,
                    "borderColor": COR_EVENTO,
                    "textColor": _cor_do_texto(COR_EVENTO),
                    "extendedProps": {
                        "tipo": "evento",
                        "registro_id": evento.id,
                        "local": evento.local,
                        "subtipo": evento.tipo,
                        "descricao": evento.descricao,
                    },
                }
            )

    saida.sort(key=lambda e: e["start"])
    return ok(saida)
