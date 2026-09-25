"""Testes do cálculo litúrgico.

As datas de referência são fixas no arquivo, não derivadas do código sob
teste: é isso que faz o teste valer. Confira-as contra o Ordo da CNBB
antes de alterar qualquer expectativa daqui.
"""

from datetime import date, timedelta

import pytest

from services.liturgia import (
    _batismo_do_senhor,
    _epifania,
    _primeiro_domingo_advento,
    tempo_liturgico_movel,
)

# Domingo de Páscoa, por ano.
PASCOA = {
    2026: date(2026, 4, 5),
    2027: date(2027, 3, 28),
    2028: date(2028, 4, 16),
    2029: date(2029, 4, 1),
    2030: date(2030, 4, 21),
}

# 1º Domingo do Advento: o quarto domingo antes do Natal.
ADVENTO = {
    2026: date(2026, 11, 29),
    2027: date(2027, 11, 28),
    2028: date(2028, 12, 3),
    2029: date(2029, 12, 2),
    2030: date(2030, 12, 1),
}

# Epifania (domingo entre 2 e 8 de janeiro) e Batismo do Senhor.
# 2029 é o caso de borda: a Epifania cai em 7 de janeiro, então o
# Batismo vai para a segunda-feira seguinte, dia 8.
EPIFANIA_E_BATISMO = {
    2026: (date(2026, 1, 4), date(2026, 1, 11)),
    2027: (date(2027, 1, 3), date(2027, 1, 10)),
    2028: (date(2028, 1, 2), date(2028, 1, 9)),
    2029: (date(2029, 1, 7), date(2029, 1, 8)),
    2030: (date(2030, 1, 6), date(2030, 1, 13)),
}

ANOS = sorted(PASCOA)


def tempo(d):
    return tempo_liturgico_movel(d)["tempo"]


def cor(d):
    return tempo_liturgico_movel(d)["cor"]


def celebracao(d):
    return tempo_liturgico_movel(d)["celebracao"]


# ─────────────────────── datas âncora ───────────────────────


@pytest.mark.parametrize("ano", ANOS)
def test_pascoa_do_dateutil_bate_com_a_referencia(ano):
    from dateutil.easter import easter

    assert easter(ano) == PASCOA[ano]


@pytest.mark.parametrize("ano", ANOS)
def test_primeiro_domingo_do_advento(ano):
    calculado = _primeiro_domingo_advento(ano)
    assert calculado == ADVENTO[ano]
    assert calculado.weekday() == 6  # domingo


@pytest.mark.parametrize("ano", ANOS)
def test_epifania_e_batismo(ano):
    epifania_esperada, batismo_esperado = EPIFANIA_E_BATISMO[ano]
    assert _epifania(ano) == epifania_esperada
    assert _batismo_do_senhor(ano) == batismo_esperado
    # A Epifania é sempre um domingo entre 2 e 8 de janeiro.
    assert _epifania(ano).weekday() == 6
    assert 2 <= _epifania(ano).day <= 8


# ─────────────────────── Quaresma ───────────────────────


@pytest.mark.parametrize("ano", ANOS)
def test_quarta_feira_de_cinzas(ano):
    cinzas = PASCOA[ano] - timedelta(days=46)
    assert cinzas.weekday() == 2  # quarta-feira
    resultado = tempo_liturgico_movel(cinzas)
    assert resultado["tempo"] == "Quaresma"
    assert resultado["cor"] == "roxo"
    assert resultado["celebracao"] == "Quarta-feira de Cinzas"


@pytest.mark.parametrize("ano", ANOS)
def test_vespera_das_cinzas_ainda_e_tempo_comum(ano):
    vespera = PASCOA[ano] - timedelta(days=47)
    assert tempo(vespera) == "Tempo Comum"
    assert cor(vespera) == "verde"


@pytest.mark.parametrize("ano", ANOS)
def test_domingo_laetare_e_rosa(ano):
    laetare = PASCOA[ano] - timedelta(days=21)
    resultado = tempo_liturgico_movel(laetare)
    assert resultado["cor"] == "rosa"
    assert resultado["celebracao"] == "Domingo Laetare"


