"""Todas as tabelas do Ordo.

Cada modelo expõe um to_dict() explícito: a serialização nunca é
automática, para que a API não vaze colunas novas sem intenção.

Datas e horas são *naive*, no horário local da máquina. Nenhum ponto do
sistema usa utcnow().
"""

from datetime import datetime

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from database import db


class TimestampMixin:
    criado_em = db.Column(db.DateTime, default=datetime.now, nullable=False)
    atualizado_em = db.Column(
        db.DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )


# ══════════════════════════════ GERAL ══════════════════════════════


class Usuario(UserMixin, TimestampMixin, db.Model):
    __tablename__ = "usuarios"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False)
    senha_hash = db.Column(db.String(255), nullable=False)

    def definir_senha(self, senha):
        self.senha_hash = generate_password_hash(senha)

    def checar_senha(self, senha):
        return check_password_hash(self.senha_hash, senha)

    def to_dict(self):
        return {"id": self.id, "nome": self.nome, "email": self.email}


class Categoria(TimestampMixin, db.Model):
    __tablename__ = "categorias"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(60), nullable=False)
    cor = db.Column(db.String(7), nullable=False, default="#1B2A41")
    modulo = db.Column(db.String(20), nullable=False, default="geral")

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "cor": self.cor,
            "modulo": self.modulo,
        }


class Compromisso(TimestampMixin, db.Model):
    __tablename__ = "compromissos"

    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(160), nullable=False)
    descricao = db.Column(db.Text)
    inicio = db.Column(db.DateTime, nullable=False, index=True)
    fim = db.Column(db.DateTime)
    dia_inteiro = db.Column(db.Boolean, default=False, nullable=False)
    local = db.Column(db.String(160))
    categoria_id = db.Column(
        db.Integer, db.ForeignKey("categorias.id", ondelete="SET NULL")
    )
    recorrencia = db.Column(db.String(20), default="nenhuma", nullable=False)
    recorrencia_fim = db.Column(db.Date)
    lembrete_min = db.Column(db.Integer)  # minutos de antecedência

    categoria = db.relationship("Categoria", lazy="joined")
    excecoes = db.relationship(
        "CompromissoExcecao", backref="compromisso", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "titulo": self.titulo,
            "descricao": self.descricao,
            "inicio": self.inicio,
            "fim": self.fim,
            "dia_inteiro": self.dia_inteiro,
            "local": self.local,
            "categoria_id": self.categoria_id,
            "categoria": self.categoria.to_dict() if self.categoria else None,
            "recorrencia": self.recorrencia,
            "recorrencia_fim": self.recorrencia_fim,
            "lembrete_min": self.lembrete_min,
        }


class CompromissoExcecao(TimestampMixin, db.Model):
    """Cancelamento ou remarcação de UMA ocorrência de um compromisso recorrente.

    Sem esta tabela não há como dizer "a reunião dessa quinta não haverá"
    sem apagar a série inteira.
    """

    __tablename__ = "compromisso_excecoes"

    id = db.Column(db.Integer, primary_key=True)
    compromisso_id = db.Column(
        db.Integer,
        db.ForeignKey("compromissos.id", ondelete="CASCADE"),
        nullable=False,
    )
    data_original = db.Column(db.Date, nullable=False)
    cancelada = db.Column(db.Boolean, default=True, nullable=False)
    novo_inicio = db.Column(db.DateTime)
    novo_fim = db.Column(db.DateTime)

    __table_args__ = (
        db.UniqueConstraint("compromisso_id", "data_original", name="uq_excecao_data"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "compromisso_id": self.compromisso_id,
            "data_original": self.data_original,
            "cancelada": self.cancelada,
            "novo_inicio": self.novo_inicio,
            "novo_fim": self.novo_fim,
        }


class Lembrete(TimestampMixin, db.Model):
    __tablename__ = "lembretes"

    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(160), nullable=False)
    origem_tipo = db.Column(db.String(30))  # compromisso|escala|evento|tarefa|avulso
    origem_id = db.Column(db.Integer)
    disparar_em = db.Column(db.DateTime, nullable=False, index=True)
    enviado = db.Column(db.Boolean, default=False, nullable=False)

    # Sem esta restrição, cada chamada de /api/lembretes/pendentes
    # materializaria o mesmo lembrete outra vez.
    __table_args__ = (
        db.UniqueConstraint(
            "origem_tipo", "origem_id", "disparar_em", name="uq_lembrete_origem"
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "titulo": self.titulo,
            "origem_tipo": self.origem_tipo,
            "origem_id": self.origem_id,
            "disparar_em": self.disparar_em,
            "enviado": self.enviado,
        }


class Aviso(TimestampMixin, db.Model):
    __tablename__ = "avisos"

    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(160), nullable=False)
    conteudo = db.Column(db.Text)
    cor = db.Column(db.String(7), default="#F4E7B8")
    prioridade = db.Column(db.String(10), default="media")
    fixado = db.Column(db.Boolean, default=False, nullable=False)
    expira_em = db.Column(db.Date)

    def to_dict(self):
        return {
            "id": self.id,
            "titulo": self.titulo,
            "conteudo": self.conteudo,
            "cor": self.cor,
            "prioridade": self.prioridade,
            "fixado": self.fixado,
            "expira_em": self.expira_em,
        }


