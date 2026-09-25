/* ════════════════════════════════════════════════════════════════════
   Ordo — Leituras

   Livros com progresso de páginas, notas e citações. A mesma tabela
   atende os livros de estudo, pelo campo `modulo`.
   ══════════════════════════════════════════════════════════════════ */

import { api } from "../core/api.js";
import * as fmt from "../core/fmt.js";
import { montar } from "../core/layout.js";
import {
  confirmar,
  esc,
  falha,
  icone,
  lerForm,
  marcarErros,
  modal,
  renderizarIcones,
  sucesso,
  vazio,
} from "../core/ui.js";

const ROTULO_STATUS = {
  quero_ler: "Quero ler",
  lendo: "Lendo",
  lido: "Lido",
};

const BADGE_STATUS = {
  quero_ler: "",
  lendo: "badge--ouro",
  lido: "badge--sucesso",
};

const estado = { livros: [], status: "", conteudo: null };

/* ─────────────────────────── render ─────────────────────────── */

function htmlLivro(livro) {
  const pct = livro.progresso_pct;

  return `
    <article class="card livro" data-id="${livro.id}">
      <div class="linha-espalhada" style="align-items:flex-start">
        <div class="crescer" style="min-width:0">
          <h3 class="livro__titulo">${esc(livro.titulo)}</h3>
          <p class="livro__autor">${esc(livro.autor || "Autor não informado")}</p>
        </div>
        <span class="badge ${BADGE_STATUS[livro.status]}">
          ${esc(ROTULO_STATUS[livro.status] || livro.status)}
        </span>
      </div>

      ${
        livro.total_paginas
          ? `<div class="livro__progresso-texto">
               <span>${livro.pagina_atual || 0} de ${livro.total_paginas} páginas</span>
               <span>${esc(fmt.porcentagem(pct, 0))}</span>
             </div>
             <div class="progresso ${pct >= 100 ? "progresso--sucesso" : ""}">
               <div class="progresso__preenchido" style="width:${pct}%"></div>
             </div>`
          : `<p class="texto-muted" style="margin:0;font-size:.82rem">
               Sem total de páginas cadastrado.</p>`
      }

      <div class="livro__rodape">
        <button class="btn btn--contorno btn--pequeno" data-acao="notas">
          ${icone("quote")} Notas
        </button>
        ${
          livro.total_paginas
            ? `<button class="btn btn--contorno btn--pequeno" data-acao="pagina">
                 ${icone("bookmark")} Marcar página
               </button>`
            : ""
        }
        <span class="crescer"></span>
        <button class="btn btn--fantasma btn--icone" data-acao="editar"
                title="Editar">${icone("pencil")}</button>
        <button class="btn btn--fantasma btn--icone" data-acao="excluir"
                title="Excluir">${icone("trash-2")}</button>
      </div>
    </article>`;
}

function htmlFiltros() {
  const status = [["", "Todos"], ...Object.entries(ROTULO_STATUS)];
  return `
    <div class="linha" style="margin-bottom:18px;flex-wrap:wrap">
      ${status
        .map(
          ([valor, rotulo]) => `
        <button class="chip" data-status="${valor}"
                aria-pressed="${estado.status === valor}">${esc(rotulo)}</button>`
        )
        .join("")}
    </div>`;
}

function render() {
  const lista = estado.livros.length
    ? `<div class="livros">${estado.livros.map(htmlLivro).join("")}</div>`
    : `<div class="card">${vazio({
        icone: "library",
        titulo: "Nenhum livro na estante",
        texto: "Cadastre o que está lendo, o que já leu e o que quer ler.",
      })}</div>`;

  estado.conteudo.innerHTML = htmlFiltros() + lista;
  renderizarIcones();
  ligar();
}

async function carregar() {
  try {
    estado.livros = await api.get("/livros", {
      modulo: "igreja",
      status: estado.status,
    });
    render();
  } catch (e) {
    falha(e);
  }
}

/* ─────────────────────────── formulário ─────────────────────────── */

