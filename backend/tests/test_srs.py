"""Testes da revisão espaçada dos flashcards."""

from datetime import date, timedelta

import pytest

from services.srs import INTERVALO_MAXIMO, agendar_nova, proximo_intervalo, revisar

HOJE = date(2026, 9, 24)


class CartaFalsa:
    def __init__(self, intervalo_dias=1, acertos_seguidos=0):
        self.intervalo_dias = intervalo_dias
        self.acertos_seguidos = acertos_seguidos
        self.proxima_revisao = None
        self.ultima_revisao = None


# ─────────────────────── cálculo do intervalo ───────────────────────


def test_dificil_sempre_volta_no_dia_seguinte():
    """Espaçar o que não se sabe só adia o problema."""
    for intervalo in (1, 5, 30, 180):
        assert proximo_intervalo(intervalo, "dificil") == 1


@pytest.mark.parametrize(
    "atual,dificuldade,esperado",
    [
        (1, "medio", 2),      # round(1 * 1.5) = 2
        (2, "medio", 3),      # round(2 * 1.5) = 3
        (10, "medio", 15),
        (2, "facil", 5),      # round(2 * 2.5) = 5
        (10, "facil", 25),
    ],
)
def test_multiplicadores(atual, dificuldade, esperado):
    assert proximo_intervalo(atual, dificuldade) == esperado


def test_facil_nunca_volta_antes_de_dois_dias():
    assert proximo_intervalo(1, "facil") >= 2


def test_intervalo_tem_teto():
    assert proximo_intervalo(1000, "facil") == INTERVALO_MAXIMO
    assert proximo_intervalo(INTERVALO_MAXIMO, "facil") == INTERVALO_MAXIMO


def test_intervalo_nulo_ou_zero_e_tratado_como_um_dia():
    assert proximo_intervalo(None, "medio") == 2
    assert proximo_intervalo(0, "medio") == 2


# ─────────────────────── aplicação na carta ───────────────────────


def test_revisar_facil_agenda_para_dois_dias_ou_mais():
    """O critério de aceite do plano: fácil adia em 2+ dias."""
    carta = agendar_nova(CartaFalsa(), hoje=HOJE)
    revisar(carta, "facil", hoje=HOJE)

    assert carta.intervalo_dias >= 2
    assert carta.proxima_revisao >= HOJE + timedelta(days=2)
    assert carta.ultima_revisao == HOJE


def test_revisar_dificil_traz_para_amanha_e_zera_a_sequencia():
    carta = CartaFalsa(intervalo_dias=30, acertos_seguidos=5)
    revisar(carta, "dificil", hoje=HOJE)

    assert carta.intervalo_dias == 1
    assert carta.proxima_revisao == HOJE + timedelta(days=1)
    assert carta.acertos_seguidos == 0


def test_acertos_seguidos_acumulam():
    carta = agendar_nova(CartaFalsa(), hoje=HOJE)
    for _ in range(3):
        revisar(carta, "medio", hoje=HOJE)
    assert carta.acertos_seguidos == 3


def test_sequencia_de_faceis_espaca_cada_vez_mais():
    carta = agendar_nova(CartaFalsa(), hoje=HOJE)
    intervalos = []
    for _ in range(5):
        revisar(carta, "facil", hoje=HOJE)
        intervalos.append(carta.intervalo_dias)

    assert intervalos == sorted(intervalos)
    assert intervalos[-1] > intervalos[0]
    assert all(i <= INTERVALO_MAXIMO for i in intervalos)


def test_errar_depois_de_acertar_muito_recomeca_do_zero():
    carta = agendar_nova(CartaFalsa(), hoje=HOJE)
    for _ in range(6):
        revisar(carta, "facil", hoje=HOJE)
    assert carta.intervalo_dias > 30

    revisar(carta, "dificil", hoje=HOJE)
    assert carta.intervalo_dias == 1
    assert carta.acertos_seguidos == 0


def test_dificuldade_desconhecida_e_recusada():
    with pytest.raises(ValueError):
        revisar(CartaFalsa(), "impossivel", hoje=HOJE)


def test_carta_nova_entra_na_fila_do_proprio_dia():
    carta = agendar_nova(CartaFalsa(intervalo_dias=99, acertos_seguidos=7), hoje=HOJE)
    assert carta.proxima_revisao == HOJE
    assert carta.intervalo_dias == 1
    assert carta.acertos_seguidos == 0
    assert carta.ultima_revisao is None
