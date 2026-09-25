/* ════════════════════════════════════════════════════════════════════
   Ordo — tema claro e escuro

   A escolha fica em localStorage. Sem escolha registrada, segue a
   preferência do sistema. A faixa litúrgica não muda de cor com o tema.
   ══════════════════════════════════════════════════════════════════ */

const CHAVE = "ordo:tema";

function preferenciaDoSistema() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function guardado() {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null; // modo privativo ou armazenamento bloqueado
  }
}

export function temaAtual() {
  return guardado() || preferenciaDoSistema();
}

export function aplicar(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    /* sem persistência: o tema vale só nesta aba */
  }
}

export function alternar() {
  const proximo = temaAtual() === "dark" ? "light" : "dark";
  aplicar(proximo);
  return proximo;
}

/** Chamado o quanto antes, para não piscar o tema claro antes do escuro. */
export function iniciar() {
  document.documentElement.setAttribute("data-theme", temaAtual());

  // Acompanha o sistema enquanto não houver escolha explícita.
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.(
    "change",
    (e) => {
      if (!guardado()) {
        document.documentElement.setAttribute(
          "data-theme",
          e.matches ? "dark" : "light"
        );
      }
    }
  );
}