async function abrirFormulario(livro) {
  const editando = Boolean(livro);

  await modal({
    titulo: editando ? "Editar livro" : "Novo livro",
    confirmar: editando ? "Salvar" : "Cadastrar",
    corpo: `
      <div class="campo">
        <label class="campo__rotulo campo__rotulo--obrigatorio" for="titulo">Título</label>
        <input class="input" type="text" id="titulo" name="titulo"
               value="${esc(livro?.titulo || "")}" required />
      </div>

      <div class="campo">
        <label class="campo__rotulo" for="autor">Autor</label>
        <input class="input" type="text" id="autor" name="autor"
               value="${esc(livro?.autor || "")}" />
      </div>

      <div class="grade-campos">
        <div class="campo">
          <label class="campo__rotulo" for="total_paginas">Total de páginas</label>
          <input class="input" type="number" id="total_paginas" name="total_paginas"
                 min="1" value="${esc(livro?.total_paginas || "")}" />
        </div>
        <div class="campo">
          <label class="campo__rotulo" for="pagina_atual">Página atual</label>
          <input class="input" type="number" id="pagina_atual" name="pagina_atual"
                 min="0" value="${esc(livro?.pagina_atual ?? 0)}" />
        </div>
      </div>

      <div class="campo">
        <label class="campo__rotulo" for="status">Status</label>
        <select class="select" id="status" name="status">
          ${Object.entries(ROTULO_STATUS)
            .map(
              ([valor, rotulo]) =>
                `<option value="${valor}" ${
                  (livro?.status || "quero_ler") === valor ? "selected" : ""
                }>${esc(rotulo)}</option>`
            )
            .join("")}
        </select>
      </div>

      <input type="hidden" name="modulo" value="igreja" />`,

    aoConfirmar: async (form) => {
      try {
        const dados = lerForm(form);
        if (editando) {
          await api.put(`/livros/${livro.id}`, dados);
          sucesso("Livro atualizado.");
        } else {
          await api.post("/livros", dados);
          sucesso("Livro cadastrado.");
        }
        await carregar();
        return true;
      } catch (e) {
        marcarErros(form, falha(e));
        return false;
      }
    },
  });
}

async function abrirMarcarPagina(livro) {
  await modal({
    titulo: `Onde você parou em "${livro.titulo}"?`,
    confirmar: "Marcar",
    corpo: `
      <div class="campo">
        <label class="campo__rotulo" for="pagina_atual">Página</label>
        <input class="input" type="number" id="pagina_atual" name="pagina_atual"
               min="0" max="${livro.total_paginas}"
               value="${livro.pagina_atual || 0}" autofocus />
        <span class="texto-muted" style="font-size:.78rem">
          de ${livro.total_paginas} páginas
        </span>
      </div>`,
    aoConfirmar: async (form) => {
      try {
        const atualizado = await api.patch(`/livros/${livro.id}/progresso`, {
          pagina_atual: Number(form.pagina_atual.value),
        });
        sucesso(
          atualizado.status === "lido"
            ? "Livro concluído."
            : `Marcado na página ${atualizado.pagina_atual}.`
        );
        await carregar();
        return true;
      } catch (e) {
        marcarErros(form, falha(e));
        return false;
      }
    },
  });
}

/* ─────────────────────────── notas e citações ─────────────────────────── */

function htmlNota(nota) {
  return `
    <div class="nota-livro" data-tipo="${esc(nota.tipo)}" data-nota="${nota.id}">
      ${esc(nota.conteudo)}
      <div class="nota-livro__meta">
        ${nota.tipo === "citacao" ? "Citação" : "Nota"}
        ${nota.pagina ? ` · página ${nota.pagina}` : ""}
        <button class="btn btn--fantasma btn--pequeno" data-apagar-nota="${nota.id}"
                style="float:right;padding:0 6px">${icone("x")}</button>
      </div>
    </div>`;
}