# ─────────────────────── Semana Santa e Tríduo ───────────────────────


@pytest.mark.parametrize("ano", ANOS)
def test_domingo_de_ramos(ano):
    ramos = PASCOA[ano] - timedelta(days=7)
    resultado = tempo_liturgico_movel(ramos)
    assert resultado["tempo"] == "Semana Santa"
    assert resultado["cor"] == "vermelho"
    assert resultado["celebracao"] == "Domingo de Ramos"


@pytest.mark.parametrize("ano", ANOS)
@pytest.mark.parametrize("dias_antes", [6, 5, 4])
def test_inicio_da_semana_santa_nao_e_mais_quaresma(ano, dias_antes):
    """Segunda, terça e quarta da Semana Santa.

    Era o bug do documento de planejamento: estes três dias caíam no ramo
    da Quaresma. A cor está certa, mas o tempo é Semana Santa.
    """
    dia = PASCOA[ano] - timedelta(days=dias_antes)
    resultado = tempo_liturgico_movel(dia)
    assert resultado["tempo"] == "Semana Santa"
    assert resultado["cor"] == "roxo"


@pytest.mark.parametrize("ano", ANOS)
def test_triduo_pascal(ano):
    pascoa = PASCOA[ano]
    esperado = {
        3: ("branco", "Quinta-feira Santa"),
        2: ("vermelho", "Sexta-feira da Paixão"),
        1: ("roxo", "Sábado Santo"),
    }
    for dias_antes, (cor_esperada, nome) in esperado.items():
        resultado = tempo_liturgico_movel(pascoa - timedelta(days=dias_antes))
        assert resultado["tempo"] == "Tríduo Pascal"
        assert resultado["cor"] == cor_esperada
        assert resultado["celebracao"] == nome


# ─────────────────────── Tempo Pascal ───────────────────────


@pytest.mark.parametrize("ano", ANOS)
def test_domingo_de_pascoa(ano):
    resultado = tempo_liturgico_movel(PASCOA[ano])
    assert resultado["tempo"] == "Tempo Pascal"
    assert resultado["cor"] == "branco"
    assert resultado["celebracao"] == "Domingo de Páscoa"


@pytest.mark.parametrize("ano", ANOS)
def test_ascensao_no_setimo_domingo_da_pascoa(ano):
    ascensao = PASCOA[ano] + timedelta(days=42)
    assert ascensao.weekday() == 6
    assert celebracao(ascensao) == "Ascensão do Senhor"


@pytest.mark.parametrize("ano", ANOS)
def test_pentecostes(ano):
    pentecostes = PASCOA[ano] + timedelta(days=49)
    assert pentecostes.weekday() == 6
    resultado = tempo_liturgico_movel(pentecostes)
    assert resultado["cor"] == "vermelho"
    assert resultado["celebracao"] == "Pentecostes"


@pytest.mark.parametrize("ano", ANOS)
def test_dia_seguinte_a_pentecostes_volta_ao_tempo_comum(ano):
    dia = PASCOA[ano] + timedelta(days=50)
    assert tempo(dia) == "Tempo Comum"
    assert cor(dia) == "verde"


@pytest.mark.parametrize("ano", ANOS)
def test_trindade_e_corpus_christi(ano):
    trindade = PASCOA[ano] + timedelta(days=56)
    corpus = PASCOA[ano] + timedelta(days=60)
    assert celebracao(trindade) == "Santíssima Trindade"
    assert celebracao(corpus) == "Corpus Christi"
    assert corpus.weekday() == 3  # quinta-feira


# ─────────────────────── Advento e Natal ───────────────────────


