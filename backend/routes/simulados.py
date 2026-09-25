"""Simulados, correção automática e caderno de erros."""

from datetime import date

from flask import Blueprint, request
from flask_login import login_required

import constants
from database import db
from models import (
    Arquivo,
    CadernoErro,
    Disciplina,
    Simulado,
    SimuladoQuestao,
)
from services.correcao import corrigir, evolucao
from utils.respostas import criado, erro, ok
from utils.validacao import ErroValidacao, Validador

bp_simulados = Blueprint("simulados", __name__)
bp_erros = Blueprint("caderno_erros", __name__)

ALTERNATIVAS_VALIDAS = set(constants.ALTERNATIVAS) | set(
    constants.ALTERNATIVAS_CERTO_ERRADO
)


def _disciplinas():
    return {d.id: d for d in Disciplina.query.all()}


# ═══════════════════════ simulados ═══════════════════════


@bp_simulados.get("")
@login_required
def listar():
    """Listagem com acertos agregados em SQL.

    As properties acertos/validas do modelo carregariam todas as
    questões de todos os simulados — o N+1 que o plano mandou evitar.
    """
    contagem = (
        db.session.query(
            SimuladoQuestao.simulado_id.label("simulado_id"),
            db.func.sum(
                db.case((SimuladoQuestao.anulada.is_(False), 1), else_=0)
            ).label("validas"),
            db.func.sum(
                db.case(
                    (
                        db.and_(
                            SimuladoQuestao.anulada.is_(False),
                            SimuladoQuestao.resposta.isnot(None),
                            SimuladoQuestao.gabarito.isnot(None),
                            db.func.upper(SimuladoQuestao.resposta)
                            == db.func.upper(SimuladoQuestao.gabarito),
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("acertos"),
        )
        .group_by(SimuladoQuestao.simulado_id)
        .subquery()
    )

    linhas = (
        db.session.query(contagem.c.acertos, contagem.c.validas, Simulado)
        .select_from(Simulado)
        .outerjoin(contagem, contagem.c.simulado_id == Simulado.id)
        .order_by(Simulado.data.desc())
        .all()
    )

    saida = []
    for acertos, validas, simulado in linhas:
        dados = simulado.to_dict()
        dados["acertos"] = int(acertos or 0)
        dados["validas"] = int(validas or 0)
        dados["percentual"] = (
            round(int(acertos or 0) / int(validas) * 100, 1) if validas else None
        )
        saida.append(dados)

    return ok(saida)


@bp_simulados.get("/evolucao")
@login_required
def serie_evolucao():
    """Percentual ao longo do tempo, para o gráfico."""
    linhas = (
        db.session.query(Simulado)
        .order_by(Simulado.data)
        .all()
    )
    # Poucos simulados por ano: carregar as questões aqui é aceitável e
    # mantém a regra de correção num lugar só.
    return ok(
        evolucao([(s, s.acertos, s.validas) for s in linhas])
    )


@bp_simulados.get("/desempenho")
@login_required
def desempenho_por_disciplina():
    """Acertos por disciplina somando todos os simulados.

    Agregado em SQL: percorrer os simulados em Python carregaria todas
    as questões de todos eles.
    """
    linhas = (
        db.session.query(
            SimuladoQuestao.disciplina_id,
            db.func.sum(
                db.case((SimuladoQuestao.anulada.is_(False), 1), else_=0)
            ).label("validas"),
            db.func.sum(
                db.case(
                    (
                        db.and_(
                            SimuladoQuestao.anulada.is_(False),
                            SimuladoQuestao.resposta.isnot(None),
                            SimuladoQuestao.gabarito.isnot(None),
                            db.func.upper(SimuladoQuestao.resposta)
                            == db.func.upper(SimuladoQuestao.gabarito),
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("acertos"),
        )
        .group_by(SimuladoQuestao.disciplina_id)
        .all()
    )

    disciplinas = _disciplinas()
    saida = []
    for disciplina_id, validas, acertos in linhas:
        validas = int(validas or 0)
        acertos = int(acertos or 0)
        if not validas:
            continue
        disciplina = disciplinas.get(disciplina_id)
        saida.append(
            {
                "disciplina_id": disciplina_id,
                "nome": disciplina.nome if disciplina else "Sem disciplina",
                "cor": disciplina.cor if disciplina else "#7A7568",
                "acertos": acertos,
                "validas": validas,
                "percentual": round(acertos / validas * 100, 1),
            }
        )

    # Pior primeiro: é por onde começar a revisão.
    saida.sort(key=lambda d: d["percentual"])
    return ok(saida)


@bp_simulados.get("/<int:id>")
@login_required
def obter(id):
    simulado = db.session.get(Simulado, id)
    if not simulado:
        return erro("Simulado não encontrado.", 404)
    return ok(simulado.to_dict(com_questoes=True))


@bp_simulados.get("/<int:id>/resultado")
@login_required
def resultado(id):
    simulado = db.session.get(Simulado, id)
    if not simulado:
        return erro("Simulado não encontrado.", 404)
    return ok(corrigir(simulado, _disciplinas()))


@bp_simulados.post("")
@login_required
def criar():
    """Cria o simulado e já gera as questões numeradas de 1 a N."""
    v = Validador(request.get_json(silent=True))
    campos = {
        "titulo": v.texto("titulo", obrigatorio=True, max_len=200),
        "banca": v.texto("banca", max_len=100),
        "data": v.data("data", obrigatorio=True),
        "total_questoes": v.inteiro(
            "total_questoes", obrigatorio=True, minimo=1, maximo=500
        ),
        "arquivo_id": v.inteiro("arquivo_id", minimo=1),
    }
    v.finalizar()

    if campos["arquivo_id"] and not db.session.get(Arquivo, campos["arquivo_id"]):
        return erro("Dados inválidos.", 400, {"arquivo_id": "Arquivo não encontrado."})

    simulado = Simulado(**campos)
    db.session.add(simulado)
    db.session.flush()  # precisa do id para as questões

    for numero in range(1, campos["total_questoes"] + 1):
        db.session.add(SimuladoQuestao(simulado_id=simulado.id, numero=numero))

    db.session.commit()
    return criado(simulado.to_dict(com_questoes=True))


@bp_simulados.put("/<int:id>")
@login_required
def atualizar(id):
    simulado = db.session.get(Simulado, id)
    if not simulado:
        return erro("Simulado não encontrado.", 404)

    v = Validador(request.get_json(silent=True))
    titulo = v.texto("titulo", max_len=200)
    banca = v.texto("banca", max_len=100)
    data_prova = v.data("data")
    arquivo_id = v.inteiro("arquivo_id", minimo=1)
    v.finalizar()

    if titulo:
        simulado.titulo = titulo
    if banca is not None:
        simulado.banca = banca
    if data_prova:
        simulado.data = data_prova
    if arquivo_id:
        simulado.arquivo_id = arquivo_id

    db.session.commit()
    return ok(simulado.to_dict())


@bp_simulados.delete("/<int:id>")
@login_required
def apagar(id):
    simulado = db.session.get(Simulado, id)
    if not simulado:
        return erro("Simulado não encontrado.", 404)
    db.session.delete(simulado)  # as questões caem por cascade
    db.session.commit()
    return ok()


# ─────────────── gabarito, respostas e disciplinas ───────────────


def _aplicar_em_lote(simulado, itens, campo):
    """Grava uma lista [{numero, valor}] no campo indicado das questões."""
    questoes = {q.numero: q for q in simulado.questoes}
    erros = {}
    alteradas = 0

    for item in itens:
        if not isinstance(item, dict):
            continue

        numero = item.get("numero")
        questao = questoes.get(numero)
        if not questao:
            erros[f"questao[{numero}]"] = "Número fora do simulado."
            continue

        # "anulada" vem junto no mesmo lote do gabarito.
        if "anulada" in item:
            questao.anulada = bool(item["anulada"])

        if campo in item:
            valor = item[campo]
            if valor in (None, ""):
                setattr(questao, campo, None)
            else:
                letra = str(valor).strip().upper()
                if letra not in ALTERNATIVAS_VALIDAS:
                    erros[f"questao[{numero}]"] = (
                        "Use " + ", ".join(sorted(ALTERNATIVAS_VALIDAS)) + "."
                    )
                    continue
                setattr(questao, campo, letra)
            alteradas += 1

    if erros:
        raise ErroValidacao(erros)
    return alteradas


@bp_simulados.put("/<int:id>/gabarito")
@login_required
def lancar_gabarito(id):
    """Corpo: {"questoes": [{"numero": 1, "gabarito": "A", "anulada": false}]}."""
    simulado = db.session.get(Simulado, id)
    if not simulado:
        return erro("Simulado não encontrado.", 404)

    v = Validador(request.get_json(silent=True))
    itens = v.lista("questoes", obrigatorio=True)
    v.finalizar()

    alteradas = _aplicar_em_lote(simulado, itens, "gabarito")
    db.session.commit()
    return ok({"alteradas": alteradas})


@bp_simulados.put("/<int:id>/respostas")
@login_required
def lancar_respostas(id):
    """Corpo: {"questoes": [{"numero": 1, "resposta": "C"}]}."""
    simulado = db.session.get(Simulado, id)
    if not simulado:
        return erro("Simulado não encontrado.", 404)

    v = Validador(request.get_json(silent=True))
    itens = v.lista("questoes", obrigatorio=True)
    v.finalizar()

    alteradas = _aplicar_em_lote(simulado, itens, "resposta")
    db.session.commit()
    return ok({"alteradas": alteradas})


@bp_simulados.put("/<int:id>/disciplinas")
@login_required
def marcar_disciplinas(id):
    """Corpo: {"questoes": [{"numero": 1, "disciplina_id": 3}]}.

    Também aceita {"faixas": [{"de": 1, "ate": 20, "disciplina_id": 3}]},
    que é como se preenche uma prova inteira em poucos cliques.
    """
    simulado = db.session.get(Simulado, id)
    if not simulado:
        return erro("Simulado não encontrado.", 404)

    dados = request.get_json(silent=True) or {}
    questoes = {q.numero: q for q in simulado.questoes}
    validas = {d.id for d in Disciplina.query.all()}
    alteradas = 0

    for faixa in dados.get("faixas") or []:
        if not isinstance(faixa, dict):
            continue
        disciplina_id = faixa.get("disciplina_id")
        if disciplina_id is not None and disciplina_id not in validas:
            return erro("Disciplina não encontrada.", 400)
        for numero in range(int(faixa.get("de", 0)), int(faixa.get("ate", -1)) + 1):
            if numero in questoes:
                questoes[numero].disciplina_id = disciplina_id
                alteradas += 1

    for item in dados.get("questoes") or []:
        if not isinstance(item, dict):
            continue
        questao = questoes.get(item.get("numero"))
        if not questao:
            continue
        disciplina_id = item.get("disciplina_id")
        if disciplina_id is not None and disciplina_id not in validas:
            return erro("Disciplina não encontrada.", 400)
        questao.disciplina_id = disciplina_id
        alteradas += 1

    db.session.commit()
    return ok({"alteradas": alteradas})


# ═══════════════════════ caderno de erros ═══════════════════════


@bp_erros.get("")
@login_required
def listar_erros():
    """Filtros: ?disciplina_id= ?motivo= ?revisado=0|1."""
    query = CadernoErro.query

    disciplina_id = request.args.get("disciplina_id", type=int)
    if disciplina_id:
        query = query.filter(CadernoErro.disciplina_id == disciplina_id)

    motivo = request.args.get("motivo")
    if motivo:
        if motivo not in constants.MOTIVOS_ERRO:
            return erro("Motivo não permitido.", 400)
        query = query.filter(CadernoErro.motivo == motivo)

    revisado = request.args.get("revisado")
    if revisado in ("0", "1"):
        query = query.filter(CadernoErro.revisado.is_(revisado == "1"))

    disciplinas = _disciplinas()
    registros = query.order_by(
        CadernoErro.revisado, CadernoErro.criado_em.desc()
    ).all()

    saida = []
    for registro in registros:
        dados = registro.to_dict()
        disciplina = disciplinas.get(registro.disciplina_id)
        dados["disciplina"] = disciplina.to_dict() if disciplina else None
        saida.append(dados)

    return ok(saida)


@bp_erros.get("/resumo")
@login_required
def resumo_erros():
    """Contagem por motivo e por disciplina, para os contadores."""
    por_motivo = dict(
        db.session.query(CadernoErro.motivo, db.func.count(CadernoErro.id))
        .group_by(CadernoErro.motivo)
        .all()
    )
    contagem = {motivo: por_motivo.get(motivo, 0) for motivo in constants.MOTIVOS_ERRO}

    pendentes = CadernoErro.query.filter(CadernoErro.revisado.is_(False)).count()
    return ok(
        {
            "por_motivo": contagem,
            "pendentes": pendentes,
            "total": CadernoErro.query.count(),
        }
    )


@bp_erros.post("")
@login_required
def criar_erro():
    """Cria o registro a partir de uma questão errada, num clique.

    Quando vem `questao_id`, a disciplina é herdada da questão.
    """
    v = Validador(request.get_json(silent=True))
    campos = {
        "questao_id": v.inteiro("questao_id", minimo=1),
        "disciplina_id": v.inteiro("disciplina_id", minimo=1),
        "resumo_questao": v.texto("resumo_questao"),
        "motivo": v.escolha("motivo", constants.MOTIVOS_ERRO),
        "explicacao": v.texto("explicacao"),
        "revisado": v.booleano("revisado"),
    }
    v.finalizar()

    if campos["questao_id"]:
        questao = db.session.get(SimuladoQuestao, campos["questao_id"])
        if not questao:
            return erro("Dados inválidos.", 400, {"questao_id": "Questão não encontrada."})
        if not campos["disciplina_id"]:
            campos["disciplina_id"] = questao.disciplina_id
        if not campos["resumo_questao"]:
            campos["resumo_questao"] = (
                f"Questão {questao.numero} — gabarito {questao.gabarito or '?'}, "
                f"respondi {questao.resposta or 'em branco'}"
            )

        # Não duplica: a mesma questão só entra uma vez no caderno.
        existente = CadernoErro.query.filter_by(
            questao_id=campos["questao_id"]
        ).first()
        if existente:
            return erro("Esta questão já está no caderno de erros.", 409)

    registro = CadernoErro(**campos)
    db.session.add(registro)
    db.session.commit()
    return criado(registro.to_dict())


@bp_erros.put("/<int:id>")
@login_required
def atualizar_erro(id):
    registro = db.session.get(CadernoErro, id)
    if not registro:
        return erro("Registro não encontrado.", 404)

    v = Validador(request.get_json(silent=True))
    campos = {
        "resumo_questao": v.texto("resumo_questao"),
        "motivo": v.escolha("motivo", constants.MOTIVOS_ERRO),
        "explicacao": v.texto("explicacao"),
        "disciplina_id": v.inteiro("disciplina_id", minimo=1),
    }
    revisado = v.booleano("revisado", default=registro.revisado)
    v.finalizar()

    for campo, valor in campos.items():
        if valor is not None:
            setattr(registro, campo, valor)
    registro.revisado = revisado

    db.session.commit()
    return ok(registro.to_dict())


@bp_erros.patch("/<int:id>/revisado")
@login_required
def alternar_revisado(id):
    registro = db.session.get(CadernoErro, id)
    if not registro:
        return erro("Registro não encontrado.", 404)
    registro.revisado = not registro.revisado
    db.session.commit()
    return ok(registro.to_dict())


@bp_erros.delete("/<int:id>")
@login_required
def apagar_erro(id):
    registro = db.session.get(CadernoErro, id)
    if not registro:
        return erro("Registro não encontrado.", 404)
    db.session.delete(registro)
    db.session.commit()
    return ok()
