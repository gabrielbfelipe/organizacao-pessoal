/* ════════════════════════════════════════════════════════════════════
   Ordo — busca global (Ctrl+K)

   Paleta de comandos sobre tudo o que é texto no sistema: tarefas,
   anotações, orações, materiais, leituras, compromissos, escalas,
   eventos, avisos e disciplinas.

   Navega com as setas, abre com Enter, fecha com Esc — sem tirar a mão
   do teclado.
   ══════════════════════════════════════════════════════════════════ */

import { api } from "./api.js";
import { esc, icone, renderizarIcones } from "./ui.js";

const ATRASO_DIGITACAO = 240;

let aberta = false;

/* ─────────────────────────── render ─────────────────────────── */

function htmlItem(item, grupo, indice) {
  return `
    <button class="paleta__item" data-indice="${indice}" data-url="${esc(item.url)}">
      ${icone(grupo.icone, "icone paleta__item-icone")}
      <span class="paleta__item-texto">
        <span class="paleta__item-titulo">${esc(item.titulo)}</span>
        ${
          item.trecho
            ? `<span class="paleta__item-trecho">${esc(item.trecho)}</span>`
            : ""
        }
      </span>
      ${item.marca ? `<span class="badge">${esc(item.marca)}</span>` : ""}
    </button>`;
}

function htmlResultados(resposta) {
  if (!resposta) {
    return `<div class="paleta__dica">
      Digite ao menos duas letras para buscar.
    </div>`;
  }

  if (!resposta.total) {
    return `<div class="paleta__dica">
      Nada encontrado para <strong>${esc(resposta.termo)}</strong>.
    </div>`;
  }

  let indice = -1;
  return resposta.grupos
    .map((grupo) => {
      const itens = grupo.itens
        .map((item) => {
          indice++;
          return htmlItem(item, grupo, indice);
        })
        .join("");
      return `
        <div class="paleta__grupo">
          <div class="paleta__grupo-titulo">${esc(grupo.rotulo)}</div>
          ${itens}
        </div>`;
    })
    .join("");
}

/* ─────────────────────────── paleta ─────────────────────────── */

export function abrir() {
  if (aberta) return;
  aberta = true;

  const fundo = document.createElement("div");
  fundo.className = "paleta-fundo";
  fundo.innerHTML = `
    <div class="paleta" role="dialog" aria-modal="true" aria-label="Busca global">
      <div class="paleta__campo">
        ${icone("search")}
        <input type="search" class="paleta__entrada" data-entrada
               placeholder="Buscar em todo o Ordo..." autocomplete="off" />
        <span class="busca-atalho__tecla">Esc</span>
      </div>
      <div class="paleta__resultados" data-resultados>
        ${htmlResultados(null)}
      </div>
    </div>`;

  const entrada = fundo.querySelector("[data-entrada]");
  const caixa = fundo.querySelector("[data-resultados]");

  let selecionado = 0;
  let atraso;
  let requisicao = 0;

  function fechar() {
    document.removeEventListener("keydown", aoTeclar, true);
    fundo.remove();
    aberta = false;
  }

  function itens() {
    return [...caixa.querySelectorAll(".paleta__item")];
  }

  function pintarSelecao() {
    itens().forEach((item, i) => {
      const ativo = i === selecionado;
      item.classList.toggle("paleta__item--ativo", ativo);
      if (ativo) item.scrollIntoView({ block: "nearest" });
    });
  }

  function abrirSelecionado() {
    const alvo = itens()[selecionado];
    if (alvo) location.href = alvo.dataset.url;
  }

  async function buscar() {
    const termo = entrada.value.trim();

    if (termo.length < 2) {
      caixa.innerHTML = htmlResultados(null);
      renderizarIcones();
      return;
    }

    caixa.innerHTML = `<div class="paleta__dica">
      <span class="girando" style="display:inline-block;vertical-align:-5px"></span>
      Buscando...
    </div>`;

    const meu = ++requisicao;
    try {
      const resposta = await api.get("/busca", { q: termo });
      // Descarta respostas de buscas que a digitação já tornou obsoletas.
      if (meu !== requisicao) return;

      caixa.innerHTML = htmlResultados(resposta);
      renderizarIcones();
      selecionado = 0;
      pintarSelecao();

      itens().forEach((item, i) => {
        item.addEventListener("mouseenter", () => {
          selecionado = i;
          pintarSelecao();
        });
        item.addEventListener("click", () => {
          location.href = item.dataset.url;
        });
      });
    } catch {
      if (meu !== requisicao) return;
      caixa.innerHTML = `<div class="paleta__dica">
        Não foi possível buscar agora.
      </div>`;
    }
  }

  function aoTeclar(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      return fechar();
    }

    const total = itens().length;
    if (!total) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selecionado = (selecionado + 1) % total;
      return pintarSelecao();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      selecionado = (selecionado - 1 + total) % total;
      return pintarSelecao();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      return abrirSelecionado();
    }
  }

  entrada.addEventListener("input", () => {
    clearTimeout(atraso);
    atraso = setTimeout(buscar, ATRASO_DIGITACAO);
  });

  fundo.addEventListener("click", (e) => {
    if (e.target === fundo) fechar();
  });

  document.addEventListener("keydown", aoTeclar, true);
  document.body.appendChild(fundo);
  renderizarIcones();
  entrada.focus();
}

/** Liga o Ctrl+K. Chamado uma vez pelo layout. */
export function iniciar() {
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      abrir();
    }
  });
}
