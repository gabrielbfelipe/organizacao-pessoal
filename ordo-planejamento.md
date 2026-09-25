# ✝ Ordo — Organizador Pessoal

> *Ordo*, do latim, significa "ordem". Também é o nome do calendário litúrgico que orienta as celebrações da Igreja.
> Stack: **HTML + CSS + JavaScript** no frontend, **Python (Flask)** no backend e **MySQL local** como banco de dados.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Stack e bibliotecas](#2-stack-e-bibliotecas)
3. [Módulos e funcionalidades](#3-módulos-e-funcionalidades)
4. [Design system](#4-design-system)
5. [Estrutura de pastas](#5-estrutura-de-pastas)
6. [Banco de dados criado automaticamente](#6-banco-de-dados-criado-automaticamente)
7. [Código de inicialização](#7-código-de-inicialização)
8. [Como rodar](#8-como-rodar)
9. [Rotas da API](#9-rotas-da-api)
10. [Roadmap de desenvolvimento](#10-roadmap-de-desenvolvimento)

---

## 1. Visão geral

O Ordo reúne num só lugar:

- **Vida pessoal:** agenda, tarefas, quadro de avisos e lembretes.
- **Igreja:** escala de cerimoniário, eventos e missas, horários fixos, orações, materiais, leituras e anotações.
- **Estudos:** simulados com correção automática, caderno de erros, flashcards, Pomodoro, metas e anotações.

Tudo converge para um **dashboard inicial** que mostra o que importa hoje.

---

## 2. Stack e bibliotecas

### Backend (Python)

| Biblioteca | Função |
|---|---|
| **Flask** | Servidor web e API REST |
| **Flask-SQLAlchemy** | ORM (modelos Python → tabelas MySQL) |
| **PyMySQL** + **cryptography** | Driver do MySQL (o `cryptography` é necessário para o MySQL 8) |
| **Flask-Login** | Login e sessão |
| **python-dotenv** | Lê as credenciais do arquivo `.env` |
| **python-dateutil** | Cálculo da Páscoa e, a partir dela, do tempo litúrgico |

### Frontend (via CDN)

| Biblioteca | Função |
|---|---|
| **FullCalendar** | Agenda com visões de mês, semana e dia e arrastar e soltar |
| **SortableJS** | Kanban de tarefas |
| **Chart.js** | Gráficos de desempenho em simulados e horas de estudo |
| **EasyMDE** | Editor de anotações em Markdown |
| **PDF.js** | Visualizar simulados e materiais sem sair do sistema |
| **Lucide Icons** | Ícones |
| **Notification API** (nativa) | Notificações de lembretes no navegador |

---

## 3. Módulos e funcionalidades

### 🏠 Dashboard inicial

- Saudação com a data e o **tempo litúrgico atual**, com faixa na cor litúrgica (roxo, verde, branco, vermelho ou rosa).
- **Card "Minha próxima escala"**, em destaque e separado do resto, com data, horário, celebração, função e contagem regressiva.
- Compromissos de hoje e dos próximos 7 dias.
- Lembretes pendentes.
- Avisos fixados.
- Tarefas do dia e tarefas atrasadas.
- Próximo evento da paróquia e o próximo horário de confissão.
- **Oração do momento**, que muda conforme o horário (manhã, Angelus ao meio-dia, noite).
- Resumo de estudos: horas estudadas na semana e a nota do último simulado.

### 📅 Agenda

- Compromissos com categoria e cor (Pessoal, Igreja, Estudos, Trabalho).
- Recorrência diária, semanal ou mensal, com data de término.
- Lembrete com antecedência configurável (15 min, 1 h, 1 dia).
- A agenda unificada também exibe as escalas e os eventos da igreja, com filtro por categoria.

### 📌 Quadro de avisos

- Cartões no estilo post-it, com cor, prioridade e opção de fixar.
- Data de expiração: o aviso some do quadro quando vence.

### ✅ Tarefas

- Duas visões: **Kanban** (A fazer, Fazendo, Feito) e **Tabela** com filtros e ordenação.
- Prioridade, prazo, subtarefas (checklist) e tags.
- Tarefas podem ser vinculadas a um módulo (Geral, Igreja ou Estudos).

### ⛪ Igreja

- **Escala de cerimoniário**
  - Cadastro com data, horário, celebração, local e função (mestre de cerimônias, turiferário, naveteiro, cruciferário, ceroferário etc.).
  - Status: pendente, confirmada ou troca solicitada.
  - Campo de observações para cada celebração.
  - Cadastro em lote da escala do mês.
  - A próxima escala aparece no dashboard em card próprio.
- **Eventos e missas:** solenidades, festas, retiros, ensaios e formações, com lembrete automático.
- **Horários fixos:** grade semanal de missas, confissões e adoração.
- **Orações**
  - Biblioteca com categorias (manhã, noite, terço, novenas, ladainhas, pessoais) e favoritas.
  - **Modo "Rezar"** em tela cheia, com fonte grande, fundo escuro e sem distrações.
  - Novenas com contador de progresso ("Dia 4 de 9").
- **Materiais de estudo:** PDFs e links por tema (IGMR, Cerimonial dos Bispos, Catecismo, Liturgia, Documentos).
- **Leituras:** livros religiosos com progresso de páginas, notas, citações e status (lendo, lido, quero ler).
- **Anotações gerais** da igreja, em Markdown.

### 📚 Estudos

- **Disciplinas** com cor, que organizam todo o módulo.
- **Simulados**
  - Upload do PDF da prova, com data, banca e número de questões.
  - Cadastro do **gabarito oficial** e das **suas respostas**, com **correção automática**.
  - Acertos por disciplina e gráfico de evolução ao longo do tempo.
  - Suporte a questões anuladas.
- **Caderno de erros:** cada questão errada pode virar um registro com motivo do erro e explicação correta, para revisão.
- **Anotações** por disciplina, em Markdown.
- **Flashcards** com revisão espaçada simples: "fácil", "médio" ou "difícil" define a próxima revisão.
- **Pomodoro:** timer que registra automaticamente as horas estudadas por disciplina.
- **Metas:** por exemplo, "10 h de Matemática por semana", com barra de progresso.
- **Livros e materiais** de estudo, reaproveitando as mesmas tabelas do módulo Igreja.

### 🔎 Recursos gerais

- Busca global (atalho **Ctrl+K**) em tarefas, notas, orações e materiais.
- Modo escuro.
- Backup: exportação do banco em `.sql`.

---

## 4. Design system

**Conceito:** elegante e sereno, com um toque clássico que não pesa na interface.

### Cores

```css
:root {
  --ink:        #1B2A41;  /* sidebar e títulos */
  --paper:      #F7F5F0;  /* fundo */
  --card:       #FFFFFF;
  --gold:       #B8963E;  /* destaques e ações */
  --text:       #2B2B2B;
  --muted:      #7A7568;
  --border:     #E6E1D6;
  --success:    #2E7D4F;
  --danger:     #B22222;

  /* cores litúrgicas */
  --lit-roxo:     #6B3FA0;
  --lit-verde:    #2E7D4F;
  --lit-branco:   #E8E1CF;
  --lit-vermelho: #B22222;
  --lit-rosa:     #D98CA6;

  --radius: 14px;
  --shadow: 0 4px 20px rgba(27, 42, 65, 0.06);
}
```

### Tipografia

- **Títulos:** *Cormorant Garamond* (600), para o toque sóbrio e litúrgico.
- **Interface e textos:** *Inter* (400, 500, 600), pela legibilidade.
- **Modo Rezar:** *Cormorant Garamond* em corpo grande (22 a 26 px).

### Layout

- Sidebar fixa à esquerda com os módulos: Dashboard, Agenda, Tarefas, Avisos, Igreja, Estudos e Configurações.
- Conteúdo em cards com bordas suaves e sombras leves.
- Dashboard em grid de 3 colunas no desktop e 1 coluna no celular, com o card da escala sempre no topo.
- A faixa superior assume a cor do tempo litúrgico vigente.

---

## 5. Estrutura de pastas

```
ordo/
├── backend/
│   ├── app.py               ← arquivo que você executa ("play")
│   ├── config.py
│   ├── database.py          ← cria o banco se não existir
│   ├── models.py            ← todas as tabelas
│   ├── seed.py              ← dados iniciais
│   ├── requirements.txt
│   ├── .env                 ← suas credenciais (não versionar)
│   ├── .env.example
│   ├── routes/              ← blueprints: agenda, tarefas, igreja, estudos...
│   ├── services/
│   │   ├── __init__.py
│   │   ├── liturgia.py      ← cálculo do tempo litúrgico
│   │   ├── correcao.py      ← correção de simulados
│   │   └── lembretes.py
│   └── uploads/             ← criada automaticamente
└── frontend/
    ├── index.html           ← dashboard
    ├── pages/
    ├── css/
    │   ├── variables.css
    │   ├── base.css
    │   └── components.css
    └── js/
        ├── api.js
        ├── dashboard.js
        └── ...
```

---

## 6. Banco de dados criado automaticamente

Ao rodar `python app.py`, a inicialização executa estas etapas em ordem:

1. **Lê o `.env`** com usuário, senha, host e nome do banco.
2. **Conecta ao MySQL sem banco selecionado** e executa `CREATE DATABASE IF NOT EXISTS ordo`.
3. **Cria a pasta `uploads/`**, se não existir.
4. **`db.create_all()`** cria todas as tabelas que ainda não existem, a partir dos modelos em `models.py`.
5. **`popular_dados_iniciais()`** insere as categorias padrão e o usuário inicial, somente se ainda não existirem.

Tudo é **idempotente**: rodar várias vezes não duplica nem apaga nada.

> ⚠️ **Importante:** o `create_all()` cria tabelas novas, mas **não altera tabelas existentes**. Se depois você adicionar uma coluna a um modelo já criado, use o **Flask-Migrate** (`flask db migrate` / `flask db upgrade`) ou faça um `ALTER TABLE` manual.

### Diagrama resumido das tabelas

```
GERAL        usuarios · categorias · compromissos · lembretes · avisos
             tarefas ─< subtarefas · anotacoes · arquivos

IGREJA       igreja_escalas · igreja_eventos · igreja_horarios_fixos
             oracoes ─< novenas_progresso · livros ─< livro_notas

ESTUDOS      disciplinas · simulados ─< simulado_questoes ─< caderno_erros
             flashcards · sessoes_estudo · metas
```

`anotacoes`, `arquivos` e `livros` são tabelas genéricas que atendem vários módulos pelo campo `modulo` (`geral`, `igreja` ou `estudos`), o que evita duplicar estrutura.

---

## 7. Código de inicialização

### `requirements.txt`

```text
Flask>=3.0
Flask-SQLAlchemy>=3.1
Flask-Login>=0.6
PyMySQL>=1.1
cryptography>=42.0
python-dotenv>=1.0
python-dateutil>=2.9
```

### `.env.example`

Copie para `.env` e preencha com os seus dados:

```ini
DB_USER=root
DB_PASSWORD=sua_senha_do_mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ordo

SECRET_KEY=troque-por-uma-chave-longa-e-aleatoria

ADMIN_NOME=Seu Nome
ADMIN_EMAIL=seu@email.com
ADMIN_SENHA=troque-esta-senha
```

### `config.py`

```python
import os
from urllib.parse import quote_plus
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))


class Config:
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", 3306))
    DB_NAME = os.getenv("DB_NAME", "ordo")

    # quote_plus protege senhas com caracteres especiais (@, #, etc.)
    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{DB_USER}:{quote_plus(DB_PASSWORD)}"
        f"@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_recycle": 280, "pool_pre_ping": True}

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-key-troque-isto")

    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB por arquivo

    ADMIN_NOME = os.getenv("ADMIN_NOME", "Administrador")
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@ordo.local")
    ADMIN_SENHA = os.getenv("ADMIN_SENHA", "admin123")
```

### `database.py`

```python
import re
import pymysql
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def criar_banco_se_nao_existir(cfg):
    """Conecta ao MySQL sem banco selecionado e cria o banco, se necessário."""
    if not re.fullmatch(r"[A-Za-z0-9_]+", cfg.DB_NAME):
        raise ValueError("DB_NAME deve conter apenas letras, números e _")

    conexao = pymysql.connect(
        host=cfg.DB_HOST,
        port=cfg.DB_PORT,
        user=cfg.DB_USER,
        password=cfg.DB_PASSWORD,
        charset="utf8mb4",
    )
    try:
        with conexao.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{cfg.DB_NAME}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        conexao.commit()
        print(f"✔ Banco '{cfg.DB_NAME}' pronto.")
    finally:
        conexao.close()
```

### `models.py`

```python
from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from database import db


class TimestampMixin:
    criado_em = db.Column(db.DateTime, default=datetime.now, nullable=False)
    atualizado_em = db.Column(db.DateTime, default=datetime.now,
                              onupdate=datetime.now, nullable=False)


# ─────────────────────────── GERAL ───────────────────────────

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


class Categoria(TimestampMixin, db.Model):
    __tablename__ = "categorias"
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(60), nullable=False)
    cor = db.Column(db.String(7), nullable=False, default="#1B2A41")
    modulo = db.Column(db.String(20), nullable=False, default="geral")


class Compromisso(TimestampMixin, db.Model):
    __tablename__ = "compromissos"
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(160), nullable=False)
    descricao = db.Column(db.Text)
    inicio = db.Column(db.DateTime, nullable=False, index=True)
    fim = db.Column(db.DateTime)
    dia_inteiro = db.Column(db.Boolean, default=False, nullable=False)
    local = db.Column(db.String(160))
    categoria_id = db.Column(db.Integer,
                             db.ForeignKey("categorias.id", ondelete="SET NULL"))
    recorrencia = db.Column(db.String(20), default="nenhuma", nullable=False)  # nenhuma|diaria|semanal|mensal
    recorrencia_fim = db.Column(db.Date)
    lembrete_min = db.Column(db.Integer)  # minutos de antecedência

    categoria = db.relationship("Categoria")


class Lembrete(TimestampMixin, db.Model):
    __tablename__ = "lembretes"
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(160), nullable=False)
    origem_tipo = db.Column(db.String(30))  # compromisso|escala|evento|tarefa|avulso
    origem_id = db.Column(db.Integer)
    disparar_em = db.Column(db.DateTime, nullable=False, index=True)
    enviado = db.Column(db.Boolean, default=False, nullable=False)


class Aviso(TimestampMixin, db.Model):
    __tablename__ = "avisos"
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(160), nullable=False)
    conteudo = db.Column(db.Text)
    cor = db.Column(db.String(7), default="#F4E7B8")
    prioridade = db.Column(db.String(10), default="media")  # baixa|media|alta
    fixado = db.Column(db.Boolean, default=False, nullable=False)
    expira_em = db.Column(db.Date)


class Tarefa(TimestampMixin, db.Model):
    __tablename__ = "tarefas"
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(200), nullable=False)
    descricao = db.Column(db.Text)
    status = db.Column(db.String(15), default="a_fazer", nullable=False)  # a_fazer|fazendo|feito
    prioridade = db.Column(db.String(10), default="media")
    prazo = db.Column(db.Date, index=True)
    modulo = db.Column(db.String(20), default="geral", nullable=False)
    tags = db.Column(db.String(255))  # separadas por vírgula
    ordem = db.Column(db.Integer, default=0)
    concluida_em = db.Column(db.DateTime)

    subtarefas = db.relationship("Subtarefa", backref="tarefa",
                                 cascade="all, delete-orphan",
                                 order_by="Subtarefa.id")


class Subtarefa(TimestampMixin, db.Model):
    __tablename__ = "subtarefas"
    id = db.Column(db.Integer, primary_key=True)
    tarefa_id = db.Column(db.Integer,
                          db.ForeignKey("tarefas.id", ondelete="CASCADE"),
                          nullable=False)
    titulo = db.Column(db.String(200), nullable=False)
    concluida = db.Column(db.Boolean, default=False, nullable=False)


class Anotacao(TimestampMixin, db.Model):
    __tablename__ = "anotacoes"
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(200), nullable=False)
    conteudo_md = db.Column(db.Text)
    modulo = db.Column(db.String(20), default="geral", nullable=False)  # geral|igreja|estudos
    disciplina_id = db.Column(db.Integer,
                              db.ForeignKey("disciplinas.id", ondelete="SET NULL"))
    fixada = db.Column(db.Boolean, default=False, nullable=False)


class Arquivo(TimestampMixin, db.Model):
    __tablename__ = "arquivos"
    id = db.Column(db.Integer, primary_key=True)
    nome_original = db.Column(db.String(255), nullable=False)
    caminho = db.Column(db.String(500), nullable=False)  # relativo a uploads/
    mimetype = db.Column(db.String(100))
    tamanho = db.Column(db.Integer)
    link_externo = db.Column(db.String(500))  # para materiais que são só links
    modulo = db.Column(db.String(20), default="geral", nullable=False)
    tema = db.Column(db.String(100))  # ex.: IGMR, Catecismo, Matemática
    disciplina_id = db.Column(db.Integer,
                              db.ForeignKey("disciplinas.id", ondelete="SET NULL"))


# ─────────────────────────── IGREJA ───────────────────────────

class IgrejaEscala(TimestampMixin, db.Model):
    __tablename__ = "igreja_escalas"
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Date, nullable=False, index=True)
    horario = db.Column(db.Time, nullable=False)
    celebracao = db.Column(db.String(160), nullable=False)
    funcao = db.Column(db.String(80))  # mestre de cerimônias, turiferário...
    local = db.Column(db.String(160))
    status = db.Column(db.String(20), default="pendente")  # pendente|confirmada|troca_solicitada
    observacoes = db.Column(db.Text)


class IgrejaEvento(TimestampMixin, db.Model):
    __tablename__ = "igreja_eventos"
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(160), nullable=False)
    tipo = db.Column(db.String(30), default="missa")  # missa|solenidade|festa|retiro|ensaio|formacao
    data_hora = db.Column(db.DateTime, nullable=False, index=True)
    local = db.Column(db.String(160))
    descricao = db.Column(db.Text)
    lembrete_min = db.Column(db.Integer, default=1440)  # 1 dia antes


class IgrejaHorarioFixo(TimestampMixin, db.Model):
    __tablename__ = "igreja_horarios_fixos"
    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(20), nullable=False)  # missa|confissao|adoracao
    dia_semana = db.Column(db.SmallInteger, nullable=False)  # 0=segunda ... 6=domingo
    horario = db.Column(db.Time, nullable=False)
    local = db.Column(db.String(160))
    observacao = db.Column(db.String(255))


class Oracao(TimestampMixin, db.Model):
    __tablename__ = "oracoes"
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(160), nullable=False)
    texto = db.Column(db.Text, nullable=False)
    categoria = db.Column(db.String(40), default="pessoal")  # manha|noite|terco|novena|ladainha|pessoal
    favorita = db.Column(db.Boolean, default=False, nullable=False)
    e_novena = db.Column(db.Boolean, default=False, nullable=False)
    dias_novena = db.Column(db.SmallInteger, default=9)

    progressos = db.relationship("NovenaProgresso", backref="oracao",
                                 cascade="all, delete-orphan")


class NovenaProgresso(TimestampMixin, db.Model):
    __tablename__ = "novenas_progresso"
    id = db.Column(db.Integer, primary_key=True)
    oracao_id = db.Column(db.Integer,
                          db.ForeignKey("oracoes.id", ondelete="CASCADE"),
                          nullable=False)
    inicio = db.Column(db.Date, nullable=False)
    dia_atual = db.Column(db.SmallInteger, default=1, nullable=False)
    concluida = db.Column(db.Boolean, default=False, nullable=False)


class Livro(TimestampMixin, db.Model):
    __tablename__ = "livros"
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(200), nullable=False)
    autor = db.Column(db.String(160))
    total_paginas = db.Column(db.Integer)
    pagina_atual = db.Column(db.Integer, default=0)
    status = db.Column(db.String(15), default="quero_ler")  # quero_ler|lendo|lido
    modulo = db.Column(db.String(20), default="igreja", nullable=False)

    notas = db.relationship("LivroNota", backref="livro",
                            cascade="all, delete-orphan")


class LivroNota(TimestampMixin, db.Model):
    __tablename__ = "livro_notas"
    id = db.Column(db.Integer, primary_key=True)
    livro_id = db.Column(db.Integer,
                         db.ForeignKey("livros.id", ondelete="CASCADE"),
                         nullable=False)
    tipo = db.Column(db.String(10), default="nota")  # nota|citacao
    conteudo = db.Column(db.Text, nullable=False)
    pagina = db.Column(db.Integer)


# ─────────────────────────── ESTUDOS ───────────────────────────

class Disciplina(TimestampMixin, db.Model):
    __tablename__ = "disciplinas"
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    cor = db.Column(db.String(7), default="#1B2A41")


class Simulado(TimestampMixin, db.Model):
    __tablename__ = "simulados"
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(200), nullable=False)
    banca = db.Column(db.String(100))
    data = db.Column(db.Date, nullable=False)
    arquivo_id = db.Column(db.Integer,
                           db.ForeignKey("arquivos.id", ondelete="SET NULL"))
    total_questoes = db.Column(db.Integer, nullable=False)

    questoes = db.relationship("SimuladoQuestao", backref="simulado",
                               cascade="all, delete-orphan",
                               order_by="SimuladoQuestao.numero")

    @property
    def acertos(self):
        return sum(1 for q in self.questoes if q.correta)

    @property
    def validas(self):
        return sum(1 for q in self.questoes if not q.anulada)


class SimuladoQuestao(TimestampMixin, db.Model):
    __tablename__ = "simulado_questoes"
    id = db.Column(db.Integer, primary_key=True)
    simulado_id = db.Column(db.Integer,
                            db.ForeignKey("simulados.id", ondelete="CASCADE"),
                            nullable=False)
    numero = db.Column(db.Integer, nullable=False)
    disciplina_id = db.Column(db.Integer,
                              db.ForeignKey("disciplinas.id", ondelete="SET NULL"))
    gabarito = db.Column(db.String(1))  # A-E, ou C/E em provas de certo/errado
    resposta = db.Column(db.String(1))
    anulada = db.Column(db.Boolean, default=False, nullable=False)

    __table_args__ = (db.UniqueConstraint("simulado_id", "numero"),)

    @property
    def correta(self):
        return (not self.anulada and self.resposta is not None
                and self.resposta.upper() == (self.gabarito or "").upper())


class CadernoErro(TimestampMixin, db.Model):
    __tablename__ = "caderno_erros"
    id = db.Column(db.Integer, primary_key=True)
    questao_id = db.Column(db.Integer,
                           db.ForeignKey("simulado_questoes.id", ondelete="SET NULL"))
    disciplina_id = db.Column(db.Integer,
                              db.ForeignKey("disciplinas.id", ondelete="SET NULL"))
    resumo_questao = db.Column(db.Text)
    motivo = db.Column(db.String(30))  # falta_conteudo|desatencao|interpretacao|tempo
    explicacao = db.Column(db.Text)
    revisado = db.Column(db.Boolean, default=False, nullable=False)


class Flashcard(TimestampMixin, db.Model):
    __tablename__ = "flashcards"
    id = db.Column(db.Integer, primary_key=True)
    disciplina_id = db.Column(db.Integer,
                              db.ForeignKey("disciplinas.id", ondelete="CASCADE"))
    frente = db.Column(db.Text, nullable=False)
    verso = db.Column(db.Text, nullable=False)
    intervalo_dias = db.Column(db.Integer, default=1, nullable=False)
    proxima_revisao = db.Column(db.Date, index=True)


class SessaoEstudo(TimestampMixin, db.Model):
    __tablename__ = "sessoes_estudo"
    id = db.Column(db.Integer, primary_key=True)
    disciplina_id = db.Column(db.Integer,
                              db.ForeignKey("disciplinas.id", ondelete="SET NULL"))
    inicio = db.Column(db.DateTime, nullable=False, index=True)
    duracao_min = db.Column(db.Integer, nullable=False)
    tipo = db.Column(db.String(15), default="pomodoro")  # pomodoro|livre


class Meta(TimestampMixin, db.Model):
    __tablename__ = "metas"
    id = db.Column(db.Integer, primary_key=True)
    disciplina_id = db.Column(db.Integer,
                              db.ForeignKey("disciplinas.id", ondelete="CASCADE"))
    descricao = db.Column(db.String(200), nullable=False)
    alvo_horas = db.Column(db.Float, nullable=False)
    periodo = db.Column(db.String(10), default="semanal")  # semanal|mensal
    ativa = db.Column(db.Boolean, default=True, nullable=False)
```

### `seed.py`

```python
from database import db
from models import Usuario, Categoria

CATEGORIAS_PADRAO = [
    ("Pessoal", "#1B2A41", "geral"),
    ("Trabalho", "#4A6FA5", "geral"),
    ("Igreja", "#B8963E", "igreja"),
    ("Estudos", "#2E7D4F", "estudos"),
    ("Saúde", "#B22222", "geral"),
]


def popular_dados_iniciais(cfg):
    """Insere dados padrão apenas se as tabelas estiverem vazias."""
    if not Categoria.query.first():
        for nome, cor, modulo in CATEGORIAS_PADRAO:
            db.session.add(Categoria(nome=nome, cor=cor, modulo=modulo))
        print("✔ Categorias padrão criadas.")

    if not Usuario.query.first():
        usuario = Usuario(nome=cfg.ADMIN_NOME, email=cfg.ADMIN_EMAIL)
        usuario.definir_senha(cfg.ADMIN_SENHA)
        db.session.add(usuario)
        print(f"✔ Usuário inicial criado: {cfg.ADMIN_EMAIL}")

    db.session.commit()
```

### `services/liturgia.py`

Calcula o tempo litúrgico e a cor do dia, seguindo o calendário do Brasil (Epifania no domingo entre 2 e 8 de janeiro). O cálculo foi testado com as datas de 2026 e 2027.

```python
from datetime import date, timedelta
from dateutil.easter import easter

CORES = {
    "roxo": "#6B3FA0",
    "verde": "#2E7D4F",
    "branco": "#E8E1CF",
    "vermelho": "#B22222",
    "rosa": "#D98CA6",
}


def _primeiro_domingo_advento(ano):
    natal = date(ano, 12, 25)
    dias_desde_domingo = (natal.weekday() + 1) % 7
    quarto_domingo = natal - timedelta(days=dias_desde_domingo or 7)
    return quarto_domingo - timedelta(weeks=3)


def _batismo_do_senhor(ano):
    # No Brasil, a Epifania é celebrada no domingo entre 2 e 8 de janeiro
    jan2 = date(ano, 1, 2)
    epifania = jan2 + timedelta(days=(6 - jan2.weekday()) % 7)
    if epifania.day >= 7:
        return epifania + timedelta(days=1)  # segunda-feira seguinte
    return epifania + timedelta(days=7)


def _resultado(tempo, cor, celebracao=None):
    return {"tempo": tempo, "cor": cor, "cor_hex": CORES[cor], "celebracao": celebracao}


def tempo_liturgico(d=None):
    d = d or date.today()
    pascoa = easter(d.year)
    cinzas = pascoa - timedelta(days=46)
    pentecostes = pascoa + timedelta(days=49)
    advento = _primeiro_domingo_advento(d.year)
    batismo = _batismo_do_senhor(d.year)

    if d <= batismo:
        return _resultado("Tempo do Natal", "branco")
    if d < cinzas:
        return _resultado("Tempo Comum", "verde")
    if d == pascoa - timedelta(days=21):
        return _resultado("Quaresma", "rosa", "Domingo Laetare")
    if d == pascoa - timedelta(days=7):
        return _resultado("Semana Santa", "vermelho", "Domingo de Ramos")
    if d < pascoa - timedelta(days=3):
        return _resultado("Quaresma", "roxo",
                          "Quarta-feira de Cinzas" if d == cinzas else None)
    if d == pascoa - timedelta(days=3):
        return _resultado("Tríduo Pascal", "branco", "Quinta-feira Santa")
    if d == pascoa - timedelta(days=2):
        return _resultado("Tríduo Pascal", "vermelho", "Sexta-feira da Paixão")
    if d == pascoa - timedelta(days=1):
        return _resultado("Tríduo Pascal", "roxo", "Sábado Santo")
    if d < pentecostes:
        return _resultado("Tempo Pascal", "branco",
                          "Domingo de Páscoa" if d == pascoa else None)
    if d == pentecostes:
        return _resultado("Tempo Pascal", "vermelho", "Pentecostes")
    if d < advento:
        return _resultado("Tempo Comum", "verde")
    if d == advento + timedelta(days=14):
        return _resultado("Advento", "rosa", "Domingo Gaudete")
    if d < date(d.year, 12, 25):
        return _resultado("Advento", "roxo")
    return _resultado("Tempo do Natal", "branco",
                      "Natal do Senhor" if d == date(d.year, 12, 25) else None)
```

> Crie também um arquivo vazio `services/__init__.py` para o Python reconhecer a pasta como pacote.
>
> Limitação: o cálculo cobre tempos e datas móveis principais. Solenidades e festas fixas (por exemplo, a cor vermelha nos mártires) podem ser adicionadas depois com uma tabela de datas fixas.

### `app.py` — o arquivo que você executa

```python
import os
from flask import Flask, jsonify
from flask_login import LoginManager

from config import Config
from database import db, criar_banco_se_nao_existir
import models  # importa os modelos para que o create_all os enxergue
from seed import popular_dados_iniciais
from services.liturgia import tempo_liturgico

login_manager = LoginManager()


@login_manager.user_loader
def carregar_usuario(usuario_id):
    return db.session.get(models.Usuario, int(usuario_id))


def create_app():
    app = Flask(
        __name__,
        static_folder=os.path.join(os.path.dirname(__file__), "..", "frontend"),
        static_url_path="",
    )
    app.config.from_object(Config)

    # 1) Cria o banco no MySQL, se não existir
    criar_banco_se_nao_existir(Config)

    # 2) Garante a pasta de uploads
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)

    # 3) Liga as extensões
    db.init_app(app)
    login_manager.init_app(app)

    # 4) Cria as tabelas e os dados iniciais
    with app.app_context():
        db.create_all()
        print("✔ Tabelas verificadas/criadas.")
        popular_dados_iniciais(Config)

    # 5) Rotas (depois, mova para blueprints em routes/)
    @app.route("/")
    def index():
        return app.send_static_file("index.html")

    @app.route("/api/liturgia/hoje")
    def liturgia_hoje():
        return jsonify(tempo_liturgico())

    # Exemplo de registro de blueprints:
    # from routes.agenda import bp as agenda_bp
    # app.register_blueprint(agenda_bp, url_prefix="/api/agenda")

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)
```

> Com `debug=True`, o Flask reinicia o processo uma vez ao subir, então as mensagens aparecem duas vezes no terminal. Isso é normal e não duplica nada, já que tudo é idempotente.

---

## 8. Como rodar

1. **Tenha o MySQL rodando** localmente. O usuário do `.env` precisa ter permissão de `CREATE` (o `root` local já tem).
2. No terminal, dentro de `backend/`:

   ```bash
   python -m venv venv

   # Windows
   venv\Scripts\activate
   # Linux/macOS
   source venv/bin/activate

   pip install -r requirements.txt
   ```

3. **Copie `.env.example` para `.env`** e preencha com a sua senha do MySQL.
4. **Dê o play:**

   ```bash
   python app.py
   ```

5. A saída esperada no terminal:

   ```
   ✔ Banco 'ordo' pronto.
   ✔ Tabelas verificadas/criadas.
   ✔ Categorias padrão criadas.
   ✔ Usuário inicial criado: seu@email.com
    * Running on http://127.0.0.1:5000
   ```

6. Abra **http://127.0.0.1:5000** no navegador.

### Problemas comuns

| Erro | Causa provável |
|---|---|
| `Access denied for user` | Usuário ou senha incorretos no `.env` |
| `Can't connect to MySQL server` | MySQL não está rodando ou a porta está errada |
| `cryptography package is required` | Rode `pip install cryptography` |
| Coluna nova não aparece | O `create_all()` não altera tabelas existentes (veja a seção 6) |

---

## 9. Rotas da API

Padrão REST em JSON. Todas retornam e recebem JSON, exceto os uploads, que usam `multipart/form-data`.

| Módulo | Rotas principais |
|---|---|
| Auth | `POST /api/login` · `POST /api/logout` · `GET /api/me` |
| Dashboard | `GET /api/dashboard` (resumo agregado) · `GET /api/liturgia/hoje` |
| Agenda | `GET/POST /api/compromissos` · `PUT/DELETE /api/compromissos/<id>` · `GET /api/agenda/eventos?inicio=&fim=` (unificado para o FullCalendar) |
| Lembretes | `GET /api/lembretes/pendentes` · `PATCH /api/lembretes/<id>/enviado` |
| Avisos | `GET/POST /api/avisos` · `PUT/DELETE /api/avisos/<id>` |
| Tarefas | `GET/POST /api/tarefas` · `PUT/DELETE /api/tarefas/<id>` · `PATCH /api/tarefas/reordenar` |
| Igreja | `/api/igreja/escalas` · `/api/igreja/escalas/lote` · `/api/igreja/eventos` · `/api/igreja/horarios` · `/api/igreja/oracoes` · `/api/igreja/novenas` |
| Leituras | `/api/livros` · `/api/livros/<id>/notas` |
| Estudos | `/api/disciplinas` · `/api/simulados` · `/api/simulados/<id>/gabarito` · `/api/simulados/<id>/respostas` · `/api/simulados/<id>/resultado` · `/api/erros` · `/api/flashcards` · `/api/flashcards/revisar` · `/api/sessoes` · `/api/metas` |
| Anotações e arquivos | `/api/anotacoes?modulo=` · `POST /api/arquivos` · `GET /api/arquivos/<id>/download` |
| Busca | `GET /api/busca?q=` |

### Endpoint do dashboard (exemplo de retorno)

```json
{
  "liturgia": { "tempo": "Tempo Comum", "cor": "verde", "cor_hex": "#2E7D4F", "celebracao": null },
  "proxima_escala": { "data": "2026-09-27", "horario": "10:00", "celebracao": "Missa Dominical", "funcao": "Mestre de Cerimônias" },
  "compromissos_hoje": [],
  "lembretes_pendentes": [],
  "avisos_fixados": [],
  "tarefas_hoje": [],
  "tarefas_atrasadas": [],
  "proximo_evento_igreja": null,
  "proxima_confissao": null,
  "estudos": { "horas_semana": 0, "ultimo_simulado": null }
}
```

### Lembretes no navegador (frontend)

```javascript
async function verificarLembretes() {
  const res = await fetch("/api/lembretes/pendentes");
  const lembretes = await res.json();
  for (const l of lembretes) {
    if (Notification.permission === "granted") {
      new Notification("Ordo", { body: l.titulo });
    }
    await fetch(`/api/lembretes/${l.id}/enviado`, { method: "PATCH" });
  }
}

Notification.requestPermission();
verificarLembretes();
setInterval(verificarLembretes, 60_000); // a cada minuto
```

---

## 10. Roadmap de desenvolvimento

| Fase | Entregas |
|---|---|
| **1. Base** | Inicialização automática do banco (este documento), login, layout com sidebar e design system em CSS |
| **2. Núcleo** | Agenda com FullCalendar, tarefas (kanban e tabela), quadro de avisos e lembretes |
| **3. Igreja** | Escalas (com cadastro em lote), eventos, horários fixos, orações com modo Rezar, novenas e leituras |
| **4. Estudos** | Disciplinas, simulados com correção automática, caderno de erros e Pomodoro |
| **5. Dashboard completo** | Agregação de todos os módulos, faixa litúrgica, busca global e modo escuro |
| **6. Refinamento** | Gráficos, flashcards com revisão espaçada, metas, backup e microanimações |

---

*Documento de planejamento do projeto Ordo.*
