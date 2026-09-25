"""Testes da correção de simulados.

Rodam sem banco: corrigir() consome objetos com os mesmos atributos do
modelo, e o que está sob teste é a aritmética da correção.
"""

import pytest

from services.correcao import avaliar_questao, corrigir


class QuestaoFalsa:
    def __init__(self, numero, gabarito=None, resposta=None, anulada=False,
                 disciplina_id=None):
        self.id = numero
        self.numero = numero
        self.gabarito = gabarito
        self.resposta = resposta
        self.anulada = anulada
        self.disciplina_id = disciplina_id
        self.simulado_id = 1

    @property
    def correta(self):
        return (
            not self.anulada
            and self.resposta is not None
            and self.resposta.upper() == (self.gabarito or "").upper()
        )

    def to_dict(self):
        return {"id": self.id, "numero": self.numero}


class SimuladoFalso:
    def __init__(self, questoes):
        self.id = 1
        self.questoes = questoes
        self.titulo = "Simulado de teste"

    def to_dict(self):
        return {"id": self.id, "titulo": self.titulo}


class DisciplinaFalsa:
    def __init__(self, id, nome, cor="#000000"):
        self.id = id
        self.nome = nome
        self.cor = cor


def montar(*questoes):
    return SimuladoFalso(list(questoes))


# ─────────────────────── avaliação de uma questão ───────────────────────


@pytest.mark.parametrize(
    "gabarito,resposta,esperado",
    [
        ("A", "A", "acerto"),
        ("A", "B", "erro"),
        ("A", None, "branco"),
        ("A", "", "branco"),
        ("C", "c", "acerto"),      # a caixa não importa
        ("e", "E", "acerto"),
        ("A", " a ", "acerto"),    # espaços em volta são ignorados
        (None, "A", "sem_gabarito"),
    ],
)
def test_avaliar_questao(gabarito, resposta, esperado):
    questao = QuestaoFalsa(1, gabarito=gabarito, resposta=resposta)
    assert avaliar_questao(questao) == esperado


def test_anulada_vence_qualquer_outra_situacao():
    questao = QuestaoFalsa(1, gabarito="A", resposta="B", anulada=True)
    assert avaliar_questao(questao) == "anulada"


# ─────────────────────── percentual geral ───────────────────────


def test_simulado_todo_certo():
    simulado = montar(
        QuestaoFalsa(1, "A", "A"),
        QuestaoFalsa(2, "B", "B"),
        QuestaoFalsa(3, "C", "C"),
    )
    geral = corrigir(simulado)["geral"]
    assert geral["acertos"] == 3
    assert geral["validas"] == 3
    assert geral["percentual"] == 100.0


def test_anuladas_saem_do_denominador():
    """O caso do plano: 60 questões, 3 anuladas, percentual sobre 57."""
    questoes = []
    for numero in range(1, 61):
        anulada = numero in (10, 25, 40)
        # Acerta 40 das 57 válidas.
        acerta = not anulada and numero <= 43 and numero not in (10, 25, 40)
        questoes.append(
            QuestaoFalsa(numero, "A", "A" if acerta else "B", anulada=anulada)
        )

    geral = corrigir(montar(*questoes))["geral"]
    assert geral["total"] == 60
    assert geral["anuladas"] == 3
    assert geral["validas"] == 57
    assert geral["acertos"] == 40
    assert geral["percentual"] == round(40 / 57 * 100, 1)


def test_brancos_contam_como_erro_mas_sao_separados():
    simulado = montar(
        QuestaoFalsa(1, "A", "A"),
        QuestaoFalsa(2, "B", None),
        QuestaoFalsa(3, "C", "D"),
        QuestaoFalsa(4, "D", ""),
    )
    geral = corrigir(simulado)["geral"]
    assert geral["acertos"] == 1
    assert geral["erros"] == 3
    assert geral["brancos"] == 2
    assert geral["validas"] == 4
    assert geral["percentual"] == 25.0


def test_prova_de_certo_e_errado():
    simulado = montar(
        QuestaoFalsa(1, "C", "C"),
        QuestaoFalsa(2, "E", "E"),
        QuestaoFalsa(3, "C", "E"),
        QuestaoFalsa(4, "E", "C"),
    )
    geral = corrigir(simulado)["geral"]
    assert geral["acertos"] == 2
    assert geral["percentual"] == 50.0