async function abrirNotas(livro) {
  const completo = await api.get(`/livros/${livro.id}`);

  await modal({
    titulo: `Notas de "${livro.titulo}"`,
    largo: true,
    confirmar: "Fechar",
    cancelar: null,
    corpo: `
      <div data-lista-notas>
        ${
          completo.notas.length
            ? completo.notas.map(htmlNota).join("")
            : `<p class="texto-muted" style="margin:0">Nenhuma nota ainda.</p>`
        }
      </div>

      <hr />

      <div class="grade-campos">
        <div class="campo">
          <label class="campo__rotulo" for="tipo">Tipo</label>
          <select class="select" id="tipo" name="tipo">
            <option value="nota">Nota</option>
            <option value="citacao">Citação</option>
          </select>
        </div>
        <div class="campo">
          <label class="campo__rotulo" for="pagina">Página</label>
          <input class="input" type="number" id="pagina" name="pagina" min="0"
                 value="${livro.pagina_atual || ""}" />
        </div>
      </div>

      <div class="campo">
        <label class="campo__rotulo" for="conteudo">Conteúdo</label>
        <textarea class="textarea" id="conteudo" name="conteudo"
                  placeholder="O trecho, ou o que você pensou sobre ele."></textarea>
      </div>

      <button type="button" class="btn btn--ouro" data-add-nota
              style="align-self:flex-start">
        ${icone("plus")} Adicionar
      </button>`,

    aoMontar: (form) => {
      const lista = form.querySelector("[data-lista-notas]");

      form.querySelector("[data-add-nota]").addEventListener("click", async () => {
        const conteudo = form.conteudo.value.trim();
        if (!conteudo) return falha({ message: "Escreva o conteúdo da nota." });

        try {
          const nova = await api.post(`/livros/${livro.id}/notas`, {
            tipo: form.tipo.value,
            pagina: form.pagina.value || null,
            conteudo,
          });
          if (lista.querySelector("p")) lista.innerHTML = "";
          lista.insertAdjacentHTML("beforeend", htmlNota(nova));
          renderizarIcones();
          form.conteudo.value = "";
          sucesso("Nota adicionada.");
        } catch (e) {
          falha(e);
        }
      });

      lista.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-apagar-nota]");
        if (!botao) return;
        try {
          await api.del(`/livros/notas/${botao.dataset.apagarNota}`);
          botao.closest("[data-nota]").remove();
        } catch (erro) {
          falha(erro);
        }
      });
    },

    aoConfirmar: () => true,
  });
}

/* ─────────────────────────── eventos ─────────────────────────── */

function ligar() {
  estado.conteudo.querySelectorAll("[data-status]").forEach((chip) =>
    chip.addEventListener("click", () => {
      estado.status = chip.dataset.status;
      carregar();
    })
  );

  estado.conteudo.querySelectorAll("[data-acao]").forEach((botao) =>
    botao.addEventListener("click", async () => {
      const id = Number(botao.closest("[data-id]").dataset.id);
      const livro = estado.livros.find((l) => l.id === id);
      if (!livro) return;

      try {
        switch (botao.dataset.acao) {
          case "notas":
            return abrirNotas(livro);
          case "pagina":
            return abrirMarcarPagina(livro);
          case "editar":
            return abrirFormulario(livro);
          case "excluir": {
            const certo = await confirmar(
              `Excluir "${livro.titulo}" e todas as suas notas?`
            );
            if (!certo) return;
            await api.del(`/livros/${id}`);
            sucesso("Livro excluído.");
            return carregar();
          }
        }
      } catch (e) {
        falha(e);
      }
    })
  );
}

/* ─────────────────────────── início ─────────────────────────── */

async function iniciar() {
  try {
    const { conteudo } = await montar({
      pagina: "igreja",
      sub: "leituras",
      titulo: "Leituras",
      acoes: `<button class="btn btn--ouro" data-novo>
                ${icone("plus")} Novo livro
              </button>`,
    });
    estado.conteudo = conteudo;

    document
      .querySelector("[data-novo]")
      .addEventListener("click", () => abrirFormulario(null));

    await carregar();
  } catch (e) {
    if (e?.status === 401) return;
    falha(e);
  }
}

iniciar();
