/* ════════════════════════════════════════════════════════════════════
   Ordo — Quadro de avisos

   Cartões no estilo post-it, com cor, prioridade, fixação e data de
   expiração. Os vencidos somem do quadro, mas continuam no banco e
   podem ser revistos pelo filtro.
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

const ROTULO_PRIORIDADE = { alta: "Alta", media: "Média", baixa: "Baixa" };

const estado = {
  avisos: [],
  cores: [],
  incluirVencidos: false,
  prioridade: "",
  conteudo: null,
};

/* ─────────────────────────── render ─────────────────────────── */

function venceu(aviso) {
  return aviso.expira_em && fmt.paraData(aviso.expira_em) < fmt.paraData(fmt.hojeISO());
}

function htmlPostit(aviso) {
  const vencido = venceu(aviso);

  return `
    <article class="postit ${aviso.fixado ? "postit--fixado" : ""}
                     ${vencido ? "postit--vencido" : ""}"
             style="--papel:${esc(aviso.cor || "#F4E7B8")}"
             data-id="${aviso.id}" data-prioridade="${esc(aviso.prioridade)}">

      <div class="postit__acoes">
        <button class="postit__botao" data-acao="fixar"
                aria-pressed="${aviso.fixado}"
                title="${aviso.fixado ? "Desafixar" : "Fixar no topo"}">
          ${icone("pin")}
        </button>
        <button class="postit__botao" data-acao="editar" title="Editar">
          ${icone("pencil")}
        </button>
        <button class="postit__botao" data-acao="excluir" title="Excluir">
          ${icone("trash-2")}
        </button>
      </div>

      <h2 class="postit__titulo">${esc(aviso.titulo)}</h2>
      ${aviso.conteudo ? `<p class="postit__conteudo">${esc(aviso.conteudo)}</p>` : ""}

      <div class="postit__rodape">
        <span>${esc(ROTULO_PRIORIDADE[aviso.prioridade] || aviso.prioridade)}</span>
        ${
          aviso.expira_em
            ? `<span>·</span><span>${
                vencido
                  ? `venceu ${esc(fmt.relativo(aviso.expira_em))}`
                  : `vence ${esc(fmt.relativo(aviso.expira_em))}`
              }</span>`
            : ""
        }
        <span class="crescer"></span>
        ${aviso.fixado ? `<span title="Fixado">${icone("pin")}</span>` : ""}
      </div>
    </article>`;
}

function htmlFiltros() {
  const prioridades = [
    ["", "Todas"],
    ["alta", "Alta"],
    ["media", "Média"],
    ["baixa", "Baixa"],
  ];

  return `
    <div class="linha-espalhada" style="margin-bottom:18px;flex-wrap:wrap;gap:12px">
      <div class="linha" style="flex-wrap:wrap">
        <span class="texto-muted" style="font-size:.76rem;letter-spacing:.06em;
              text-transform:uppercase">Prioridade</span>
        ${prioridades
          .map(
            ([valor, rotulo]) => `
          <button class="chip" data-prioridade="${valor}"
                  aria-pressed="${estado.prioridade === valor}">${esc(rotulo)}</button>`
          )
          .join("")}
      </div>

      <label class="checkbox">
        <input type="checkbox" data-vencidos ${estado.incluirVencidos ? "checked" : ""} />
        <span>Mostrar vencidos</span>
      </label>
    </div>`;
}

function render() {
  const quadro = estado.avisos.length
    ? `<div class="quadro">${estado.avisos.map(htmlPostit).join("")}</div>`
    : `<div class="card">${vazio({
        icone: "pin",
        titulo: "O quadro está limpo",
        texto: "Cole um aviso para não perder de vista o que precisa lembrar.",
      })}</div>`;

  estado.conteudo.innerHTML = htmlFiltros() + quadro;
  renderizarIcones();
  ligar();
}

/* ─────────────────────────── dados ─────────────────────────── */

async function carregar() {
  try {
    estado.avisos = await api.get("/avisos", {
      incluir_vencidos: estado.incluirVencidos ? 1 : "",
      prioridade: estado.prioridade,
    });
    render();
  } catch (e) {
    falha(e);
  }
}

/* ─────────────────────────── formulário ─────────────────────────── */