def test_simulado_sem_gabarito_lancado():
    """Antes de lançar o gabarito não há percentual — e não há erro."""
    simulado = montar(
        QuestaoFalsa(1, None, "A"),
        QuestaoFalsa(2, None, "B"),
    )
    geral = corrigir(simulado)["geral"]
    assert geral["sem_gabarito"] == 2
    assert geral["validas"] == 0
    assert geral["percentual"] is None
    assert geral["acertos"] == 0


def test_simulado_inteiro_anulado_nao_divide_por_zero():
    simulado = montar(
        QuestaoFalsa(1, "A", "A", anulada=True),
        QuestaoFalsa(2, "B", "B", anulada=True),
    )
    geral = corrigir(simulado)["geral"]
    assert geral["validas"] == 0
    assert geral["percentual"] is None


def test_simulado_sem_questoes():
    geral = corrigir(montar())["geral"]
    assert geral["total"] == 0
    assert geral["percentual"] is None


# ─────────────────────── quebra por disciplina ───────────────────────


def test_percentual_por_disciplina():
    disciplinas = {
        1: DisciplinaFalsa(1, "Português", "#B22222"),
        2: DisciplinaFalsa(2, "Matemática", "#1B2A41"),
    }
    simulado = montar(
        QuestaoFalsa(1, "A", "A", disciplina_id=1),
        QuestaoFalsa(2, "B", "B", disciplina_id=1),
        QuestaoFalsa(3, "C", "D", disciplina_id=1),
        QuestaoFalsa(4, "A", "B", disciplina_id=2),
        QuestaoFalsa(5, "B", "C", disciplina_id=2),
    )

    resultado = corrigir(simulado, disciplinas)
    por_nome = {d["nome"]: d for d in resultado["por_disciplina"]}

    assert por_nome["Português"]["acertos"] == 2
    assert por_nome["Português"]["percentual"] == round(2 / 3 * 100, 1)
    assert por_nome["Matemática"]["percentual"] == 0.0
    assert por_nome["Matemática"]["cor"] == "#1B2A41"


def test_disciplinas_vem_da_pior_para_a_melhor():
    disciplinas = {
        1: DisciplinaFalsa(1, "Boa"),
        2: DisciplinaFalsa(2, "Ruim"),
    }
    simulado = montar(
        QuestaoFalsa(1, "A", "A", disciplina_id=1),
        QuestaoFalsa(2, "A", "B", disciplina_id=2),
    )
    nomes = [d["nome"] for d in corrigir(simulado, disciplinas)["por_disciplina"]]
    assert nomes == ["Ruim", "Boa"]


def test_questoes_sem_disciplina_ganham_bloco_proprio():
    simulado = montar(QuestaoFalsa(1, "A", "A"))
    blocos = corrigir(simulado)["por_disciplina"]
    assert len(blocos) == 1
    assert blocos[0]["nome"] == "Sem disciplina"
    assert blocos[0]["disciplina_id"] is None


def test_anuladas_saem_do_denominador_tambem_por_disciplina():
    disciplinas = {1: DisciplinaFalsa(1, "Português")}
    simulado = montar(
        QuestaoFalsa(1, "A", "A", disciplina_id=1),
        QuestaoFalsa(2, "B", "C", disciplina_id=1),
        QuestaoFalsa(3, "C", "C", disciplina_id=1, anulada=True),
    )
    bloco = corrigir(simulado, disciplinas)["por_disciplina"][0]
    assert bloco["total"] == 3
    assert bloco["validas"] == 2
    assert bloco["anuladas"] == 1
    assert bloco["percentual"] == 50.0


# ─────────────────────── questões erradas ───────────────────────


def test_erradas_incluem_brancos_e_excluem_anuladas():
    simulado = montar(
        QuestaoFalsa(1, "A", "A"),
        QuestaoFalsa(2, "B", "C"),
        QuestaoFalsa(3, "C", None),
        QuestaoFalsa(4, "D", "X", anulada=True),
    )
    numeros = [q["numero"] for q in corrigir(simulado)["questoes_erradas"]]
    assert numeros == [2, 3]