class Tarefa(TimestampMixin, db.Model):
    __tablename__ = "tarefas"

    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(200), nullable=False)
    descricao = db.Column(db.Text)
    status = db.Column(db.String(15), default="a_fazer", nullable=False)
    prioridade = db.Column(db.String(10), default="media")
    prazo = db.Column(db.Date, index=True)
    modulo = db.Column(db.String(20), default="geral", nullable=False)
    tags = db.Column(db.String(255))  # separadas por vírgula
    ordem = db.Column(db.Integer, default=0)
    concluida_em = db.Column(db.DateTime)

    subtarefas = db.relationship(
        "Subtarefa",
        backref="tarefa",
        cascade="all, delete-orphan",
        order_by="Subtarefa.id",
    )

    def to_dict(self, com_subtarefas=True):
        dados = {
            "id": self.id,
            "titulo": self.titulo,
            "descricao": self.descricao,
            "status": self.status,
            "prioridade": self.prioridade,
            "prazo": self.prazo,
            "modulo": self.modulo,
            "tags": [t.strip() for t in (self.tags or "").split(",") if t.strip()],
            "ordem": self.ordem,
            "concluida_em": self.concluida_em,
        }
        if com_subtarefas:
            dados["subtarefas"] = [s.to_dict() for s in self.subtarefas]
        return dados


class Subtarefa(TimestampMixin, db.Model):
    __tablename__ = "subtarefas"

    id = db.Column(db.Integer, primary_key=True)
    tarefa_id = db.Column(
        db.Integer, db.ForeignKey("tarefas.id", ondelete="CASCADE"), nullable=False
    )
    titulo = db.Column(db.String(200), nullable=False)
    concluida = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        return {"id": self.id, "titulo": self.titulo, "concluida": self.concluida}


class Anotacao(TimestampMixin, db.Model):
    __tablename__ = "anotacoes"

    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(200), nullable=False)
    conteudo_md = db.Column(db.Text)
    modulo = db.Column(db.String(20), default="geral", nullable=False)
    disciplina_id = db.Column(
        db.Integer, db.ForeignKey("disciplinas.id", ondelete="SET NULL")
    )
    fixada = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self, com_conteudo=True):
        dados = {
            "id": self.id,
            "titulo": self.titulo,
            "modulo": self.modulo,
            "disciplina_id": self.disciplina_id,
            "fixada": self.fixada,
            "atualizado_em": self.atualizado_em,
        }
        if com_conteudo:
            dados["conteudo_md"] = self.conteudo_md
        return dados


class Arquivo(TimestampMixin, db.Model):
    __tablename__ = "arquivos"

    id = db.Column(db.Integer, primary_key=True)
    nome_original = db.Column(db.String(255), nullable=False)
    caminho = db.Column(db.String(500), nullable=False)  # relativo a uploads/
    mimetype = db.Column(db.String(100))
    tamanho = db.Column(db.Integer)
    link_externo = db.Column(db.String(500))  # materiais que são só link
    modulo = db.Column(db.String(20), default="geral", nullable=False)
    tema = db.Column(db.String(100))
    disciplina_id = db.Column(
        db.Integer, db.ForeignKey("disciplinas.id", ondelete="SET NULL")
    )

    def to_dict(self):
        return {
            "id": self.id,
            "nome_original": self.nome_original,
            "mimetype": self.mimetype,
            "tamanho": self.tamanho,
            "link_externo": self.link_externo,
            "modulo": self.modulo,
            "tema": self.tema,
            "disciplina_id": self.disciplina_id,
            "url": f"/api/arquivos/{self.id}/download" if self.caminho else None,
            "criado_em": self.criado_em,
        }


