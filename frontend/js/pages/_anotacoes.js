/* ════════════════════════════════════════════════════════════════════
   Ordo — Anotações (módulo compartilhado)

   A mesma tela serve Igreja e Estudos: muda só o `modulo` enviado à API
   e, nos estudos, o vínculo com a disciplina. As duas páginas chamam
   iniciarAnotacoes() com a sua configuração.
   ══════════════════════════════════════════════════════════════════ */

import { api } from "../core/api.js";
import * as fmt from "../core/fmt.js";
import { montar } from "../core/layout.js";
import { ajustarLinks, renderizar, resumo } from "../core/md.js";
import {
  confirmar,
  esc,
  falha,
  icone,
  modal,
  renderizarIcones,
  sucesso,
  vazio,
} from "../core/ui.js";

const estado = {
  config: null,
  anotacoes: [],
  disciplinas: [],
  selecionada: null,
  busca: "",
  disciplinaId: "",
  conteudo: null,
  editor: null,
};

/* ─────────────────────────── lista ─────────────────────────── */

function htmlItem(anotacao) {
  const ativa = estado.selecionada?.id === anotacao.id;
  const disciplina = estado.disciplinas.find(
    (d) => d.id === anotacao.disciplina_id
  );

  return `
    <button class="nota-item ${ativa ? "nota-item--ativa" : ""}"
            data-id="${anotacao.id}">
      <div class="linha" style="gap:6px">
        ${anotacao.fixada ? icone("pin", "icone nota-item__pin") : ""}
        <span class="nota-item__titulo crescer truncar">${esc(anotacao.titulo)}</span>
      </div>
      <div class="nota-item__meta">
        ${esc(fmt.relativo(anotacao.atualizado_em))}
        ${
          disciplina
            ? ` · <span style="color:${esc(disciplina.cor)}">${esc(
                disciplina.nome
              )}</span>`
            : ""
        }
      </div>
    </button>`;
}

function htmlLista() {
  if (!estado.anotacoes.length) {
    return `<div class="notas-lista__vazio">${
      estado.busca ? "Nada encontrado." : "Nenhuma anotação ainda."
    }</div>`;
  }
  return estado.anotacoes.map(htmlItem).join("");
}

/* ─────────────────────────── leitura ─────────────────────────── */

function htmlLeitura() {
  const a = estado.selecionada;

  if (!a) {
    return `<div class="card">${vazio({
      icone: "notebook-pen",
      titulo: "Escolha uma anotação",
      texto: "Selecione uma anotação na lista, ou crie a primeira.",
    })}</div>`;
  }

  return `
    <article class="card nota-leitura">
      <div class="linha-espalhada" style="align-items:flex-start;margin-bottom:14px">
        <div>
          <h2 style="margin:0 0 3px">${esc(a.titulo)}</h2>
          <p class="texto-muted" style="margin:0;font-size:.8rem">
            Atualizada ${esc(fmt.relativo(a.atualizado_em))}
          </p>
        </div>
        <div class="linha">
          <button class="btn btn--fantasma btn--icone" data-acao="fixar"
                  aria-pressed="${a.fixada}"
                  title="${a.fixada ? "Desafixar" : "Fixar no topo"}">
            ${icone("pin")}
          </button>
          <button class="btn btn--contorno btn--pequeno" data-acao="editar">
            ${icone("pencil")} Editar
          </button>
          <button class="btn btn--fantasma btn--icone" data-acao="excluir"
                  title="Excluir">${icone("trash-2")}</button>
        </div>
      </div>
      <div class="markdown" data-markdown>${renderizar(a.conteudo_md)}</div>
    </article>`;
}

/* ─────────────────────────── editor ─────────────────────────── */

function opcoesDisciplina(selecionada) {
  return [
    `<option value="">— sem disciplina —</option>`,
    ...estado.disciplinas.map(
      (d) =>
        `<option value="${d.id}" ${
          String(d.id) === String(selecionada) ? "selected" : ""
        }>${esc(d.nome)}</option>`
    ),
  ].join("");
}

async function abrirEditor(anotacao) {
  const editando = Boolean(anotacao);

  await modal({
    titulo: editando ? "Editar anotação" : "Nova anotação",
    largo: true,
    confirmar: "Salvar",
    corpo: `
      <div class="campo">
        <label class="campo__rotulo campo__rotulo--obrigatorio" for="titulo">Título</label>
        <input class="input" type="text" id="titulo" name="titulo"
               value="${esc(anotacao?.titulo || "")}" required />
      </div>

      ${
        estado.config.comDisciplina
          ? `<div class="campo">
               <label class="campo__rotulo" for="disciplina_id">Disciplina</label>
               <select class="select" id="disciplina_id" name="disciplina_id">
                 ${opcoesDisciplina(anotacao?.disciplina_id)}
               </select>
             </div>`
          : ""
      }

      <div class="campo">
        <label class="campo__rotulo" for="conteudo_md">Conteúdo</label>
        <textarea id="conteudo_md" name="conteudo_md">${esc(
          anotacao?.conteudo_md || ""
        )}</textarea>
      </div>

      <label class="checkbox">
        <input type="checkbox" name="fixada" ${anotacao?.fixada ? "checked" : ""} />
        <span>Fixar no topo da lista</span>
      </label>`,

    aoMontar: (form) => {
      const area = form.querySelector("#conteudo_md");
      if (!window.EasyMDE) return;

      estado.editor = new window.EasyMDE({
        element: area,
        spellChecker: false,
        autoDownloadFontAwesome: false,
        status: false,
        placeholder: "Escreva em Markdown...",
        toolbar: [
          "bold",
          "italic",
          "heading",
          "|",
          "quote",
          "unordered-list",
          "ordered-list",
          "|",
          "link",
          "preview",
        ],
        // O preview do EasyMDE também precisa ser sanitizado.
        previewRender: (texto) => renderizar(texto),
      });
    },

    aoConfirmar: async (form) => {
      const dados = {
        titulo: form.titulo.value.trim(),
        conteudo_md: estado.editor
          ? estado.editor.value()
          : form.conteudo_md.value,
        modulo: estado.config.modulo,
        fixada: form.fixada.checked,
      };
      if (estado.config.comDisciplina) {
        dados.disciplina_id = form.disciplina_id.value || null;
      }

      try {
        const salva = editando
          ? await api.put(`/anotacoes/${anotacao.id}`, dados)
          : await api.post("/anotacoes", dados);
        sucesso(editando ? "Anotação atualizada." : "Anotação criada.");

        estado.editor?.toTextArea?.();
        estado.editor = null;

        await carregar(salva.id);
        return true;
      } catch (e) {
        const { marcarErros } = await import("../core/ui.js");
        marcarErros(form, falha(e));
        return false;
      }
    },
  });

  // Se o modal foi fechado sem salvar, o editor precisa ser desmontado.
  estado.editor?.toTextArea?.();
  estado.editor = null;
}

