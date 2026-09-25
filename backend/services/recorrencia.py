"""Expansão de compromissos recorrentes em ocorrências concretas.

O banco guarda a série (início, tipo de recorrência, data de término); a
agenda precisa das ocorrências uma a uma. É isso que este módulo faz.

expandir() é uma função pura: recebe a série e as exceções já carregadas
e devolve as ocorrências. Todo o cálculo é testável sem banco.
"""

from calendar import monthrange
from datetime import date, datetime, timedelta

# Trava de segurança: nenhuma janela legítima da agenda produz mais que
# isto, e o limite impede um laço infinito se algum campo vier torto.
MAX_OCORRENCIAS = 1000


def _mesmo_dia_no_mes(base, meses_adiante):
    """Mesmo dia do mês, N meses adiante. None se o mês não tem esse dia.

    Um compromisso no dia 31 simplesmente não acontece em fevereiro,
    abril, junho, setembro e novembro — em vez de escorregar para o dia
    1º do mês seguinte, a ocorrência é pulada.
    """
    total = base.month - 1 + meses_adiante
    ano = base.year + total // 12
    mes = total % 12 + 1
    if base.day > monthrange(ano, mes)[1]:
        return None
    return date(ano, mes, base.day)


def _datas_da_serie(inicio_serie, recorrencia, recorrencia_fim, ate):
    """Datas em que a série acontece, de inicio_serie até `ate`."""
    limite = min(recorrencia_fim, ate) if recorrencia_fim else ate

    if recorrencia == "nenhuma":
        return [inicio_serie] if inicio_serie <= limite else []

    if recorrencia in ("diaria", "semanal"):
        passo = timedelta(days=1 if recorrencia == "diaria" else 7)
        datas = []
        atual = inicio_serie
        while atual <= limite and len(datas) < MAX_OCORRENCIAS:
            datas.append(atual)
            atual += passo
        return datas

    if recorrencia == "mensal":
        # O número de meses até o limite é conhecido de antemão, então o
        # laço termina por construção — meses curtos só são pulados.
        meses = (limite.year - inicio_serie.year) * 12 + (
            limite.month - inicio_serie.month
        )
        datas = []
        for n in range(meses + 1):
            candidata = _mesmo_dia_no_mes(inicio_serie, n)
            if candidata is not None and inicio_serie <= candidata <= limite:
                datas.append(candidata)
            if len(datas) >= MAX_OCORRENCIAS:
                break
        return datas

    return []


def expandir(compromisso, inicio, fim, excecoes=None):
    """Ocorrências de um compromisso dentro da janela [inicio, fim].

    `inicio` e `fim` são datas. `excecoes` é um dicionário
    {data_original: excecao}, com os atributos cancelada, novo_inicio e
    novo_fim. Ocorrências canceladas não entram no resultado.

    Cada ocorrência devolvida traz `data_original`, que é a chave para
    cancelar ou remarcar aquele dia sem tocar no resto da série.
    """
    excecoes = excecoes or {}
    inicio_serie = compromisso.inicio.date()

    # A janela nunca começa antes do início da série.
    limite_inicial = max(inicio, inicio_serie)
    duracao = (
        compromisso.fim - compromisso.inicio
        if compromisso.fim and compromisso.fim > compromisso.inicio
        else None
    )

    ocorrencias = []
    for data_original in _datas_da_serie(
        inicio_serie, compromisso.recorrencia, compromisso.recorrencia_fim, fim
    ):
        if data_original < limite_inicial:
            continue

        excecao = excecoes.get(data_original)
        if excecao is not None and excecao.cancelada:
            continue

        if excecao is not None and excecao.novo_inicio:
            comeco = excecao.novo_inicio
            termino = excecao.novo_fim or (comeco + duracao if duracao else None)
            # Uma ocorrência remarcada pode sair da janela consultada.
            if not (inicio <= comeco.date() <= fim):
                continue
        else:
            comeco = datetime.combine(data_original, compromisso.inicio.time())
            termino = comeco + duracao if duracao else None

        ocorrencias.append(
            {
                "data_original": data_original,
                "inicio": comeco,
                "fim": termino,
                "remarcada": bool(excecao and excecao.novo_inicio),
            }
        )

    return ocorrencias


def carregar_excecoes(compromisso_ids):
    """{compromisso_id: {data_original: excecao}} para os ids dados."""
    from models import CompromissoExcecao

    if not compromisso_ids:
        return {}

    mapa = {}
    linhas = CompromissoExcecao.query.filter(
        CompromissoExcecao.compromisso_id.in_(compromisso_ids)
    ).all()
    for excecao in linhas:
        mapa.setdefault(excecao.compromisso_id, {})[excecao.data_original] = excecao
    return mapa


def expandir_varios(compromissos, inicio, fim):
    """Expande uma lista de compromissos, carregando as exceções de uma vez.

    Sem isto, cada compromisso faria a sua própria consulta de exceções
    (o clássico N+1) ao montar o mês da agenda.
    """
    excecoes_por_compromisso = carregar_excecoes([c.id for c in compromissos])

    resultado = []
    for compromisso in compromissos:
        for ocorrencia in expandir(
            compromisso,
            inicio,
            fim,
            excecoes_por_compromisso.get(compromisso.id, {}),
        ):
            resultado.append((compromisso, ocorrencia))
    return resultado