# ══════════════════════════════ IGREJA ══════════════════════════════


class IgrejaEscala(TimestampMixin, db.Model):
    __tablename__ = "igreja_escalas"

    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Date, nullable=False, index=True)
    horario = db.Column(db.Time, nullable=False)
    celebracao = db.Column(db.String(160), nullable=False)
    funcao = db.Column(db.String(80))
    local = db.Column(db.String(160))
    status = db.Column(db.String(20), default="pendente")
    observacoes = db.Column(db.Text)

    @property
    def inicio(self):
        """Data e hora combinadas, para ordenação e contagem regressiva."""
        return datetime.combine(self.data, self.horario)

    def to_dict(self):
        return {
            "id": self.id,
            "data": self.data,
            "horario": self.horario,
            "inicio": self.inicio,
            "celebracao": self.celebracao,
            "funcao": self.funcao,
            "local": self.local,
            "status": self.status,
            "observacoes": self.observacoes,
        }


class IgrejaEvento(TimestampMixin, db.Model):
    __tablename__ = "igreja_eventos"

    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(160), nullable=False)
    tipo = db.Column(db.String(30), default="missa")
    data_hora = db.Column(db.DateTime, nullable=False, index=True)
    local = db.Column(db.String(160))
    descricao = db.Column(db.Text)
    lembrete_min = db.Column(db.Integer, default=1440)  # 1 dia antes

    def to_dict(self):
        return {
            "id": self.id,
            "titulo": self.titulo,
            "tipo": self.tipo,
            "data_hora": self.data_hora,
            "local": self.local,
            "descricao": self.descricao,
            "lembrete_min": self.lembrete_min,
        }


class IgrejaHorarioFixo(TimestampMixin, db.Model):
    __tablename__ = "igreja_horarios_fixos"

    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(20), nullable=False)  # missa|confissao|adoracao
    dia_semana = db.Column(db.SmallInteger, nullable=False)  # 0=segunda ... 6=domingo
    horario = db.Column(db.Time, nullable=False)
    local = db.Column(db.String(160))
    observacao = db.Column(db.String(255))

    def to_dict(self):
        return {
            "id": self.id,
            "tipo": self.tipo,
            "dia_semana": self.dia_semana,
            "horario": self.horario,
            "local": self.local,
            "observacao": self.observacao,
        }


class Oracao(TimestampMixin, db.Model):
    __tablename__ = "oracoes"

    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(160), nullable=False)
    texto = db.Column(db.Text, nullable=False)
    categoria = db.Column(db.String(40), default="pessoal")
    favorita = db.Column(db.Boolean, default=False, nullable=False)
    e_novena = db.Column(db.Boolean, default=False, nullable=False)
    dias_novena = db.Column(db.SmallInteger, default=9)

    progressos = db.relationship(
        "NovenaProgresso", backref="oracao", cascade="all, delete-orphan"
    )

    def to_dict(self, com_texto=True):
        dados = {
            "id": self.id,
            "titulo": self.titulo,
            "categoria": self.categoria,
            "favorita": self.favorita,
            "e_novena": self.e_novena,
            "dias_novena": self.dias_novena,
        }
        if com_texto:
            dados["texto"] = self.texto
        return dados


class NovenaProgresso(TimestampMixin, db.Model):
    __tablename__ = "novenas_progresso"

    id = db.Column(db.Integer, primary_key=True)
    oracao_id = db.Column(
        db.Integer, db.ForeignKey("oracoes.id", ondelete="CASCADE"), nullable=False
    )
    inicio = db.Column(db.Date, nullable=False)
    dia_atual = db.Column(db.SmallInteger, default=1, nullable=False)
    concluida = db.Column(db.Boolean, default=False, nullable=False)
    # Impede marcar o mesmo dia duas vezes.
    ultimo_dia_em = db.Column(db.Date)

    def to_dict(self):
        return {
            "id": self.id,
            "oracao_id": self.oracao_id,
            "inicio": self.inicio,
            "dia_atual": self.dia_atual,
            "concluida": self.concluida,
            "ultimo_dia_em": self.ultimo_dia_em,
            "total_dias": self.oracao.dias_novena if self.oracao else None,
        }