function camposAviso(aviso = {}) {
  const corAtual = aviso.cor || estado.cores[0] || "#F4E7B8";

  return `
    <div class="campo">
      <label class="campo__rotulo campo__rotulo--obrigatorio" for="titulo">Título</label>
      <input class="input" type="text" id="titulo" name="titulo"
             value="${esc(aviso.titulo || "")}" required />
    </div>

    <div class="campo">
      <label class="campo__rotulo" for="conteudo">Conteúdo</label>
      <textarea class="textarea" id="conteudo" name="conteudo">${esc(
        aviso.conteudo || ""
      )}</textarea>
    </div>

    <div class="campo">
      <span class="campo__rotulo">Cor do papel</span>
      <div class="cores">
        ${estado.cores
          .map(
            (cor) => `
          <button type="button" class="cores__opcao" data-cor="${esc(cor)}"
                  style="background:${esc(cor)}"
                  aria-pressed="${cor === corAtual}"
                  aria-label="Cor ${esc(cor)}"></button>`
          )
          .join("")}
      </div>
      <input type="hidden" name="cor" value="${esc(corAtual)}" />
    </div>

    <div class="grade-campos">
      <div class="campo">
        <label class="campo__rotulo" for="prioridade">Prioridade</label>
        <select class="select" id="prioridade" name="prioridade">
          ${Object.entries(ROTULO_PRIORIDADE)
            .map(
              ([valor, rotulo]) =>
                `<option value="${valor}" ${
                  (aviso.prioridade || "media") === valor ? "selected" : ""
                }>${esc(rotulo)}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="campo">
        <label class="campo__rotulo" for="expira_em">Expira em</label>
        <input class="input" type="date" id="expira_em" name="expira_em"
               value="${esc(aviso.expira_em || "")}" />
      </div>
    </div>

    <label class="checkbox">
      <input type="checkbox" name="fixado" ${aviso.fixado ? "checked" : ""} />
      <span>Fixar no topo do quadro</span>
    </label>`;
}

async function abrirFormulario(aviso) {
  const editando = Boolean(aviso);

  await modal({
    titulo: editando ? "Editar aviso" : "Novo aviso",
    corpo: camposAviso(aviso),
    confirmar: editando ? "Salvar" : "Colar no quadro",

    aoMontar: (form) => {
      const campoCor = form.querySelector('[name="cor"]');
      form.querySelectorAll("[data-cor]").forEach((botao) =>
        botao.addEventListener("click", () => {
          campoCor.value = botao.dataset.cor;
          form
            .querySelectorAll("[data-cor]")
            .forEach((b) => b.setAttribute("aria-pressed", b === botao));
        })
      );
    },

    aoConfirmar: async (form) => {
      const dados = lerForm(form);
      try {
        if (editando) {
          await api.put(`/avisos/${aviso.id}`, dados);
          sucesso("Aviso atualizado.");
        } else {
          await api.post("/avisos", dados);
          sucesso("Aviso colado no quadro.");
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

/* ─────────────────────────── eventos ─────────────────────────── */

function ligar() {
  estado.conteudo.querySelectorAll("[data-prioridade]").forEach((chip) => {
    if (chip.tagName !== "BUTTON") return;
    chip.addEventListener("click", () => {
      estado.prioridade = chip.dataset.prioridade;
      carregar();
    });
  });

  estado.conteudo
    .querySelector("[data-vencidos]")
    .addEventListener("change", (e) => {
      estado.incluirVencidos = e.target.checked;
      carregar();
    });

  const quadro = estado.conteudo.querySelector(".quadro");
  if (!quadro) return;

  quadro.addEventListener("click", async (e) => {
    const botao = e.target.closest("[data-acao]");
    if (!botao) return;

    const id = Number(botao.closest(".postit").dataset.id);
    const aviso = estado.avisos.find((a) => a.id === id);
    if (!aviso) return;

    try {
      switch (botao.dataset.acao) {
        case "fixar":
          await api.patch(`/avisos/${id}/fixado`);
          return carregar();

        case "editar":
          return abrirFormulario(aviso);

        case "excluir": {
          const certo = await confirmar(`Excluir o aviso "${aviso.titulo}"?`);
          if (!certo) return;
          await api.del(`/avisos/${id}`);
          sucesso("Aviso removido.");
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
      pagina: "avisos",
      titulo: "Quadro de avisos",
      acoes: `<button class="btn btn--ouro" data-novo>
                ${icone("plus")} Novo aviso
              </button>`,
    });
    estado.conteudo = conteudo;

    estado.cores = await api.get("/avisos/cores");
    document
      .querySelector("[data-novo]")
      .addEventListener("click", () => abrirFormulario(null));

    await carregar();
    renderizarIcones();
  } catch (e) {
    if (e?.status === 401) return;
    falha(e);
  }
}

iniciar();
