/* ════════════════════════════════════════════════════════════════════
   Ordo — Tarefas

   Duas visões sobre os mesmos dados: kanban (arrastar entre colunas) e
   tabela (ordenar e filtrar). A visão escolhida fica no localStorage,
   porque é preferência de quem usa, não estado do servidor.
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

const COLUNAS = [
  { chave: "a_fazer", rotulo: "A fazer" },
  { chave: "fazendo", rotulo: "Fazendo" },
  { chave: "feito", rotulo: "Feito" },
];

const ROTULO_PRIORIDADE = { alta: "Alta", media: "Média", baixa: "Baixa" };
const ROTULO_MODULO = { geral: "Geral", igreja: "Igreja", estudos: "Estudos" };
const CHAVE_VISAO = "ordo:tarefas-visao";

const estado = {
  tarefas: [],
  tags: [],
  visao: "kanban",
  filtros: { modulo: "", prioridade: "", tag: "", busca: "" },
  ordenacao: { campo: "prazo", crescente: true },
  conteudo: null,
  sortables: [],
};

/* ─────────────────────────── apoio ─────────────────────────── */

function atrasada(tarefa) {
  return (
    tarefa.prazo &&
    tarefa.status !== "feito" &&
    fmt.paraData(tarefa.prazo) < fmt.paraData(fmt.hojeISO())
  );
}

function progresso(tarefa) {
  const subs = tarefa.subtarefas || [];
  if (!subs.length) return null;
  const feitas = subs.filter((s) => s.concluida).length;
  return { feitas, total: subs.length, pct: (feitas / subs.length) * 100 };
}

function porStatus(status) {
  return estado.tarefas.filter((t) => t.status === status);
}

/* ─────────────────────────── cartão ─────────────────────────── */