class Livro(TimestampMixin, db.Model):
    __tablename__ = "livros"

    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(200), nullable=False)
    autor = db.Column(db.String(160))
    total_paginas = db.Column(db.Integer)
    pagina_atual = db.Column(db.Integer, default=0)
    status = db.Column(db.String(15), default="quero_ler")
    modulo = db.Column(db.String(20), default="igreja", nullable=False)

    notas = db.relationship("LivroNota", backref="livro", cascade="all, delete-orphan")

    @property
    def progresso_pct(self):
        if not self.total_paginas:
            return None
        return round((self.pagina_atual or 0) / self.total_paginas * 100, 1)

    def to_dict(self):
        return {
            "id": self.id,
            "titulo": self.titulo,
            "autor": self.autor,
            "total_paginas": self.total_paginas,
            "pagina_atual": self.pagina_atual,
            "progresso_pct": self.progresso_pct,
            "status": self.status,
            "modulo": self.modulo,
        }


class LivroNota(TimestampMixin, db.Model):
    __tablename__ = "livro_notas"

    id = db.Column(db.Integer, primary_key=True)
    livro_id = db.Column(
        db.Integer, db.ForeignKey("livros.id", ondelete="CASCADE"), nullable=False
    )
    tipo = db.Column(db.String(10), default="nota")  # nota|citacao
    conteudo = db.Column(db.Text, nullable=False)
    pagina = db.Column(db.Integer)

    def to_dict(self):
        return {
            "id": self.id,
            "livro_id": self.livro_id,
            "tipo": self.tipo,
            "conteudo": self.conteudo,
            "pagina": self.pagina,
        }


class LiturgiaDataFixa(TimestampMixin, db.Model):
    """Solenidades e festas de data fixa, que o cálculo móvel não cobre.

    Consultada antes do cálculo e aplicada só quando o grau da celebração
    realmente sobrepõe o tempo vigente (ver services/liturgia.py).
    """

    __tablename__ = "liturgia_datas_fixas"

    id = db.Column(db.Integer, primary_key=True)
    mes = db.Column(db.SmallInteger, nullable=False)
    dia = db.Column(db.SmallInteger, nullable=False)
    titulo = db.Column(db.String(160), nullable=False)
    cor = db.Column(db.String(20), nullable=False, default="branco")
    grau = db.Column(db.String(20), nullable=False, default="memoria")

    __table_args__ = (db.UniqueConstraint("mes", "dia", "titulo", name="uq_data_fixa"),)

    def to_dict(self):
        return {
            "id": self.id,
            "mes": self.mes,
            "dia": self.dia,
            "titulo": self.titulo,
            "cor": self.cor,
            "grau": self.grau,
        }


# ══════════════════════════════ ESTUDOS ══════════════════════════════


class Disciplina(TimestampMixin, db.Model):
    __tablename__ = "disciplinas"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    cor = db.Column(db.String(7), default="#1B2A41")

    def to_dict(self):
        return {"id": self.id, "nome": self.nome, "cor": self.cor}


class Simulado(TimestampMixin, db.Model):
    __tablename__ = "simulados"

    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(200), nullable=False)
    banca = db.Column(db.String(100))
    data = db.Column(db.Date, nullable=False, index=True)
    arquivo_id = db.Column(
        db.Integer, db.ForeignKey("arquivos.id", ondelete="SET NULL")
    )
    total_questoes = db.Column(db.Integer, nullable=False)

    questoes = db.relationship(
        "SimuladoQuestao",
        backref="simulado",
        cascade="all, delete-orphan",
        order_by="SimuladoQuestao.numero",
    )
    arquivo = db.relationship("Arquivo")

    # Estas properties carregam todas as questões. Servem para a tela de
    # detalhe; a listagem agrega em SQL (ver routes/simulados.py).
    @property
    def acertos(self):
        return sum(1 for q in self.questoes if q.correta)

    @property
    def validas(self):
        return sum(1 for q in self.questoes if not q.anulada)

    def to_dict(self, com_questoes=False):
        dados = {
            "id": self.id,
            "titulo": self.titulo,
            "banca": self.banca,
            "data": self.data,
            "total_questoes": self.total_questoes,
            "arquivo_id": self.arquivo_id,
            "arquivo": self.arquivo.to_dict() if self.arquivo else None,
        }
        if com_questoes:
            dados["questoes"] = [q.to_dict() for q in self.questoes]
        return dados


