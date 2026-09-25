"""Materialização dos lembretes.

O Ordo não tem agendador em segundo plano: o frontend consulta
/api/lembretes/pendentes a cada minuto, e essa rota chama materializar()
antes de responder. Os lembretes nascem, portanto, sob demanda.

Por isso a operação precisa ser idempotente. A garantia final é a
UniqueConstraint (origem_tipo, origem_id, disparar_em) em `lembretes`;
aqui as chaves existentes são lidas antes para não depender de exceção.
"""

from datetime import date, datetime, time, timedelta

from database import db
from models import Compromisso, IgrejaEscala, IgrejaEvento, Lembrete, Tarefa
from services.recorrencia import expandir_varios

# Quanto tempo à frente materializar. Além disso é desperdício: o
# usuário ainda vai abrir o Ordo muitas vezes antes de lá.
JANELA_DIAS = 30

# Um lembrete cujo horário passou há muito tempo não deve mais aparecer:
# significa que o Ordo ficou fechado, e avisar depois não ajuda.
CARENCIA = timedelta(hours=12)

# A escala não tem antecedência configurável no modelo; avisa-se um dia antes.
ESCALA_ANTECEDENCIA_MIN = 1440

# Tarefa com prazo avisa às 9h do dia do prazo.
HORA_LEMBRETE_TAREFA = time(9, 0)


def _chave(origem_tipo, origem_id, disparar_em):
    # Segundos são zerados para que a chave seja estável entre execuções.
    return (origem_tipo, origem_id, disparar_em.replace(second=0, microsecond=0))


def _coletar_compromissos(inicio, fim):
    """Ocorrências de compromissos com lembrete configurado."""
    compromissos = Compromisso.query.filter(
        Compromisso.lembrete_min.isnot(None)
    ).all()
    if not compromissos:
        return []

    candidatos = []
    for compromisso, ocorrencia in expandir_varios(compromissos, inicio, fim):
        disparar_em = ocorrencia["inicio"] - timedelta(minutes=compromisso.lembrete_min)
        candidatos.append((("compromisso", compromisso.id, disparar_em), compromisso.titulo))
    return candidatos


def _coletar_escalas(inicio, fim):
    escalas = IgrejaEscala.query.filter(IgrejaEscala.data.between(inicio, fim)).all()
    return [
        (
            (
                "escala",
                escala.id,
                escala.inicio - timedelta(minutes=ESCALA_ANTECEDENCIA_MIN),
            ),
            f"Escala: {escala.celebracao}"
            + (f" — {escala.funcao}" if escala.funcao else ""),
        )
        for escala in escalas
    ]


def _coletar_eventos(inicio, fim):
    eventos = IgrejaEvento.query.filter(
        IgrejaEvento.data_hora >= datetime.combine(inicio, time.min),
        IgrejaEvento.data_hora <= datetime.combine(fim, time.max),
    ).all()
    return [
        (
            (
                "evento",
                evento.id,
                evento.data_hora - timedelta(minutes=evento.lembrete_min or 0),
            ),
            evento.titulo,
        )
        for evento in eventos
    ]


def _coletar_tarefas(inicio, fim):
    tarefas = Tarefa.query.filter(
        Tarefa.prazo.between(inicio, fim), Tarefa.status != "feito"
    ).all()
    return [
        (
            ("tarefa", tarefa.id, datetime.combine(tarefa.prazo, HORA_LEMBRETE_TAREFA)),
            f"Prazo: {tarefa.titulo}",
        )
        for tarefa in tarefas
    ]


def materializar(janela_dias=JANELA_DIAS, agora=None):
    """Cria os lembretes que ainda não existem. Devolve quantos criou."""
    agora = agora or datetime.now()
    inicio = agora.date()
    fim = inicio + timedelta(days=janela_dias)

    candidatos = (
        _coletar_compromissos(inicio, fim)
        + _coletar_escalas(inicio, fim)
        + _coletar_eventos(inicio, fim)
        + _coletar_tarefas(inicio, fim)
    )

    # Descarta o que já passou da carência ou está além da janela.
    limite_passado = agora - CARENCIA
    limite_futuro = datetime.combine(fim, time.max)
    candidatos = [
        (chave, titulo)
        for chave, titulo in candidatos
        if limite_passado <= chave[2] <= limite_futuro
    ]
    if not candidatos:
        return 0

    # Uma consulta só devolve tudo o que já existe na janela.
    existentes = {
        _chave(l.origem_tipo, l.origem_id, l.disparar_em)
        for l in Lembrete.query.filter(
            Lembrete.disparar_em.between(limite_passado, limite_futuro)
        ).all()
    }

    novos = []
    vistos = set()
    for (origem_tipo, origem_id, disparar_em), titulo in candidatos:
        chave = _chave(origem_tipo, origem_id, disparar_em)
        if chave in existentes or chave in vistos:
            continue
        vistos.add(chave)
        novos.append(
            Lembrete(
                titulo=titulo,
                origem_tipo=origem_tipo,
                origem_id=origem_id,
                disparar_em=chave[2],
            )
        )

    if novos:
        db.session.add_all(novos)
        db.session.commit()
    return len(novos)


def pendentes(agora=None):
    """Lembretes cuja hora chegou e que ainda não foram mostrados."""
    agora = agora or datetime.now()
    return (
        Lembrete.query.filter(
            Lembrete.enviado.is_(False), Lembrete.disparar_em <= agora
        )
        .order_by(Lembrete.disparar_em)
        .all()
    )


def apagar_da_origem(origem_tipo, origem_id):
    """Remove os lembretes de algo que foi excluído.

    Sem isto, apagar um compromisso deixaria o lembrete órfão, que ainda
    dispararia no horário marcado.
    """
    Lembrete.query.filter_by(origem_tipo=origem_tipo, origem_id=origem_id).delete()
