/* ════════════════════════════════════════════════════════════════════
   Ordo — peças de interface compartilhadas

   Toast, modal, confirmação, estado vazio e o escape de HTML. Todo
   texto vindo do banco passa por esc() antes de entrar no DOM.
   ══════════════════════════════════════════════════════════════════ */

import { ErroApi } from "./api.js";

/* ─────────────────────────── Escape ─────────────────────────── */

const MAPA = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapa texto para interpolação segura em template de HTML. */
export function esc(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(/[&<>"']/g, (c) => MAPA[c]);
}

/* ─────────────────────────── Ícones ─────────────────────────── */

/** <i data-lucide="..."> que o lucide.createIcons() troca por SVG. */
export function icone(nome, classe = "icone") {
  return `<i data-lucide="${esc(nome)}" class="${esc(classe)}"></i>`;
}

/** Troca todo <i data-lucide> do documento por SVG. Chamar após cada
    render; o lucide varre o documento inteiro, não aceita raiz. */
export function renderizarIcones() {
  window.lucide?.createIcons?.();
}

/* ─────────────────────────── Toast ─────────────────────────── */

function containerToasts() {
  let alvo = document.querySelector(".toasts");
  if (!alvo) {
    alvo = document.createElement("div");
    alvo.className = "toasts";
    alvo.setAttribute("role", "status");
    alvo.setAttribute("aria-live", "polite");
    document.body.appendChild(alvo);
  }
  return alvo;
}

export function toast(mensagem, tipo = "info", duracao = 4000) {
  const elemento = document.createElement("div");
  elemento.className = `toast toast--${tipo}`;
  elemento.innerHTML = `<span>${esc(mensagem)}</span>`;
  containerToasts().appendChild(elemento);

  setTimeout(() => {
    elemento.classList.add("toast--saindo");
    elemento.addEventListener("animationend", () => elemento.remove(), { once: true });
  }, duracao);
}

export const sucesso = (m) => toast(m, "sucesso");
export const aviso = (m) => toast(m, "aviso");

/** Mostra o erro de uma chamada de API e devolve os campos inválidos. */
export function falha(e) {
  const mensagem = e instanceof ErroApi ? e.message : "Algo deu errado.";
  toast(mensagem, "erro", 6000);
  if (!(e instanceof ErroApi)) console.error(e);
  return e?.campos || {};
}

/* ─────────────────────────── Modal ─────────────────────────── */

/**
 * Abre um modal e resolve quando ele fecha.
 *
 * @param {object} opcoes
 * @param {string} opcoes.titulo
 * @param {string} opcoes.corpo        HTML já escapado pelo chamador
 * @param {string} opcoes.confirmar    rótulo do botão principal
 * @param {string} opcoes.cancelar     rótulo do botão secundário
 * @param {boolean} opcoes.largo
 * @param {Function} opcoes.aoConfirmar  recebe o <form>; devolver false mantém aberto
 * @param {Function} opcoes.aoMontar     recebe (form, fechar); fechar(valor)
 *                                   resolve o modal com esse valor
 */
export function modal(opcoes) {
  const {
    titulo,
    corpo = "",
    confirmar = "Salvar",
    cancelar = "Cancelar",
    largo = false,
    aoConfirmar,
    aoMontar,
  } = opcoes;

  return new Promise((resolve) => {
    const fundo = document.createElement("div");
    fundo.className = "modal-fundo";
    fundo.innerHTML = `
      <div class="modal ${largo ? "modal--largo" : ""}" role="dialog"
           aria-modal="true" aria-label="${esc(titulo)}">
        <div class="modal__cabecalho">
          <h2 class="modal__titulo">${esc(titulo)}</h2>
          <button type="button" class="btn btn--fantasma btn--icone"
                  data-fechar aria-label="Fechar">${icone("x")}</button>
        </div>
        <form class="modal__corpo" novalidate>${corpo}</form>
        <div class="modal__pe">
          ${
            cancelar
              ? `<button type="button" class="btn btn--contorno" data-fechar>
                   ${esc(cancelar)}
                 </button>`
              : ""
          }
          <button type="button" class="btn btn--ouro" data-confirmar>
            ${esc(confirmar)}
          </button>
        </div>
      </div>`;

    const form = fundo.querySelector("form");
    const botaoConfirmar = fundo.querySelector("[data-confirmar]");

    function fechar(resultado) {
      document.removeEventListener("keydown", aoTeclar);
      fundo.remove();
      resolve(resultado);
    }

    async function tentarConfirmar() {
      if (!aoConfirmar) return fechar(true);
      botaoConfirmar.disabled = true;
      try {
        const resultado = await aoConfirmar(form);
        if (resultado !== false) fechar(resultado ?? true);
      } finally {
        botaoConfirmar.disabled = false;
      }
    }

    function aoTeclar(e) {
      if (e.key === "Escape") fechar(null);
      if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault();
        tentarConfirmar();
      }
    }

    fundo.querySelectorAll("[data-fechar]").forEach((b) =>
      b.addEventListener("click", () => fechar(null))
    );
    fundo.addEventListener("click", (e) => {
      if (e.target === fundo) fechar(null);
    });
    botaoConfirmar.addEventListener("click", tentarConfirmar);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      tentarConfirmar();
    });
    document.addEventListener("keydown", aoTeclar);

    document.body.appendChild(fundo);
    renderizarIcones();
    if (aoMontar) aoMontar(form, fechar);

    const primeiro = form.querySelector("input, select, textarea");
    if (primeiro) primeiro.focus();
  });
}