class SimuladoQuestao(TimestampMixin, db.Model):
    __tablename__ = "simulado_questoes"

    id = db.Column(db.Integer, primary_key=True)
    simulado_id = db.Column(
        db.Integer, db.ForeignKey("simulados.id", ondelete="CASCADE"), nullable=False
    )
    numero = db.Column(db.Integer, nullable=False)
    disciplina_id = db.Column(
        db.Integer, db.ForeignKey("disciplinas.id", ondelete="SET NULL")
    )
    gabarito = db.Column(db.String(1))  # A-E, ou C/E em provas de certo/errado
    resposta = db.Column(db.String(1))
    anulada = db.Column(db.Boolean, default=False, nullable=False)

    __table_args__ = (
        db.UniqueConstraint("simulado_id", "numero", name="uq_questao_numero"),
    )

    @property
    def correta(self):
        return (
            not self.anulada
            and self.resposta is not None
            and self.resposta.upper() == (self.gabarito or "").upper()
        )

    @property
    def em_branco(self):
        return not self.anulada and not self.resposta

    def to_dict(self):
        return {
            "id": self.id,
            "simulado_id": self.simulado_id,
            "numero": self.numero,
            "disciplina_id": self.disciplina_id,
            "gabarito": self.gabarito,
            "resposta": self.resposta,
            "anulada": self.anulada,
            "correta": self.correta,
        }


class CadernoErro(TimestampMixin, db.Model):
    __tablename__ = "caderno_erros"

    id = db.Column(db.Integer, primary_key=True)
    questao_id = db.Column(
        db.Integer, db.ForeignKey("simulado_questoes.id", ondelete="SET NULL")
    )
    disciplina_id = db.Column(
        db.Integer, db.ForeignKey("disciplinas.id", ondelete="SET NULL")
    )
    resumo_questao = db.Column(db.Text)
    motivo = db.Column(db.String(30))
    explicacao = db.Column(db.Text)
    revisado = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "questao_id": self.questao_id,
            "disciplina_id": self.disciplina_id,
            "resumo_questao": self.resumo_questao,
            "motivo": self.motivo,
            "explicacao": self.explicacao,
            "revisado": self.revisado,
            "criado_em": self.criado_em,
        }


class Flashcard(TimestampMixin, db.Model):
    __tablename__ = "flashcards"

    id = db.Column(db.Integer, primary_key=True)
    disciplina_id = db.Column(
        db.Integer, db.ForeignKey("disciplinas.id", ondelete="CASCADE")
    )
    frente = db.Column(db.Text, nullable=False)
    verso = db.Column(db.Text, nullable=False)
    intervalo_dias = db.Column(db.Integer, default=1, nullable=False)
    proxima_revisao = db.Column(db.Date, index=True)
    # Necessários para a revisão espaçada (services/srs.py).
    ultima_revisao = db.Column(db.Date)
    acertos_seguidos = db.Column(db.Integer, default=0, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "disciplina_id": self.disciplina_id,
            "frente": self.frente,
            "verso": self.verso,
            "intervalo_dias": self.intervalo_dias,
            "proxima_revisao": self.proxima_revisao,
            "ultima_revisao": self.ultima_revisao,
            "acertos_seguidos": self.acertos_seguidos,
        }


class SessaoEstudo(TimestampMixin, db.Model):
    __tablename__ = "sessoes_estudo"

    id = db.Column(db.Integer, primary_key=True)
    disciplina_id = db.Column(
        db.Integer, db.ForeignKey("disciplinas.id", ondelete="SET NULL")
    )
    inicio = db.Column(db.DateTime, nullable=False, index=True)
    duracao_min = db.Column(db.Integer, nullable=False)
    tipo = db.Column(db.String(15), default="pomodoro")

    def to_dict(self):
        return {
            "id": self.id,
            "disciplina_id": self.disciplina_id,
            "inicio": self.inicio,
            "duracao_min": self.duracao_min,
            "tipo": self.tipo,
        }


class Meta(TimestampMixin, db.Model):
    __tablename__ = "metas"

    id = db.Column(db.Integer, primary_key=True)
    disciplina_id = db.Column(
        db.Integer, db.ForeignKey("disciplinas.id", ondelete="CASCADE")
    )
    descricao = db.Column(db.String(200), nullable=False)
    alvo_horas = db.Column(db.Float, nullable=False)
    periodo = db.Column(db.String(10), default="semanal")
    ativa = db.Column(db.Boolean, default=True, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "disciplina_id": self.disciplina_id,
            "descricao": self.descricao,
            "alvo_horas": self.alvo_horas,
            "periodo": self.periodo,
            "ativa": self.ativa,
        }
