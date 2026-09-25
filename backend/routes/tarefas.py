"""Tarefas, com duas visões: kanban e tabela.

As subtarefas vêm e vão aninhadas no corpo da tarefa — o frontend nunca
as manipula por rota própria, o que mantém o checklist consistente numa
só transação.
"""

from datetime import date, datetime

from flask import Blueprint, request
from flask_login import login_required

import constants
from database import db
from models import Subtarefa, Tarefa
from services.lembretes import apagar_da_origem
from utils.respostas import criado, erro, ok
from utils.validacao import Validador

bp = Blueprint("tarefas", __name__)


def _ler(dados):
    v = Validador(dados)
    campos = {
        "titulo": v.texto("titulo", obrigatorio=True, max_len=200),
        "descricao": v.texto("descricao"),
        "status": v.escolha("status", constants.STATUS_TAREFA, default="a_fazer"),
        "prioridade": v.escolha("prioridade", constants.PRIORIDADES, default="media"),
        "prazo": v.data("prazo"),
        "modulo": v.escolha("modulo", constants.MODULOS, default="geral"),
    }

    # As tags chegam como lista do frontend e são guardadas separadas por
    # vírgula, conforme o modelo do planejamento.
    tags = dados.get("tags") if isinstance(dados, dict) else None
    if isinstance(tags, list):
        limpas = [str(t).strip() for t in tags if str(t).strip()]
        campos["tags"] = ",".join(limpas)[:255] or None
    elif isinstance(tags, str):
        campos["tags"] = tags.strip()[:255] or None

    v.finalizar()
    return campos


def _sincronizar_subtarefas(tarefa, dados):
    """Reescreve o checklist a partir da lista enviada.

    Subtarefas com id são atualizadas; as sem id, criadas; as que não
    vieram, removidas. Assim o cliente manda o estado final e não
    precisa orquestrar três chamadas.
    """
    if not isinstance(dados, dict) or "subtarefas" not in dados:
        return

    enviadas = dados.get("subtarefas") or []
    if not isinstance(enviadas, list):
        return

    existentes = {s.id: s for s in tarefa.subtarefas}
    mantidos = set()

    for item in enviadas:
        if not isinstance(item, dict):
            continue
        titulo = str(item.get("titulo") or "").strip()
        if not titulo:
            continue

        concluida = bool(item.get("concluida"))
        identificador = item.get("id")

        if identificador in existentes:
            sub = existentes[identificador]
            sub.titulo = titulo[:200]
            sub.concluida = concluida
            mantidos.add(identificador)
        else:
            tarefa.subtarefas.append(
                Subtarefa(titulo=titulo[:200], concluida=concluida)
            )

    for identificador, sub in existentes.items():
        if identificador not in mantidos:
            db.session.delete(sub)


def _marcar_conclusao(tarefa, status_anterior):
    """Carimba concluida_em ao entrar em 'feito' e limpa ao sair."""
    if tarefa.status == "feito" and status_anterior != "feito":
        tarefa.concluida_em = datetime.now()
    elif tarefa.status != "feito":
        tarefa.concluida_em = None


# ─────────────────────────── leitura ───────────────────────────


@bp.get("")
@login_required
def listar():
    """Filtros: ?status= ?modulo= ?prioridade= ?tag= ?atrasadas=1 ?busca=."""
    query = Tarefa.query

    for parametro, coluna, permitidos in (
        ("status", Tarefa.status, constants.STATUS_TAREFA),
        ("modulo", Tarefa.modulo, constants.MODULOS),
        ("prioridade", Tarefa.prioridade, constants.PRIORIDADES),
    ):
        valor = request.args.get(parametro)
        if valor:
            if valor not in permitidos:
                return erro(f"Valor não permitido em {parametro}.", 400)
            query = query.filter(coluna == valor)

    tag = request.args.get("tag")
    if tag:
        query = query.filter(Tarefa.tags.like(f"%{tag}%"))

    busca = request.args.get("busca")
    if busca:
        alvo = f"%{busca}%"
        query = query.filter(
            db.or_(Tarefa.titulo.like(alvo), Tarefa.descricao.like(alvo))
        )

    if request.args.get("atrasadas") in ("1", "true"):
        query = query.filter(Tarefa.prazo < date.today(), Tarefa.status != "feito")

    # Ordem do kanban: a coluna manda, depois a posição arrastada.
    tarefas = query.order_by(Tarefa.ordem, Tarefa.id.desc()).all()
    return ok([t.to_dict() for t in tarefas])


