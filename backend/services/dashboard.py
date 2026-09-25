"""Agregação do dashboard.

Cada bloco do painel é uma função daqui, e GET /api/dashboard devolve
todos numa só resposta — o painel inteiro se pinta com um request.

O envelope tem sempre a mesma forma, desde a fase 1: as fases seguintes
preenchem as chaves que hoje voltam vazias, sem quebrar o frontend.
"""

from datetime import date, datetime, time, timedelta

from database import db
from models import (
    Aviso,
    Compromisso,
    IgrejaEscala,
    IgrejaEvento,
    IgrejaHorarioFixo,
    Lembrete,
    Oracao,
    SessaoEstudo,
    Simulado,
    Tarefa,
)
from services.liturgia import tempo_liturgico
from services.recorrencia import expandir_varios


def proxima_escala():
    """A escala mais próxima que ainda não passou.

    A comparação final é em Python porque data e horário são colunas
    separadas: o MySQL não ordena por elas combinadas sem construir a
    expressão. São poucas escalas por dia, então o custo é irrelevante.
    """
    agora = datetime.now()
    candidatas = (
        IgrejaEscala.query.filter(IgrejaEscala.data >= agora.date())
        .order_by(IgrejaEscala.data, IgrejaEscala.horario)
        .limit(30)
        .all()
    )
    for escala in candidatas:
        if escala.inicio >= agora:
            return escala
    return None


def escalas_proximas(limite=4):
    """As próximas escalas depois da primeira, para a lista do card."""
    agora = datetime.now()
    candidatas = (
        IgrejaEscala.query.filter(IgrejaEscala.data >= agora.date())
        .order_by(IgrejaEscala.data, IgrejaEscala.horario)
        .limit(40)
        .all()
    )
    futuras = [e for e in candidatas if e.inicio >= agora]
    return futuras[1 : 1 + limite]


def escalas_pendentes():
    """Quantas escalas futuras ainda não foram confirmadas."""
    agora = datetime.now()
    return (
        db.session.query(db.func.count(IgrejaEscala.id))
        .filter(IgrejaEscala.data >= agora.date())
        .filter(IgrejaEscala.status == "pendente")
        .scalar()
        or 0
    )


# ─────────────────────────── agenda (F2) ───────────────────────────


def _ocorrencias(inicio, fim):
    """Ocorrências de compromissos na janela, já ordenadas."""
    compromissos = Compromisso.query.all()
    itens = []
    for compromisso, ocorrencia in expandir_varios(compromissos, inicio, fim):
        dados = compromisso.to_dict()
        dados["inicio"] = ocorrencia["inicio"]
        dados["fim"] = ocorrencia["fim"]
        dados["data_original"] = ocorrencia["data_original"]
        itens.append(dados)
    itens.sort(key=lambda c: c["inicio"])
    return itens


def compromissos_hoje(hoje):
    return _ocorrencias(hoje, hoje)


def compromissos_semana(hoje):
    """Os próximos 7 dias, sem repetir o que já está no bloco de hoje."""
    itens = _ocorrencias(hoje + timedelta(days=1), hoje + timedelta(days=7))
    return itens[:10]


def lembretes_pendentes():
    """Já vencidos e ainda não mostrados. Não materializa: quem faz isso
    é /api/lembretes/pendentes, chamado pelo polling do navegador."""
    agora = datetime.now()
    lista = (
        Lembrete.query.filter(
            Lembrete.enviado.is_(False), Lembrete.disparar_em <= agora
        )
        .order_by(Lembrete.disparar_em)
        .limit(10)
        .all()
    )
    return [l.to_dict() for l in lista]


def avisos_fixados(hoje):
    lista = (
        Aviso.query.filter(Aviso.fixado.is_(True))
        .filter(db.or_(Aviso.expira_em.is_(None), Aviso.expira_em >= hoje))
        .order_by(Aviso.criado_em.desc())
        .limit(6)
        .all()
    )
    return [a.to_dict() for a in lista]


# ─────────────────────────── tarefas (F3) ───────────────────────────


def tarefas_hoje(hoje):
    """Com prazo para hoje, ou já em andamento — o que pede atenção agora."""
    lista = (
        Tarefa.query.filter(Tarefa.status != "feito")
        .filter(db.or_(Tarefa.prazo == hoje, Tarefa.status == "fazendo"))
        .order_by(Tarefa.prazo.is_(None), Tarefa.prazo, Tarefa.ordem)
        .limit(8)
        .all()
    )
    return [t.to_dict(com_subtarefas=False) for t in lista]


