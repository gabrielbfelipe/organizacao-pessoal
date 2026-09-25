"""Correção automática de simulados.

Regras, todas verificadas em tests/test_correcao.py:

- Questão anulada sai do total. Um simulado de 60 com 3 anuladas é
  avaliado sobre 57 — é assim que as bancas fazem.
- Questão em branco conta como erro no percentual, mas é contada à
  parte, porque errar por não saber e deixar em branco são coisas
  diferentes na hora de estudar.
- A comparação ignora caixa, então "a" e "A" são a mesma resposta.
  Serve igual para provas A–E e para certo/errado (C/E).
"""


def _normalizar(valor):
    return (valor or "").strip().upper() or None


def avaliar_questao(questao):
    """Devolve 'anulada', 'branco', 'acerto' ou 'erro'."""
    if questao.anulada:
        return "anulada"

    resposta = _normalizar(questao.resposta)
    if resposta is None:
        return "branco"

    gabarito = _normalizar(questao.gabarito)
    if gabarito is None:
        # Sem gabarito lançado não há como julgar: não é acerto nem erro.
        return "sem_gabarito"

    return "acerto" if resposta == gabarito else "erro"


def _bloco_vazio():
    return {
        "total": 0,
        "validas": 0,
        "acertos": 0,
        "erros": 0,
        "brancos": 0,
        "anuladas": 0,
        "sem_gabarito": 0,
        "percentual": None,
    }


def _fechar(bloco):
    """Calcula o percentual sobre as questões válidas."""
    if bloco["validas"]:
        bloco["percentual"] = round(bloco["acertos"] / bloco["validas"] * 100, 1)
    return bloco


def corrigir(simulado, disciplinas=None):
    """Resultado completo de um simulado, geral e por disciplina.

    `disciplinas` é um dicionário {id: Disciplina} para dar nome e cor
    aos blocos sem uma consulta por questão.
    """
    disciplinas = disciplinas or {}

    geral = _bloco_vazio()
    por_disciplina = {}
    erradas = []

    for questao in simulado.questoes:
        situacao = avaliar_questao(questao)

        chave = questao.disciplina_id
        bloco = por_disciplina.setdefault(chave, _bloco_vazio())

        for alvo in (geral, bloco):
            alvo["total"] += 1

        if situacao == "anulada":
            for alvo in (geral, bloco):
                alvo["anuladas"] += 1
            continue

        if situacao == "sem_gabarito":
            for alvo in (geral, bloco):
                alvo["sem_gabarito"] += 1
            continue

        # A partir daqui a questão entra no denominador.
        for alvo in (geral, bloco):
            alvo["validas"] += 1

        if situacao == "acerto":
            for alvo in (geral, bloco):
                alvo["acertos"] += 1
        else:
            for alvo in (geral, bloco):
                alvo["erros"] += 1
                if situacao == "branco":
                    alvo["brancos"] += 1
            erradas.append(questao)

    saida_disciplinas = []
    for disciplina_id, bloco in por_disciplina.items():
        disciplina = disciplinas.get(disciplina_id)
        saida_disciplinas.append(
            {
                "disciplina_id": disciplina_id,
                "nome": disciplina.nome if disciplina else "Sem disciplina",
                "cor": disciplina.cor if disciplina else "#7A7568",
                **_fechar(bloco),
            }
        )

    # Pior desempenho primeiro: é o que interessa olhar depois da prova.
    saida_disciplinas.sort(
        key=lambda d: (d["percentual"] is None, d["percentual"] or 0)
    )

    return {
        "simulado": simulado.to_dict(),
        "geral": _fechar(geral),
        "por_disciplina": saida_disciplinas,
        "questoes_erradas": [q.to_dict() for q in erradas],
    }


def evolucao(simulados_com_contagem):
    """Série temporal de percentual, para o gráfico de evolução.

    Recebe tuplas (simulado, acertos, validas) vindas de uma agregação
    em SQL — não das properties do modelo, que carregariam todas as
    questões de todos os simulados da lista.
    """
    pontos = []
    for simulado, acertos, validas in simulados_com_contagem:
        pontos.append(
            {
                "id": simulado.id,
                "titulo": simulado.titulo,
                "data": simulado.data,
                "banca": simulado.banca,
                "acertos": acertos or 0,
                "validas": validas or 0,
                "percentual": (
                    round((acertos or 0) / validas * 100, 1) if validas else None
                ),
            }
        )
    pontos.sort(key=lambda p: p["data"])
    return pontos