function htmlTarefa(tarefa) {
  const p = progresso(tarefa);
  const tags = tarefa.tags || [];

  return `
    <article class="tarefa ${tarefa.status === "feito" ? "tarefa--feita" : ""}"
             data-id="${tarefa.id}" data-prioridade="${esc(tarefa.prioridade)}">
      <div class="tarefa__titulo">${esc(tarefa.titulo)}</div>

      <div class="tarefa__meta">
        <span>${esc(ROTULO_PRIORIDADE[tarefa.prioridade] || "")}</span>
        ${
          tarefa.prazo
            ? `<span>·</span>
               <span class="${atrasada(tarefa) ? "tarefa__prazo--atrasado" : ""}">
                 ${icone("calendar")} ${esc(fmt.relativo(tarefa.prazo))}
               </span>`
            : ""
        }
        ${
          tarefa.modulo !== "geral"
            ? `<span>·</span><span>${esc(ROTULO_MODULO[tarefa.modulo])}</span>`
            : ""
        }
      </div>

      ${
        p
          ? `<div class="tarefa__progresso">
               <div class="tarefa__progresso-rotulo">
                 <span>Checklist</span><span>${p.feitas}/${p.total}</span>
               </div>
               <div class="progresso ${p.pct === 100 ? "progresso--sucesso" : ""}">
                 <div class="progresso__preenchido" style="width:${p.pct}%"></div>
               </div>
             </div>`
          : ""
      }

      ${
        tags.length
          ? `<div class="tarefa__tags">
               ${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
             </div>`
          : ""
      }
    </article>`;
}

/* ─────────────────────────── kanban ─────────────────────────── */

function htmlKanban() {
  return `
    <div class="kanban">
      ${COLUNAS.map((coluna) => {
        const tarefas = porStatus(coluna.chave);
        return `
        <section class="coluna" data-status="${coluna.chave}">
          <div class="coluna__cabecalho">
            <span class="coluna__marca"></span>
            <span class="coluna__titulo">${esc(coluna.rotulo)}</span>
            <span class="crescer"></span>
            <span class="badge">${tarefas.length}</span>
          </div>
          <div class="coluna__lista" data-lista="${coluna.chave}">
            ${tarefas.map(htmlTarefa).join("")}
          </div>
        </section>`;
      }).join("")}
    </div>`;
}

function ligarArrastar() {
  estado.sortables.forEach((s) => s.destroy());
  estado.sortables = [];

  estado.conteudo.querySelectorAll("[data-lista]").forEach((lista) => {
    estado.sortables.push(
      Sortable.create(lista, {
        group: "tarefas",
        animation: 160,
        ghostClass: "fantasma",
        dragClass: "arrastando",
        onEnd: salvarOrdem,
      })
    );
  });
}

/** Lê a posição final de todos os cartões e grava numa transação só. */
async function salvarOrdem() {
  const itens = [];
  estado.conteudo.querySelectorAll("[data-lista]").forEach((lista) => {
    const status = lista.dataset.lista;
    lista.querySelectorAll(".tarefa").forEach((cartao, posicao) => {
      itens.push({ id: Number(cartao.dataset.id), status, ordem: posicao });
    });
  });

  try {
    await api.patch("/tarefas/reordenar", { tarefas: itens });
    await carregar();
  } catch (e) {
    falha(e);
    await carregar(); // devolve o quadro ao estado do servidor
  }
}

/* ─────────────────────────── tabela ─────────────────────────── */

function ordenar(tarefas) {
  const { campo, crescente } = estado.ordenacao;
  const pesoPrioridade = { alta: 0, media: 1, baixa: 2 };

  const copia = [...tarefas];
  copia.sort((a, b) => {
    let x, y;
    if (campo === "prioridade") {
      x = pesoPrioridade[a.prioridade] ?? 9;
      y = pesoPrioridade[b.prioridade] ?? 9;
    } else if (campo === "prazo") {
      // Tarefas sem prazo vão para o fim, nas duas direções.
      if (!a.prazo && !b.prazo) return 0;
      if (!a.prazo) return 1;
      if (!b.prazo) return -1;
      x = a.prazo;
      y = b.prazo;
    } else {
      x = (a[campo] || "").toString().toLowerCase();
      y = (b[campo] || "").toString().toLowerCase();
    }
    if (x < y) return crescente ? -1 : 1;
    if (x > y) return crescente ? 1 : -1;
    return 0;
  });
  return copia;
}

function htmlTabela() {
  const tarefas = ordenar(estado.tarefas);
  if (!tarefas.length) return htmlVazio();

  const seta = (campo) =>
    estado.ordenacao.campo === campo
      ? estado.ordenacao.crescente
        ? " ↑"
        : " ↓"
      : "";

  return `
    <div class="tabela-envolve">
      <table class="tabela">
        <thead>
          <tr>
            <th style="width:34px"></th>
            <th data-ordenavel="titulo" class="col-titulo">Tarefa${seta("titulo")}</th>
            <th data-ordenavel="prioridade">Prioridade${seta("prioridade")}</th>
            <th data-ordenavel="prazo">Prazo${seta("prazo")}</th>
            <th data-ordenavel="modulo">Módulo${seta("modulo")}</th>
            <th>Checklist</th>
            <th class="col-acoes">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${tarefas
            .map((t) => {
              const p = progresso(t);
              return `
            <tr data-id="${t.id}" data-feita="${t.status === "feito" ? "sim" : "nao"}">
              <td>
                <input type="checkbox" data-acao="alternar"
                       ${t.status === "feito" ? "checked" : ""}
                       aria-label="Concluir" style="width:17px;height:17px;
                       accent-color:var(--gold);cursor:pointer" />
              </td>
              <td class="col-titulo">
                ${esc(t.titulo)}
                ${
                  (t.tags || []).length
                    ? `<div class="tarefa__tags">${t.tags
                        .map((g) => `<span class="tag">${esc(g)}</span>`)
                        .join("")}</div>`
                    : ""
                }
              </td>
              <td>${esc(ROTULO_PRIORIDADE[t.prioridade] || "—")}</td>
              <td class="${atrasada(t) ? "tarefa__prazo--atrasado" : ""}">
                ${t.prazo ? esc(fmt.data(t.prazo)) : '<span class="texto-muted">—</span>'}
              </td>
              <td>${esc(ROTULO_MODULO[t.modulo] || t.modulo)}</td>
              <td>${
                p
                  ? `${p.feitas}/${p.total}`
                  : '<span class="texto-muted">—</span>'
              }</td>
              <td class="col-acoes">
                <button class="btn btn--fantasma btn--icone" data-acao="editar"
                        title="Editar">${icone("pencil")}</button>
                <button class="btn btn--fantasma btn--icone" data-acao="excluir"
                        title="Excluir">${icone("trash-2")}</button>
              </td>
            </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function htmlVazio() {
  const filtrando = Object.values(estado.filtros).some(Boolean);
  return `<div class="card">${vazio({
    icone: "check-square",
    titulo: filtrando ? "Nada com esses filtros" : "Nenhuma tarefa por aqui",
    texto: filtrando
      ? "Limpe os filtros para ver todas as tarefas."
      : "Crie a primeira tarefa e ela aparece no quadro.",
  })}</div>`;
}

/* ─────────────────────────── filtros ─────────────────────────── */

function htmlBarra() {
  const seletor = (nome, rotulo, opcoes) => `
    <select class="select" data-filtro="${nome}" aria-label="${esc(rotulo)}"
            style="width:auto;min-width:140px">
      <option value="">${esc(rotulo)}</option>
      ${opcoes
        .map(
          ([valor, texto]) =>
            `<option value="${esc(valor)}" ${
              estado.filtros[nome] === valor ? "selected" : ""
            }>${esc(texto)}</option>`
        )
        .join("")}
    </select>`;

  return `
    <div class="linha-espalhada" style="margin-bottom:18px;flex-wrap:wrap;gap:10px">
      <div class="linha" style="flex-wrap:wrap">
        <div class="linha" style="gap:0">
          <button class="chip" data-visao="kanban"
                  aria-pressed="${estado.visao === "kanban"}">
            ${icone("columns-3")} Kanban
          </button>
          <button class="chip" data-visao="tabela"
                  aria-pressed="${estado.visao === "tabela"}">
            ${icone("table")} Tabela
          </button>
        </div>
      </div>

      <div class="linha" style="flex-wrap:wrap">
        <input class="input" type="search" data-filtro="busca" placeholder="Buscar..."
               value="${esc(estado.filtros.busca)}" style="width:auto;min-width:170px" />
        ${seletor("modulo", "Todos os módulos", Object.entries(ROTULO_MODULO))}
        ${seletor("prioridade", "Toda prioridade", Object.entries(ROTULO_PRIORIDADE))}
        ${seletor(
          "tag",
          "Todas as tags",
          estado.tags.map((t) => [t, t])
        )}
      </div>
    </div>`;
}

/* ─────────────────────────── formulário ─────────────────────────── */

function htmlItemChecklist(sub = {}) {
  return `
    <div class="checklist__item" data-sub>
      <input type="checkbox" ${sub.concluida ? "checked" : ""}
             aria-label="Concluída" />
      <input class="input" type="text" value="${esc(sub.titulo || "")}"
             placeholder="Item do checklist" />
      <input type="hidden" value="${sub.id || ""}" />
      <button type="button" class="btn btn--fantasma btn--icone" data-remover
              aria-label="Remover item">${icone("x")}</button>
    </div>`;
}

function camposTarefa(t = {}) {
  return `
    <div class="campo">
      <label class="campo__rotulo campo__rotulo--obrigatorio" for="titulo">Título</label>
      <input class="input" type="text" id="titulo" name="titulo"
             value="${esc(t.titulo || "")}" required />
    </div>

    <div class="campo">
      <label class="campo__rotulo" for="descricao">Descrição</label>
      <textarea class="textarea" id="descricao" name="descricao">${esc(
        t.descricao || ""
      )}</textarea>
    </div>

    <div class="grade-campos">
      <div class="campo">
        <label class="campo__rotulo" for="status">Status</label>
        <select class="select" id="status" name="status">
          ${COLUNAS.map(
            (c) =>
              `<option value="${c.chave}" ${
                (t.status || "a_fazer") === c.chave ? "selected" : ""
              }>${esc(c.rotulo)}</option>`
          ).join("")}
        </select>
      </div>
      <div class="campo">
        <label class="campo__rotulo" for="prioridade">Prioridade</label>
        <select class="select" id="prioridade" name="prioridade">
          ${Object.entries(ROTULO_PRIORIDADE)
            .map(
              ([valor, rotulo]) =>
                `<option value="${valor}" ${
                  (t.prioridade || "media") === valor ? "selected" : ""
                }>${esc(rotulo)}</option>`
            )
            .join("")}
        </select>
      </div>
    </div>

    <div class="grade-campos">
      <div class="campo">
        <label class="campo__rotulo" for="prazo">Prazo</label>
        <input class="input" type="date" id="prazo" name="prazo"
               value="${esc(t.prazo || "")}" />
      </div>
      <div class="campo">
        <label class="campo__rotulo" for="modulo">Módulo</label>
        <select class="select" id="modulo" name="modulo">
          ${Object.entries(ROTULO_MODULO)
            .map(
              ([valor, rotulo]) =>
                `<option value="${valor}" ${
                  (t.modulo || "geral") === valor ? "selected" : ""
                }>${esc(rotulo)}</option>`
            )
            .join("")}
        </select>
      </div>
    </div>

    <div class="campo">
      <label class="campo__rotulo" for="tags_texto">Tags</label>
      <input class="input" type="text" id="tags_texto" name="tags_texto"
             placeholder="separadas por vírgula"
             value="${esc((t.tags || []).join(", "))}" />
    </div>

    <div class="campo">
      <span class="campo__rotulo">Checklist</span>
      <div class="checklist" data-checklist>
        ${(t.subtarefas || []).map(htmlItemChecklist).join("")}
      </div>
      <button type="button" class="btn btn--contorno btn--pequeno" data-add-item
              style="align-self:flex-start;margin-top:6px">
        ${icone("plus")} Adicionar item
      </button>
    </div>`;
}

function lerChecklist(form) {
  const itens = [];
  form.querySelectorAll("[data-sub]").forEach((linha) => {
    const [caixa, texto, oculto] = linha.querySelectorAll("input");
    const titulo = texto.value.trim();
    if (!titulo) return;
    itens.push({
      id: oculto.value ? Number(oculto.value) : undefined,
      titulo,
      concluida: caixa.checked,
    });
  });
  return itens;
}

async function abrirFormulario(tarefa) {
  const editando = Boolean(tarefa);

  await modal({
    titulo: editando ? "Editar tarefa" : "Nova tarefa",
    corpo: camposTarefa(tarefa),
    confirmar: editando ? "Salvar" : "Criar",

    aoMontar: (form) => {
      const lista = form.querySelector("[data-checklist]");

      form.querySelector("[data-add-item]").addEventListener("click", () => {
        lista.insertAdjacentHTML("beforeend", htmlItemChecklist());
        renderizarIcones();
        lista.lastElementChild.querySelector('input[type="text"]').focus();
      });

      lista.addEventListener("click", (e) => {
        const botao = e.target.closest("[data-remover]");
        if (botao) botao.closest("[data-sub]").remove();
      });
    },

    aoConfirmar: async (form) => {
      const dados = lerForm(form);
      dados.tags = (dados.tags_texto || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      delete dados.tags_texto;
      dados.subtarefas = lerChecklist(form);

      try {
        if (editando) {
          await api.put(`/tarefas/${tarefa.id}`, dados);
          sucesso("Tarefa atualizada.");
        } else {
          await api.post("/tarefas", dados);
          sucesso("Tarefa criada.");
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

/* ─────────────────────────── render ─────────────────────────── */

function render() {
  estado.conteudo.innerHTML =
    htmlBarra() + (estado.visao === "kanban" ? htmlKanban() : htmlTabela());

  if (estado.visao === "kanban" && !estado.tarefas.length) {
    estado.conteudo.insertAdjacentHTML("beforeend", htmlVazio());
  }

  renderizarIcones();
  ligar();
  if (estado.visao === "kanban") ligarArrastar();
}

async function carregar() {
  try {
    const [tarefas, tags] = await Promise.all([
      api.get("/tarefas", {
        modulo: estado.filtros.modulo,
        prioridade: estado.filtros.prioridade,
        tag: estado.filtros.tag,
        busca: estado.filtros.busca,
      }),
      api.get("/tarefas/tags"),
    ]);
    estado.tarefas = tarefas;
    estado.tags = tags;
    render();
  } catch (e) {
    falha(e);
  }
}

/* ─────────────────────────── eventos ─────────────────────────── */

function ligar() {
  estado.conteudo.querySelectorAll("[data-visao]").forEach((botao) =>
    botao.addEventListener("click", () => {
      estado.visao = botao.dataset.visao;
      try {
        localStorage.setItem(CHAVE_VISAO, estado.visao);
      } catch {
        /* sem persistência: a escolha vale só nesta aba */
      }
      render();
    })
  );

  estado.conteudo.querySelectorAll("[data-filtro]").forEach((campo) => {
    const evento = campo.tagName === "SELECT" ? "change" : "input";
    let atraso;
    campo.addEventListener(evento, () => {
      estado.filtros[campo.dataset.filtro] = campo.value;
      clearTimeout(atraso);
      // Digitar na busca não pode disparar um request por tecla.
      atraso = setTimeout(carregar, evento === "input" ? 320 : 0);
    });
  });

  estado.conteudo.querySelectorAll("[data-ordenavel]").forEach((coluna) =>
    coluna.addEventListener("click", () => {
      const campo = coluna.dataset.ordenavel;
      estado.ordenacao =
        estado.ordenacao.campo === campo
          ? { campo, crescente: !estado.ordenacao.crescente }
          : { campo, crescente: true };
      render();
    })
  );

  const alvo = estado.conteudo.querySelector(".kanban, .tabela-envolve");
  if (!alvo) return;

  // Um clique no cartão (fora do arrasto) abre a edição.
  alvo.addEventListener("click", async (e) => {
    const botao = e.target.closest("[data-acao]");
    const linha = e.target.closest("[data-id]");
    if (!linha) return;

    const id = Number(linha.dataset.id);
    const tarefa = estado.tarefas.find((t) => t.id === id);
    if (!tarefa) return;

    if (!botao) {
      if (linha.classList.contains("tarefa")) abrirFormulario(tarefa);
      return;
    }

    try {
      switch (botao.dataset.acao) {
        case "alternar":
          await api.patch(`/tarefas/${id}/status`, {
            status: tarefa.status === "feito" ? "a_fazer" : "feito",
          });
          return carregar();

        case "editar":
          return abrirFormulario(tarefa);

        case "excluir": {
          const certo = await confirmar(`Excluir a tarefa "${tarefa.titulo}"?`);
          if (!certo) return;
          await api.del(`/tarefas/${id}`);
          sucesso("Tarefa excluída.");
          return carregar();
        }
      }
    } catch (erro) {
      falha(erro);
    }
  });
}

/* ─────────────────────────── início ─────────────────────────── */

async function iniciar() {
  try {
    const { conteudo } = await montar({
      pagina: "tarefas",
      titulo: "Tarefas",
      acoes: `<button class="btn btn--ouro" data-nova>
                ${icone("plus")} Nova tarefa
              </button>`,
    });
    estado.conteudo = conteudo;

    try {
      estado.visao = localStorage.getItem(CHAVE_VISAO) || "kanban";
    } catch {
      estado.visao = "kanban";
    }

    document
      .querySelector("[data-nova]")
      .addEventListener("click", () => abrirFormulario(null));

    await carregar();
  } catch (e) {
    if (e?.status === 401) return;
    falha(e);
  }
}

iniciar();