def tarefas_atrasadas(hoje):
    lista = (
        Tarefa.query.filter(Tarefa.status != "feito", Tarefa.prazo < hoje)
        .order_by(Tarefa.prazo)
        .limit(8)
        .all()
    )
    return [t.to_dict(com_subtarefas=False) for t in lista]


# ─────────────────────────── igreja (F4) ───────────────────────────


def proximo_evento_igreja():
    evento = (
        IgrejaEvento.query.filter(IgrejaEvento.data_hora >= datetime.now())
        .order_by(IgrejaEvento.data_hora)
        .first()
    )
    return evento.to_dict() if evento else None


def proximas_ocorrencias_fixas(tipo=None, limite=6, agora=None):
    """Transforma a grade semanal em datas concretas.

    Os horários fixos guardam só dia da semana e hora; para mostrar "a
    próxima confissão" é preciso projetar isso no calendário.
    """
    agora = agora or datetime.now()

    query = IgrejaHorarioFixo.query
    if tipo:
        query = query.filter(IgrejaHorarioFixo.tipo == tipo)
    horarios = query.all()
    if not horarios:
        return []

    ocorrencias = []
    for horario in horarios:
        # Quantos dias faltam até o próximo dia da semana correspondente.
        adiante = (horario.dia_semana - agora.weekday()) % 7
        quando = datetime.combine(
            agora.date() + timedelta(days=adiante), horario.horario
        )
        if quando < agora:
            quando += timedelta(days=7)  # já passou hoje: vai para a semana seguinte

        dados = horario.to_dict()
        dados["quando"] = quando
        ocorrencias.append(dados)

    ocorrencias.sort(key=lambda o: o["quando"])
    return ocorrencias[:limite]


def proxima_confissao():
    proximas = proximas_ocorrencias_fixas(tipo="confissao", limite=1)
    return proximas[0] if proximas else None


def oracao_do_momento(agora=None):
    """Sugere uma oração conforme a hora: manhã, Angelus ao meio-dia, noite."""
    agora = agora or datetime.now()
    hora = agora.hour

    if 11 <= hora < 14:
        # Ao meio-dia, o Angelus tem precedência sobre a categoria.
        angelus = Oracao.query.filter(Oracao.titulo.like("%Angelus%")).first()
        if angelus:
            return angelus.to_dict()

    categoria = "manha" if hora < 12 else "noite" if hora >= 18 else "pessoal"
    oracao = (
        Oracao.query.filter(Oracao.categoria == categoria)
        .order_by(Oracao.favorita.desc(), Oracao.id)
        .first()
    )
    return oracao.to_dict() if oracao else None


# ─────────────────────────── estudos (F5) ───────────────────────────


def resumo_estudos(hoje):
    """Horas estudadas na semana e o resultado do último simulado."""
    from services.correcao import corrigir

    inicio_semana = hoje - timedelta(days=hoje.weekday())  # segunda-feira
    minutos = float(
        db.session.query(db.func.sum(SessaoEstudo.duracao_min))
        .filter(SessaoEstudo.inicio >= datetime.combine(inicio_semana, time.min))
        .scalar()
        or 0
    )

    ultimo = Simulado.query.order_by(Simulado.data.desc(), Simulado.id.desc()).first()
    resumo_simulado = None
    if ultimo:
        geral = corrigir(ultimo)["geral"]
        resumo_simulado = {
            "id": ultimo.id,
            "titulo": ultimo.titulo,
            "data": ultimo.data,
            "banca": ultimo.banca,
            "acertos": geral["acertos"],
            "validas": geral["validas"],
            "percentual": geral["percentual"],
        }

    return {
        "horas_semana": round(minutos / 60, 1),
        "ultimo_simulado": resumo_simulado,
    }


def montar(hoje=None):
    """O envelope completo do dashboard."""
    hoje = hoje or date.today()
    escala = proxima_escala()

    return {
        "liturgia": tempo_liturgico(hoje),
        "proxima_escala": escala.to_dict() if escala else None,
        "escalas_seguintes": [e.to_dict() for e in escalas_proximas()],
        "escalas_pendentes": escalas_pendentes(),
        "compromissos_hoje": compromissos_hoje(hoje),
        "compromissos_semana": compromissos_semana(hoje),
        "lembretes_pendentes": lembretes_pendentes(),
        "avisos_fixados": avisos_fixados(hoje),
        "tarefas_hoje": tarefas_hoje(hoje),
        "tarefas_atrasadas": tarefas_atrasadas(hoje),
        "proximo_evento_igreja": proximo_evento_igreja(),
        "proxima_confissao": proxima_confissao(),
        "oracao_do_momento": oracao_do_momento(),
        "estudos": resumo_estudos(hoje),
    }
