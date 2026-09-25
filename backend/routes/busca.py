"""Busca global (Ctrl+K).

Varre as tabelas de texto num só request. O LIKE roda sobre a collation
utf8mb4_unicode_ci do banco, que já ignora caixa e acento — buscar
"oracao" encontra "Oração" sem nenhum trabalho extra aqui.
"""

from flask import Blueprint, request
from flask_login import login_required

from database import db
from models import (
    Anotacao,
    Aviso,
    Arquivo,
    Compromisso,
    Disciplina,
    IgrejaEscala,
    IgrejaEvento,
    Livro,
    Oracao,
    Tarefa,
)
from utils.respostas import ok

bp = Blueprint("busca", __name__)

# Quantos resultados por tipo. O suficiente para a paleta, sem despejar
# o banco inteiro na tela.
POR_TIPO = 6


def _trecho(texto, termo, tamanho=110):
    """Recorta o texto em volta da primeira ocorrência do termo."""
    if not texto:
        return None

    limpo = " ".join(str(texto).split())
    posicao = limpo.lower().find(termo.lower())

    if posicao < 0:
        return limpo[:tamanho] + ("…" if len(limpo) > tamanho else "")

    inicio = max(0, posicao - 35)
    fim = min(len(limpo), inicio + tamanho)
    return ("…" if inicio else "") + limpo[inicio:fim] + ("…" if fim < len(limpo) else "")


