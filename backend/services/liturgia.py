"""Cálculo do tempo litúrgico e da cor do dia, no calendário do Brasil.

A Epifania é celebrada no domingo entre 2 e 8 de janeiro; a Ascensão, no
7º Domingo da Páscoa; Corpus Christi, na quinta-feira após a Santíssima
Trindade.

O módulo tem duas portas de entrada:

- tempo_liturgico_movel(d) — função pura, só aritmética de datas, testada
  em tests/test_liturgia.py.
- tempo_liturgico(d) — a anterior, com as solenidades e festas de data
  fixa da tabela liturgia_datas_fixas aplicadas por cima. É a que as
  rotas usam.
"""

from datetime import date, timedelta

from dateutil.easter import easter

CORES = {
    "roxo": "#6B3FA0",
    "verde": "#2E7D4F",
    "branco": "#E8E1CF",
    "vermelho": "#B22222",
    "rosa": "#D98CA6",
}

# Que graus de celebração fixa podem sobrepor cada tempo litúrgico.
# Na Quaresma e no Advento só solenidades têm precedência; no Tríduo e na
# Semana Santa, nada sobrepõe.
GRAUS_QUE_SOBREPOEM = {
    "Tempo Comum": {"solenidade", "festa", "memoria", "comemoracao"},
    "Tempo do Natal": {"solenidade", "festa"},
    "Tempo Pascal": {"solenidade", "festa"},
    "Advento": {"solenidade"},
    "Quaresma": {"solenidade"},
    "Semana Santa": set(),
    "Tríduo Pascal": set(),
}


def _primeiro_domingo_advento(ano):
    """Quarto domingo antes do Natal."""
    natal = date(ano, 12, 25)
    dias_desde_domingo = (natal.weekday() + 1) % 7
    quarto_domingo = natal - timedelta(days=dias_desde_domingo or 7)
    return quarto_domingo - timedelta(weeks=3)


def _epifania(ano):
    """No Brasil, o domingo entre 2 e 8 de janeiro."""
    jan2 = date(ano, 1, 2)
    return jan2 + timedelta(days=(6 - jan2.weekday()) % 7)


def _batismo_do_senhor(ano):
    """Domingo seguinte à Epifania — ou a segunda-feira, se a Epifania
    cair em 7 ou 8 de janeiro."""
    epifania = _epifania(ano)
    if epifania.day >= 7:
        return epifania + timedelta(days=1)
    return epifania + timedelta(days=7)


def _resultado(tempo, cor, celebracao=None):
    return {
        "tempo": tempo,
        "cor": cor,
        "cor_hex": CORES[cor],
        "celebracao": celebracao,
    }


def tempo_liturgico_movel(d=None):
    """Tempo, cor e celebração móvel do dia. Função pura, sem banco."""
    d = d or date.today()
    ano = d.year

    pascoa = easter(ano)
    cinzas = pascoa - timedelta(days=46)
    ramos = pascoa - timedelta(days=7)
    quinta_santa = pascoa - timedelta(days=3)
    ascensao = pascoa + timedelta(days=42)
    pentecostes = pascoa + timedelta(days=49)
    trindade = pascoa + timedelta(days=56)
    corpus_christi = pascoa + timedelta(days=60)

    advento = _primeiro_domingo_advento(ano)
    batismo = _batismo_do_senhor(ano)
    natal = date(ano, 12, 25)

    # ── Tempo do Natal, no início do ano ──
    if d <= batismo:
        celebracao = None
        if d == date(ano, 1, 1):
            celebracao = "Santa Maria, Mãe de Deus"
        elif d == _epifania(ano):
            celebracao = "Epifania do Senhor"
        elif d == batismo:
            celebracao = "Batismo do Senhor"
        return _resultado("Tempo do Natal", "branco", celebracao)

    # ── Tempo Comum, entre o Batismo e as Cinzas ──
    if d < cinzas:
        return _resultado("Tempo Comum", "verde")

    # ── Quaresma ──
    if d == cinzas:
        return _resultado("Quaresma", "roxo", "Quarta-feira de Cinzas")
    if d == pascoa - timedelta(days=21):
        return _resultado("Quaresma", "rosa", "Domingo Laetare")
    if d < ramos:
        return _resultado("Quaresma", "roxo")

    # ── Semana Santa ──
    if d == ramos:
        return _resultado("Semana Santa", "vermelho", "Domingo de Ramos")
    if d < quinta_santa:
        # Segunda, terça e quarta da Semana Santa: roxo, mas já não é Quaresma.
        return _resultado("Semana Santa", "roxo")

    # ── Tríduo Pascal ──
    if d == quinta_santa:
        return _resultado("Tríduo Pascal", "branco", "Quinta-feira Santa")
    if d == pascoa - timedelta(days=2):
        return _resultado("Tríduo Pascal", "vermelho", "Sexta-feira da Paixão")
    if d == pascoa - timedelta(days=1):
        return _resultado("Tríduo Pascal", "roxo", "Sábado Santo")

    # ── Tempo Pascal ──
    if d == pascoa:
        return _resultado("Tempo Pascal", "branco", "Domingo de Páscoa")
    if d == ascensao:
        return _resultado("Tempo Pascal", "branco", "Ascensão do Senhor")
    if d < pentecostes:
        return _resultado("Tempo Pascal", "branco")
    if d == pentecostes:
        return _resultado("Tempo Pascal", "vermelho", "Pentecostes")

    # ── Tempo Comum, com as solenidades do Senhor que o abrem ──
    if d == trindade:
        return _resultado("Tempo Comum", "branco", "Santíssima Trindade")
    if d == corpus_christi:
        return _resultado("Tempo Comum", "branco", "Corpus Christi")
    if d < advento:
        return _resultado("Tempo Comum", "verde")

    # ── Advento ──
    if d == advento:
        return _resultado("Advento", "roxo", "1º Domingo do Advento")
    if d == advento + timedelta(days=14):
        return _resultado("Advento", "rosa", "Domingo Gaudete")
    if d < natal:
        return _resultado("Advento", "roxo")

    # ── Tempo do Natal, no fim do ano ──
    return _resultado(
        "Tempo do Natal",
        "branco",
        "Natal do Senhor" if d == natal else None,
    )


def _buscar_data_fixa(d):
    """Celebração de data fixa cadastrada para o dia, se houver.

    O import fica aqui dentro para que tempo_liturgico_movel continue
    utilizável (e testável) sem contexto de aplicação.
    """
    from models import LiturgiaDataFixa

    ordem = {"solenidade": 0, "festa": 1, "memoria": 2, "comemoracao": 3}
    candidatas = LiturgiaDataFixa.query.filter_by(mes=d.month, dia=d.day).all()
    if not candidatas:
        return None
    return sorted(candidatas, key=lambda c: ordem.get(c.grau, 9))[0]


def tempo_liturgico(d=None):
    """Tempo litúrgico do dia, já com as datas fixas aplicadas."""
    d = d or date.today()
    base = tempo_liturgico_movel(d)

    fixa = _buscar_data_fixa(d)
    if fixa and fixa.grau in GRAUS_QUE_SOBREPOEM.get(base["tempo"], set()):
        cor = fixa.cor if fixa.cor in CORES else base["cor"]
        base = {
            **base,
            "cor": cor,
            "cor_hex": CORES[cor],
            "celebracao": fixa.titulo,
        }

    base["data"] = d
    return base