@bp.get("/tags")
@login_required
def listar_tags():
    """Todas as tags em uso, para o filtro e o autocompletar."""
    linhas = db.session.query(Tarefa.tags).filter(Tarefa.tags.isnot(None)).all()
    tags = set()
    for (texto,) in linhas:
        tags.update(t.strip() for t in (texto or "").split(",") if t.strip())
    return ok(sorted(tags))


@bp.get("/<int:id>")
@login_required
def obter(id):
    tarefa = db.session.get(Tarefa, id)
    if not tarefa:
        return erro("Tarefa não encontrada.", 404)
    return ok(tarefa.to_dict())


# ─────────────────────────── escrita ───────────────────────────


@bp.post("")
@login_required
def criar():
    dados = request.get_json(silent=True)
    tarefa = Tarefa(**_ler(dados))

    # Nova tarefa vai para o topo da sua coluna.
    menor = db.session.query(db.func.min(Tarefa.ordem)).scalar()
    tarefa.ordem = (menor or 0) - 1

    _sincronizar_subtarefas(tarefa, dados)
    _marcar_conclusao(tarefa, None)

    db.session.add(tarefa)
    db.session.commit()
    return criado(tarefa.to_dict())


@bp.put("/<int:id>")
@login_required
def atualizar(id):
    tarefa = db.session.get(Tarefa, id)
    if not tarefa:
        return erro("Tarefa não encontrada.", 404)

    dados = request.get_json(silent=True)
    status_anterior = tarefa.status

    for campo, valor in _ler(dados).items():
        setattr(tarefa, campo, valor)

    _sincronizar_subtarefas(tarefa, dados)
    _marcar_conclusao(tarefa, status_anterior)

    # O prazo pode ter mudado; os lembretes são refeitos na materialização.
    apagar_da_origem("tarefa", tarefa.id)
    db.session.commit()
    return ok(tarefa.to_dict())


@bp.patch("/<int:id>/status")
@login_required
def mudar_status(id):
    tarefa = db.session.get(Tarefa, id)
    if not tarefa:
        return erro("Tarefa não encontrada.", 404)

    v = Validador(request.get_json(silent=True))
    status = v.escolha("status", constants.STATUS_TAREFA, obrigatorio=True)
    v.finalizar()

    anterior = tarefa.status
    tarefa.status = status
    _marcar_conclusao(tarefa, anterior)
    db.session.commit()
    return ok(tarefa.to_dict())


@bp.patch("/reordenar")
@login_required
def reordenar():
    """Persiste o arrastar do kanban: [{id, status, ordem}, ...].

    Tudo numa transação só — uma reordenação pela metade deixaria o
    quadro numa ordem que o usuário não escolheu.
    """
    v = Validador(request.get_json(silent=True))
    itens = v.lista("tarefas", obrigatorio=True)
    v.finalizar()

    if len(itens) > 500:
        return erro("Reordene no máximo 500 tarefas por vez.", 400)

    ids = [item.get("id") for item in itens if isinstance(item, dict)]
    tarefas = {t.id: t for t in Tarefa.query.filter(Tarefa.id.in_(ids)).all()}

    for posicao, item in enumerate(itens):
        if not isinstance(item, dict):
            continue
        tarefa = tarefas.get(item.get("id"))
        if not tarefa:
            continue

        novo_status = item.get("status")
        if novo_status in constants.STATUS_TAREFA and novo_status != tarefa.status:
            anterior = tarefa.status
            tarefa.status = novo_status
            _marcar_conclusao(tarefa, anterior)

        ordem = item.get("ordem")
        tarefa.ordem = ordem if isinstance(ordem, int) else posicao

    db.session.commit()
    return ok({"atualizadas": len(tarefas)})


@bp.patch("/<int:id>/subtarefas/<int:subtarefa_id>")
@login_required
def alternar_subtarefa(id, subtarefa_id):
    """Marcar um item do checklist sem reenviar a tarefa inteira."""
    sub = db.session.get(Subtarefa, subtarefa_id)
    if not sub or sub.tarefa_id != id:
        return erro("Subtarefa não encontrada.", 404)

    sub.concluida = not sub.concluida
    db.session.commit()
    return ok(sub.tarefa.to_dict())


@bp.delete("/<int:id>")
@login_required
def apagar(id):
    tarefa = db.session.get(Tarefa, id)
    if not tarefa:
        return erro("Tarefa não encontrada.", 404)

    apagar_da_origem("tarefa", tarefa.id)
    db.session.delete(tarefa)  # as subtarefas caem por cascade
    db.session.commit()
    return ok()