@bp.get("")
@login_required
def buscar():
    termo = (request.args.get("q") or "").strip()
    if len(termo) < 2:
        return ok({"termo": termo, "total": 0, "grupos": []})

    alvo = f"%{termo}%"
    grupos = []

    def grupo(chave, rotulo, icone, itens):
        if itens:
            grupos.append(
                {"tipo": chave, "rotulo": rotulo, "icone": icone, "itens": itens}
            )

    # ── Tarefas ──
    grupo(
        "tarefa",
        "Tarefas",
        "check-square",
        [
            {
                "id": t.id,
                "titulo": t.titulo,
                "trecho": _trecho(t.descricao, termo),
                "url": "/pages/tarefas.html",
                "marca": t.status,
            }
            for t in Tarefa.query.filter(
                db.or_(Tarefa.titulo.like(alvo), Tarefa.descricao.like(alvo))
            )
            .order_by(Tarefa.status, Tarefa.prazo)
            .limit(POR_TIPO)
            .all()
        ],
    )

    # ── Anotações ──
    grupo(
        "anotacao",
        "Anotações",
        "notebook-pen",
        [
            {
                "id": a.id,
                "titulo": a.titulo,
                "trecho": _trecho(a.conteudo_md, termo),
                "url": f"/pages/{a.modulo}-anotacoes.html"
                if a.modulo in ("igreja", "estudos")
                else "/pages/igreja-anotacoes.html",
                "marca": a.modulo,
            }
            for a in Anotacao.query.filter(
                db.or_(Anotacao.titulo.like(alvo), Anotacao.conteudo_md.like(alvo))
            )
            .order_by(Anotacao.atualizado_em.desc())
            .limit(POR_TIPO)
            .all()
        ],
    )

    # ── Orações ──
    grupo(
        "oracao",
        "Orações",
        "book-open",
        [
            {
                "id": o.id,
                "titulo": o.titulo,
                "trecho": _trecho(o.texto, termo),
                "url": "/pages/igreja-oracoes.html",
                "marca": o.categoria,
            }
            for o in Oracao.query.filter(
                db.or_(Oracao.titulo.like(alvo), Oracao.texto.like(alvo))
            )
            .order_by(Oracao.favorita.desc(), Oracao.titulo)
            .limit(POR_TIPO)
            .all()
        ],
    )

    # ── Materiais ──
    grupo(
        "material",
        "Materiais",
        "folder",
        [
            {
                "id": m.id,
                "titulo": m.nome_original,
                "trecho": m.tema,
                "url": f"/pages/{m.modulo}-materiais.html"
                if m.modulo == "igreja"
                else "/pages/igreja-materiais.html",
                "marca": m.tema,
            }
            for m in Arquivo.query.filter(Arquivo.nome_original.like(alvo))
            .order_by(Arquivo.nome_original)
            .limit(POR_TIPO)
            .all()
        ],
    )

    # ── Livros ──
    grupo(
        "livro",
        "Leituras",
        "library",
        [
            {
                "id": l.id,
                "titulo": l.titulo,
                "trecho": l.autor,
                "url": "/pages/igreja-leituras.html",
                "marca": l.status,
            }
            for l in Livro.query.filter(
                db.or_(Livro.titulo.like(alvo), Livro.autor.like(alvo))
            )
            .order_by(Livro.titulo)
            .limit(POR_TIPO)
            .all()
        ],
    )

    # ── Compromissos ──
    grupo(
        "compromisso",
        "Compromissos",
        "calendar-days",
        [
            {
                "id": c.id,
                "titulo": c.titulo,
                "trecho": _trecho(c.descricao or c.local, termo),
                "url": "/pages/agenda.html",
                "marca": None,
            }
            for c in Compromisso.query.filter(
                db.or_(
                    Compromisso.titulo.like(alvo),
                    Compromisso.descricao.like(alvo),
                    Compromisso.local.like(alvo),
                )
            )
            .order_by(Compromisso.inicio.desc())
            .limit(POR_TIPO)
            .all()
        ],
    )

    # ── Escalas ──
    grupo(
        "escala",
        "Escalas",
        "church",
        [
            {
                "id": e.id,
                "titulo": e.celebracao,
                "trecho": e.funcao,
                "url": "/pages/igreja-escalas.html",
                "marca": e.status,
            }
            for e in IgrejaEscala.query.filter(
                db.or_(
                    IgrejaEscala.celebracao.like(alvo),
                    IgrejaEscala.funcao.like(alvo),
                    IgrejaEscala.observacoes.like(alvo),
                )
            )
            .order_by(IgrejaEscala.data.desc())
            .limit(POR_TIPO)
            .all()
        ],
    )

    # ── Eventos ──
    grupo(
        "evento",
        "Eventos",
        "calendar-heart",
        [
            {
                "id": e.id,
                "titulo": e.titulo,
                "trecho": _trecho(e.descricao or e.local, termo),
                "url": "/pages/igreja-eventos.html",
                "marca": e.tipo,
            }
            for e in IgrejaEvento.query.filter(
                db.or_(
                    IgrejaEvento.titulo.like(alvo),
                    IgrejaEvento.descricao.like(alvo),
                    IgrejaEvento.local.like(alvo),
                )
            )
            .order_by(IgrejaEvento.data_hora.desc())
            .limit(POR_TIPO)
            .all()
        ],
    )

    # ── Avisos ──
    grupo(
        "aviso",
        "Avisos",
        "pin",
        [
            {
                "id": a.id,
                "titulo": a.titulo,
                "trecho": _trecho(a.conteudo, termo),
                "url": "/pages/avisos.html",
                "marca": a.prioridade,
            }
            for a in Aviso.query.filter(
                db.or_(Aviso.titulo.like(alvo), Aviso.conteudo.like(alvo))
            )
            .order_by(Aviso.fixado.desc(), Aviso.criado_em.desc())
            .limit(POR_TIPO)
            .all()
        ],
    )

    # ── Disciplinas ──
    grupo(
        "disciplina",
        "Disciplinas",
        "graduation-cap",
        [
            {
                "id": d.id,
                "titulo": d.nome,
                "trecho": None,
                "url": "/pages/estudos-simulados.html",
                "marca": None,
            }
            for d in Disciplina.query.filter(Disciplina.nome.like(alvo))
            .order_by(Disciplina.nome)
            .limit(POR_TIPO)
            .all()
        ],
    )

    total = sum(len(g["itens"]) for g in grupos)
    return ok({"termo": termo, "total": total, "grupos": grupos})
