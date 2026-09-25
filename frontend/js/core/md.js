/* ════════════════════════════════════════════════════════════════════
   Ordo — Markdown renderizado com segurança

   O conteúdo vem do banco e vai para innerHTML, então passa sempre por
   DOMPurify. Mesmo sendo um app de um usuário só, um texto colado de
   fora pode trazer <script> ou um onerror numa <img>.

   marked e DOMPurify vêm por CDN nas páginas que usam este módulo.
   ══════════════════════════════════════════════════════════════════ */

import { esc } from "./ui.js";

/** HTML seguro a partir de Markdown. Nunca use innerHTML sem passar aqui. */
export function renderizar(markdown) {
  if (!markdown) return "";

  // Sem as bibliotecas, degrada para texto puro escapado — jamais para
  // HTML cru, que seria exatamente o buraco que queremos evitar.
  if (!window.marked || !window.DOMPurify) {
    return `<pre style="white-space:pre-wrap;font-family:inherit">${esc(
      markdown
    )}</pre>`;
  }

  const bruto = window.marked.parse(markdown, { breaks: true, gfm: true });
  return window.DOMPurify.sanitize(bruto, {
    ADD_ATTR: ["target", "rel"],
    FORBID_TAGS: ["style", "form", "input", "iframe"],
  });
}

/** Primeiras linhas em texto puro, para a prévia nos cartões de lista. */
export function resumo(markdown, limite = 160) {
  if (!markdown) return "";
  const texto = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return texto.length > limite ? `${texto.slice(0, limite)}…` : texto;
}

/** Links do conteúdo renderizado abrem fora, sem vazar o referenciador. */
export function ajustarLinks(elemento) {
  elemento.querySelectorAll("a[href]").forEach((a) => {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  });
}