@pytest.mark.parametrize("ano", ANOS)
def test_primeiro_domingo_do_advento_muda_o_tempo(ano):
    advento = ADVENTO[ano]
    assert tempo(advento - timedelta(days=1)) == "Tempo Comum"
    resultado = tempo_liturgico_movel(advento)
    assert resultado["tempo"] == "Advento"
    assert resultado["cor"] == "roxo"
    assert resultado["celebracao"] == "1º Domingo do Advento"


@pytest.mark.parametrize("ano", ANOS)
def test_domingo_gaudete_e_rosa(ano):
    gaudete = ADVENTO[ano] + timedelta(days=14)
    resultado = tempo_liturgico_movel(gaudete)
    assert resultado["tempo"] == "Advento"
    assert resultado["cor"] == "rosa"
    assert resultado["celebracao"] == "Domingo Gaudete"


@pytest.mark.parametrize("ano", ANOS)
def test_natal(ano):
    resultado = tempo_liturgico_movel(date(ano, 12, 25))
    assert resultado["tempo"] == "Tempo do Natal"
    assert resultado["cor"] == "branco"
    assert resultado["celebracao"] == "Natal do Senhor"


@pytest.mark.parametrize("ano", ANOS)
def test_vespera_de_natal_ainda_e_advento(ano):
    assert tempo(date(ano, 12, 24)) == "Advento"


@pytest.mark.parametrize("ano", ANOS)
def test_primeiro_de_janeiro(ano):
    resultado = tempo_liturgico_movel(date(ano, 1, 1))
    assert resultado["tempo"] == "Tempo do Natal"
    assert resultado["celebracao"] == "Santa Maria, Mãe de Deus"


@pytest.mark.parametrize("ano", ANOS)
def test_dia_seguinte_ao_batismo_abre_o_tempo_comum(ano):
    dia = _batismo_do_senhor(ano) + timedelta(days=1)
    assert tempo(dia) == "Tempo Comum"
    assert cor(dia) == "verde"


# ─────────────────────── Cobertura e coerência ───────────────────────


@pytest.mark.parametrize("ano", ANOS)
def test_todos_os_dias_do_ano_tem_tempo_e_cor_validos(ano):
    """Nenhum dia pode cair fora dos ramos do cálculo."""
    from services.liturgia import CORES

    tempos_validos = {
        "Tempo do Natal",
        "Tempo Comum",
        "Quaresma",
        "Semana Santa",
        "Tríduo Pascal",
        "Tempo Pascal",
        "Advento",
    }

    dia = date(ano, 1, 1)
    while dia.year == ano:
        resultado = tempo_liturgico_movel(dia)
        assert resultado["tempo"] in tempos_validos, dia
        assert resultado["cor"] in CORES, dia
        assert resultado["cor_hex"] == CORES[resultado["cor"]], dia
        dia += timedelta(days=1)


@pytest.mark.parametrize("ano", ANOS)
def test_quaresma_vai_das_cinzas_ao_sabado_antes_de_ramos(ano):
    """São 39 dias corridos rotulados "Quaresma".

    Das Cinzas (Páscoa − 46) ao sábado anterior a Ramos (Páscoa − 8).
    Não confundir com os "quarenta dias" da tradição, que não contam os
    domingos e se estendem até a Quinta-feira Santa.
    """
    pascoa = PASCOA[ano]
    dias = [
        pascoa - timedelta(days=n)
        for n in range(46, 7, -1)
        if tempo(pascoa - timedelta(days=n)) == "Quaresma"
    ]

    assert len(dias) == 39
    assert dias[0] == pascoa - timedelta(days=46)  # Quarta-feira de Cinzas
    assert dias[-1] == pascoa - timedelta(days=8)  # sábado antes de Ramos


def test_rosa_aparece_exatamente_duas_vezes_por_ano():
    """Laetare, na Quaresma, e Gaudete, no Advento."""
    for ano in ANOS:
        rosas = []
        dia = date(ano, 1, 1)
        while dia.year == ano:
            if cor(dia) == "rosa":
                rosas.append(dia)
            dia += timedelta(days=1)
        assert len(rosas) == 2, f"{ano}: {rosas}"