/* ─────────────────────────── dados ─────────────────────────── */

async function carregar(selecionarId) {
  try {
    estado.anotacoes = await api.get("/anotacoes", {
      modulo: estado.config.modulo,
      disciplina_id: estado.disciplinaId,
      busca: estado.busca,
    });

    const alvo =
      selecionarId ||
      estado.selecionada?.id ||
      estado.anotacoes[0]?.id ||
      null;

    estado.selecionada = alvo
      ? await api.get(`/anotacoes/${alvo}`).catch(() => null)
      : null;

    render();
  } catch (e) {
    falha(e);
  }
}

/* ─────────────────────────── render ─────────────────────────── */

function render() {
  estado.conteudo.innerHTML = `
    <div class="notas">
      <aside class="notas-lista">
        <input class="input" type="search" data-busca placeholder="Buscar..."
               value="${esc(estado.busca)}" />
        ${
          estado.config.comDisciplina
            ? `<select class="select" data-disciplina aria-label="Filtrar por disciplina">
                 <option value="">Todas as disciplinas</option>
                 ${estado.disciplinas
                   .map(
                     (d) =>
                       `<option value="${d.id}" ${
                         String(d.id) === String(estado.disciplinaId)
                           ? "selected"
                           : ""
                       }>${esc(d.nome)}</option>`
                   )
                   .join("")}
               </select>`
            : ""
        }
        <div class="notas-lista__itens">${htmlLista()}</div>
      </aside>
      <div class="notas-conteudo">${htmlLeitura()}</div>
    </div>`;

  renderizarIcones();

  const corpo = estado.conteudo.querySelector("[data-markdown]");
  if (corpo) ajustarLinks(corpo);

  ligar();
}

function ligar() {
  const busca = estado.conteudo.querySelector("[data-busca]");
  let atraso;
  busca.addEventListener("input", () => {
    estado.busca = busca.value;
    clearTimeout(atraso);
    atraso = setTimeout(() => carregar(), 320);
  });

  estado.conteudo
    .querySelector("[data-disciplina]")
    ?.addEventListener("change", (e) => {
      estado.disciplinaId = e.target.value;
      estado.selecionada = null;
      carregar();
    });

  estado.conteudo.querySelectorAll(".nota-item").forEach((item) =>
    item.addEventListener("click", async () => {
      try {
        estado.selecionada = await api.get(`/anotacoes/${item.dataset.id}`);
        render();
      } catch (e) {
        falha(e);
      }
    })
  );

  estado.conteudo.querySelectorAll("[data-acao]").forEach((botao) =>
    botao.addEventListener("click", async () => {
      const a = estado.selecionada;
      if (!a) return;

      try {
        switch (botao.dataset.acao) {
          case "fixar":
            await api.patch(`/anotacoes/${a.id}/fixada`);
            return carregar(a.id);

          case "editar":
            return abrirEditor(a);

          case "excluir": {
            const certo = await confirmar(`Excluir a anotação "${a.titulo}"?`);
            if (!certo) return;
            await api.del(`/anotacoes/${a.id}`);
            sucesso("Anotação excluída.");
            estado.selecionada = null;
            return carregar();
          }
        }
      } catch (e) {
        falha(e);
      }
    })
  );
}

/* ─────────────────────────── entrada ─────────────────────────── */

/**
 * @param {object} config
 * @param {string} config.modulo          "igreja" ou "estudos"
 * @param {string} config.pagina          item de menu ativo
 * @param {string} config.sub             aba ativa
 * @param {string} config.titulo
 * @param {boolean} config.comDisciplina  mostra o vínculo com disciplina
 */
export async function iniciarAnotacoes(config) {
  estado.config = config;

  try {
    const { conteudo } = await montar({
      pagina: config.pagina,
      sub: config.sub,
      titulo: config.titulo,
      acoes: `<button class="btn btn--ouro" data-nova>
                ${icone("plus")} Nova anotação
              </button>`,
    });
    estado.conteudo = conteudo;

    if (config.comDisciplina) {
      estado.disciplinas = await api.get("/disciplinas").catch(() => []);
    }

    document
      .querySelector("[data-nova]")
      .addEventListener("click", () => abrirEditor(null));

    await carregar();
  } catch (e) {
    if (e?.status === 401) return;
    falha(e);
  }
}
