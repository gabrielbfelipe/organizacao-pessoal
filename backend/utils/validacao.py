"""Validação dos corpos JSON que chegam à API.

Uso típico numa rota:

    v = Validador(request.get_json())
    titulo = v.texto("titulo", obrigatorio=True, max_len=160)
    data = v.data("data", obrigatorio=True)
    status = v.escolha("status", STATUS_ESCALA, default="pendente")
    v.finalizar()   # levanta ErroValidacao com todos os erros de uma vez

O Validador acumula os erros em vez de parar no primeiro, para que o
formulário do frontend possa destacar todos os campos numa só resposta.
"""

import re
from datetime import date, datetime, time

COR_HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
AUSENTE = object()


class ErroValidacao(Exception):
    """Levantada por Validador.finalizar(). Vira um 400 no handler de app.py."""

    def __init__(self, campos, mensagem="Dados inválidos."):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.campos = campos


class Validador:
    def __init__(self, dados):
        self.dados = dados if isinstance(dados, dict) else {}
        self.erros = {}

    # ─── infraestrutura ───────────────────────────────────────────────

    def _falhar(self, campo, mensagem):
        self.erros[campo] = mensagem
        return None

    def _bruto(self, campo, obrigatorio, default):
        """Devolve o valor cru, ou AUSENTE se não há nada a validar."""
        if campo not in self.dados:
            if obrigatorio:
                self._falhar(campo, "Campo obrigatório.")
                return AUSENTE
            return default if default is not AUSENTE else AUSENTE

        valor = self.dados[campo]
        if valor is None or (isinstance(valor, str) and not valor.strip()):
            if obrigatorio:
                self._falhar(campo, "Campo obrigatório.")
                return AUSENTE
            return None
        return valor

    def finalizar(self):
        if self.erros:
            raise ErroValidacao(self.erros)

    # ─── tipos ────────────────────────────────────────────────────────

    def texto(self, campo, obrigatorio=False, max_len=None, default=AUSENTE):
        valor = self._bruto(campo, obrigatorio, default)
        if valor is AUSENTE or valor is None:
            return None
        valor = str(valor).strip()
        if max_len and len(valor) > max_len:
            return self._falhar(campo, f"Use no máximo {max_len} caracteres.")
        return valor

    def inteiro(self, campo, obrigatorio=False, minimo=None, maximo=None,
                default=AUSENTE):
        valor = self._bruto(campo, obrigatorio, default)
        if valor is AUSENTE or valor is None:
            return None
        try:
            valor = int(valor)
        except (TypeError, ValueError):
            return self._falhar(campo, "Informe um número inteiro.")
        if minimo is not None and valor < minimo:
            return self._falhar(campo, f"O mínimo é {minimo}.")
        if maximo is not None and valor > maximo:
            return self._falhar(campo, f"O máximo é {maximo}.")
        return valor

    def decimal(self, campo, obrigatorio=False, minimo=None, default=AUSENTE):
        valor = self._bruto(campo, obrigatorio, default)
        if valor is AUSENTE or valor is None:
            return None
        try:
            valor = float(valor)
        except (TypeError, ValueError):
            return self._falhar(campo, "Informe um número.")
        if minimo is not None and valor < minimo:
            return self._falhar(campo, f"O mínimo é {minimo}.")
        return valor

    def booleano(self, campo, default=False):
        if campo not in self.dados:
            return default
        valor = self.dados[campo]
        if isinstance(valor, bool):
            return valor
        if isinstance(valor, str):
            return valor.strip().lower() in {"true", "1", "sim", "on"}
        return bool(valor)

    def data(self, campo, obrigatorio=False, default=AUSENTE):
        """Aceita YYYY-MM-DD."""
        valor = self._bruto(campo, obrigatorio, default)
        if valor is AUSENTE or valor is None:
            return None
        if isinstance(valor, date) and not isinstance(valor, datetime):
            return valor
        try:
            return date.fromisoformat(str(valor)[:10])
        except ValueError:
            return self._falhar(campo, "Use o formato AAAA-MM-DD.")

    def hora(self, campo, obrigatorio=False, default=AUSENTE):
        """Aceita HH:MM ou HH:MM:SS."""
        valor = self._bruto(campo, obrigatorio, default)
        if valor is AUSENTE or valor is None:
            return None
        if isinstance(valor, time):
            return valor
        try:
            return time.fromisoformat(str(valor))
        except ValueError:
            return self._falhar(campo, "Use o formato HH:MM.")

    def data_hora(self, campo, obrigatorio=False, default=AUSENTE):
        """Aceita ISO 8601 local, com ou sem segundos. Um sufixo Z é
        recusado: o Ordo trabalha sempre em horário local."""
        valor = self._bruto(campo, obrigatorio, default)
        if valor is AUSENTE or valor is None:
            return None
        if isinstance(valor, datetime):
            return valor
        texto = str(valor).strip().replace(" ", "T")
        if texto.endswith("Z"):
            return self._falhar(campo, "Envie a data e hora no horário local, sem Z.")
        try:
            resultado = datetime.fromisoformat(texto)
        except ValueError:
            return self._falhar(campo, "Use o formato AAAA-MM-DDTHH:MM.")
        if resultado.tzinfo is not None:
            return self._falhar(campo, "Envie a data e hora sem fuso horário.")
        return resultado

    def escolha(self, campo, opcoes, obrigatorio=False, default=AUSENTE):
        valor = self._bruto(campo, obrigatorio, default)
        if valor is AUSENTE or valor is None:
            return None
        valor = str(valor).strip()
        if valor not in opcoes:
            return self._falhar(campo, "Valor não permitido: " + ", ".join(opcoes) + ".")
        return valor

    def cor(self, campo, obrigatorio=False, default=AUSENTE):
        valor = self._bruto(campo, obrigatorio, default)
        if valor is AUSENTE or valor is None:
            return None
        valor = str(valor).strip()
        if not COR_HEX.match(valor):
            return self._falhar(campo, "Use uma cor no formato #RRGGBB.")
        return valor

    def email(self, campo, obrigatorio=False, default=AUSENTE):
        valor = self.texto(campo, obrigatorio=obrigatorio, max_len=160, default=default)
        if not valor:
            return valor
        if "@" not in valor or "." not in valor.split("@")[-1]:
            return self._falhar(campo, "Informe um e-mail válido.")
        return valor.lower()

    def lista(self, campo, obrigatorio=False):
        """Para endpoints em lote, que recebem um array de objetos."""
        valor = self.dados.get(campo)
        if valor is None:
            if obrigatorio:
                self._falhar(campo, "Campo obrigatório.")
            return []
        if not isinstance(valor, list):
            self._falhar(campo, "Envie uma lista.")
            return []
        return valor


def aplicar(objeto, valores):
    """Atribui ao objeto só os campos presentes no dicionário.

    Deixa de fora as chaves com valor None que vieram de campos ausentes,
    para que um PUT parcial não apague o que não foi enviado.
    """
    for campo, valor in valores.items():
        if valor is not None:
            setattr(objeto, campo, valor)
    return objeto
