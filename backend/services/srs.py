"""Revisão espaçada dos flashcards.

Uma versão enxuta do SM-2: em vez de uma nota de 0 a 5 e um fator de
facilidade por carta, há três botões — fácil, médio, difícil — e um
multiplicador fixo para cada um. É o que o planejamento pede, e é o que
se sustenta sem virar um app de repetição espaçada inteiro.
"""

from datetime import date, timedelta

# Multiplicador aplicado ao intervalo atual.
MULTIPLICADORES = {"facil": 2.5, "medio": 1.5, "dificil": 0.0}

# Intervalo mínimo por dificuldade, em dias.
MINIMOS = {"facil": 2, "medio": 1, "dificil": 1}

# Teto: passar disso é, na prática, arquivar a carta.
INTERVALO_MAXIMO = 180


def proximo_intervalo(intervalo_atual, dificuldade):
    """Novo intervalo em dias, a partir do atual e da dificuldade.

    "Difícil" zera o intervalo: a carta volta no dia seguinte, porque
    espaçar o que não se sabe só adia o problema.
    """
    if dificuldade == "dificil":
        return 1

    atual = max(1, intervalo_atual or 1)
    proposto = round(atual * MULTIPLICADORES[dificuldade])
    return min(INTERVALO_MAXIMO, max(MINIMOS[dificuldade], proposto))


def revisar(flashcard, dificuldade, hoje=None):
    """Aplica a revisão à carta. Devolve a própria carta, já alterada."""
    if dificuldade not in MULTIPLICADORES:
        raise ValueError(f"Dificuldade desconhecida: {dificuldade}")

    hoje = hoje or date.today()

    flashcard.intervalo_dias = proximo_intervalo(
        flashcard.intervalo_dias, dificuldade
    )
    flashcard.ultima_revisao = hoje
    flashcard.proxima_revisao = hoje + timedelta(days=flashcard.intervalo_dias)

    if dificuldade == "dificil":
        flashcard.acertos_seguidos = 0
    else:
        flashcard.acertos_seguidos = (flashcard.acertos_seguidos or 0) + 1

    return flashcard


def agendar_nova(flashcard, hoje=None):
    """Carta recém-criada entra na fila do próprio dia."""
    hoje = hoje or date.today()
    flashcard.intervalo_dias = 1
    flashcard.proxima_revisao = hoje
    flashcard.ultima_revisao = None
    flashcard.acertos_seguidos = 0
    return flashcard
