/* ════════════════════════════════════════════════════════════════════
   Ordo — formatação de datas, horas e textos

   O backend manda ISO 8601 sem fuso ("2026-09-27T10:00:00"). O
   construtor Date() do JavaScript trata essa forma como horário LOCAL,
   que é exatamente o que queremos. Nunca acrescente "Z" a essas strings.
   ══════════════════════════════════════════════════════════════════ */

const DIAS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Converte "2026-09-27" ou "2026-09-27T10:00:00" em Date local. */
export function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  const texto = String(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [a, m, d] = texto.split("-").map(Number);
    return new Date(a, m - 1, d);
  }
  return new Date(texto);
}

export function data(valor) {
  const d = paraData(valor);
  if (!d || isNaN(d)) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function dataLonga(valor) {
  const d = paraData(valor);
  if (!d || isNaN(d)) return "—";
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

export function dataCurta(valor) {
  const d = paraData(valor);
  if (!d || isNaN(d)) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MESES[d.getMonth()].slice(0, 3)}`;
}

export function hora(valor) {
  if (!valor) return "—";
  if (typeof valor === "string" && /^\d{2}:\d{2}/.test(valor)) {
    return valor.slice(0, 5);
  }
  const d = paraData(valor);
  if (!d || isNaN(d)) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function dataHora(valor) {
  const d = paraData(valor);
  if (!d || isNaN(d)) return "—";
  return `${data(d)} às ${hora(d)}`;
}

export function diaSemana(indice) {
  // O backend usa o padrão do Python: 0 = segunda ... 6 = domingo.
  return DIAS[(indice + 1) % 7];
}

/** "hoje", "amanhã", "em 3 dias", "há 2 dias". */
export function relativo(valor) {
  const d = paraData(valor);
  if (!d || isNaN(d)) return "—";

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(d);
  alvo.setHours(0, 0, 0, 0);

  const dias = Math.round((alvo - hoje) / 86400000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  if (dias > 1 && dias < 7) return `${DIAS[alvo.getDay()]}`;
  if (dias > 0) return `em ${dias} dias`;
  return `há ${Math.abs(dias)} dias`;
}

/** Contagem regressiva legível: "2 dias e 4 h", "3 h 12 min", "agora". */
export function contagem(valor) {
  const d = paraData(valor);
  if (!d || isNaN(d)) return "—";

  let restante = Math.floor((d - new Date()) / 1000);
  if (restante <= 0) return "agora";

  const dias = Math.floor(restante / 86400);
  restante %= 86400;
  const horas = Math.floor(restante / 3600);
  restante %= 3600;
  const minutos = Math.floor(restante / 60);

  if (dias > 0) return `${dias} ${dias === 1 ? "dia" : "dias"} e ${horas} h`;
  if (horas > 0) return `${horas} h ${minutos} min`;
  return `${minutos} min`;
}

export function duracao(minutos) {
  if (!minutos) return "0 min";
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

export function horas(valor) {
  const n = Number(valor) || 0;
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
}

export function porcentagem(valor, casas = 1) {
  if (valor === null || valor === undefined) return "—";
  return `${Number(valor).toFixed(casas).replace(".", ",")}%`;
}

export function tamanhoArquivo(bytes) {
  if (!bytes) return "—";
  const unidades = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < unidades.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1).replace(".", ",")} ${unidades[i]}`;
}

/** Maiúscula só na primeira letra.

    Usar isto em vez de text-transform: capitalize do CSS, que
    capitaliza toda palavra e produz "Setembro De 2026" e "Às 19:00". */
export function capitalizar(texto) {
  if (!texto) return "";
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "a_fazer" → "A fazer"; "troca_solicitada" → "Troca solicitada". */
export function rotulo(chave) {
  if (!chave) return "";
  const texto = String(chave).replace(/_/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Saudação pela hora do dia, usada no dashboard. */
export function saudacao(agora = new Date()) {
  const h = agora.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Mês atual em AAAA-MM, no fuso local.

    toISOString() devolve UTC: às 22h de 30 de setembro no Brasil ele já
    diz "2026-10", o que jogaria a tela para o mês errado. */
export function mesAtualISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Data de hoje em AAAA-MM-DD, no fuso local (não usar toISOString). */
export function hojeISO() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Date → "AAAA-MM-DDTHH:MM", o formato que a API espera. */
export function paraInputDataHora(valor) {
  const d = paraData(valor);
  if (!d || isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}