/** Confirmação destrutiva. Resolve true se o usuário confirmar. */
export function confirmar(mensagem, opcoes = {}) {
  return modal({
    titulo: opcoes.titulo || "Confirmar",
    corpo: `<p>${esc(mensagem)}</p>`,
    confirmar: opcoes.confirmar || "Excluir",
    cancelar: "Cancelar",
    aoConfirmar: () => true,
  }).then((r) => r === true);
}

/* ─────────────────────────── Marcadores de estado ─────────────────────────── */

export function vazio({ titulo, texto, icone: nomeIcone = "inbox", acao = "" }) {
  return `
    <div class="vazio">
      ${icone(nomeIcone, "icone vazio__icone")}
      <p class="vazio__titulo">${esc(titulo)}</p>
      ${texto ? `<p class="vazio__texto">${esc(texto)}</p>` : ""}
      ${acao}
    </div>`;
}

export function carregando(texto = "Carregando...") {
  return `<div class="carregando"><span class="girando"></span>${esc(texto)}</div>`;
}

/* ─────────────────────────── Erros de formulário ─────────────────────────── */

/** Pinta as mensagens de erro devolvidas pela API nos campos do form. */
export function marcarErros(form, campos) {
  form.querySelectorAll(".campo--erro").forEach((c) => {
    c.classList.remove("campo--erro");
    c.querySelector(".campo__erro")?.remove();
  });

  for (const [nome, mensagem] of Object.entries(campos || {})) {
    const entrada = form.querySelector(`[name="${nome}"]`);
    const campo = entrada?.closest(".campo");
    if (!campo) continue;
    campo.classList.add("campo--erro");
    const erro = document.createElement("span");
    erro.className = "campo__erro";
    erro.textContent = mensagem;
    campo.appendChild(erro);
  }
}

/** Lê um <form> como objeto simples, tratando checkbox e campos vazios. */
export function lerForm(form) {
  const dados = {};
  for (const elemento of form.elements) {
    if (!elemento.name) continue;
    if (elemento.type === "checkbox") {
      dados[elemento.name] = elemento.checked;
    } else {
      const valor = elemento.value.trim();
      dados[elemento.name] = valor === "" ? null : valor;
    }
  }
  return dados;
}
