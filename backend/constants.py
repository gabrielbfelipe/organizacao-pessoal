"""Listas de valores fixos compartilhadas entre rotas, seed e frontend.

Expostas ao frontend por GET /api/constantes, para que os <select> das
telas não repitam essas listas em JavaScript.
"""

MODULOS = ["geral", "igreja", "estudos"]

# ─── Geral ───────────────────────────────────────────────────────────
PRIORIDADES = ["baixa", "media", "alta"]
STATUS_TAREFA = ["a_fazer", "fazendo", "feito"]
RECORRENCIAS = ["nenhuma", "diaria", "semanal", "mensal"]
ORIGENS_LEMBRETE = ["compromisso", "escala", "evento", "tarefa", "avulso"]

# Antecedências oferecidas na interface, em minutos
ANTECEDENCIAS = [
    (15, "15 minutos antes"),
    (60, "1 hora antes"),
    (180, "3 horas antes"),
    (1440, "1 dia antes"),
    (2880, "2 dias antes"),
]

# ─── Igreja ──────────────────────────────────────────────────────────
FUNCOES_CERIMONIARIO = [
    "Mestre de Cerimônias",
    "Turiferário",
    "Naveteiro",
    "Cruciferário",
    "Ceroferário",
    "Librífero",
    "Mitrífero",
    "Bacilífero",
    "Acólito",
    "Leitor",
    "Salmista",
]

STATUS_ESCALA = ["pendente", "confirmada", "troca_solicitada"]
TIPOS_EVENTO = ["missa", "solenidade", "festa", "retiro", "ensaio", "formacao"]
TIPOS_HORARIO_FIXO = ["missa", "confissao", "adoracao"]
CATEGORIAS_ORACAO = ["manha", "noite", "terco", "novena", "ladainha", "pessoal"]
STATUS_LIVRO = ["quero_ler", "lendo", "lido"]
TIPOS_NOTA_LIVRO = ["nota", "citacao"]

TEMAS_MATERIAL = [
    "IGMR",
    "Cerimonial dos Bispos",
    "Catecismo",
    "Liturgia",
    "Documentos",
    "Outros",
]

# Dias da semana no padrão de Python: 0 = segunda ... 6 = domingo
DIAS_SEMANA = [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo",
]

# ─── Estudos ─────────────────────────────────────────────────────────
ALTERNATIVAS = ["A", "B", "C", "D", "E"]
ALTERNATIVAS_CERTO_ERRADO = ["C", "E"]
MOTIVOS_ERRO = ["falta_conteudo", "desatencao", "interpretacao", "tempo"]
TIPOS_SESSAO = ["pomodoro", "livre"]
PERIODOS_META = ["semanal", "mensal"]
DIFICULDADES_FLASHCARD = ["facil", "medio", "dificil"]

# ─── Litúrgico ───────────────────────────────────────────────────────
CORES_LITURGICAS = {
    "roxo": "#6B3FA0",
    "verde": "#2E7D4F",
    "branco": "#E8E1CF",
    "vermelho": "#B22222",
    "rosa": "#D98CA6",
}

GRAUS_LITURGICOS = ["solenidade", "festa", "memoria", "comemoracao"]
