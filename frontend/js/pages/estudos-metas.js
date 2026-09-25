/* ════════════════════════════════════════════════════════════════════
   Ordo — Metas de estudo

   "10 h de Matemática por semana", com barra de progresso. As horas não
   são digitadas: vêm das sessões do Pomodoro, somadas no período.
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

const ROTULO_PERIODO = { semanal: "por semana", mensal: "por mês" };

const estado = { metas: [], disciplinas: [], conteudo: null };

/* ─────────────────────────── render ─────────────────────────── */

function htmlMeta(meta) {
  const cor = meta.disciplina?.cor || "#B8963E";

  return `
    <article class="card meta ${meta.cumprida ? "meta--cumprida" : ""}
                    ${meta.ativa ? "" : "meta--inativa"}"
             data-id="${meta.id}">
      <div class="linha-espalhada" style="align-items:flex-start">
        <div class="crescer" style="min-width:0">
          <h3 class="meta__descricao">${esc(meta.descricao)}</h3>
          <p class="meta__periodo">
            ${esc(fmt.data(meta.periodo_inicio))} a ${esc(fmt.data(meta.periodo_fim))}
            ${meta.ativa ? "" : " · inativa"}
          </p>
        </div>
        ${
          meta.cumprida
            ? `<span class="badge badge--sucesso">${icone("check")} Cumprida</span>`
            : ""
        }
      </div>

      <div class="meta__numeros">
        <span class="meta__horas">${esc(fmt.horas(meta.horas_feitas))}</span>
        <span class="meta__alvo">
          de ${esc(fmt.horas(meta.alvo_horas))} ${esc(
            ROTULO_PERIODO[meta.periodo] || ""
          )}
        </span>
      </div>

      <div class="progresso ${meta.cumprida ? "progresso--sucesso" : ""}">
        <div class="progresso__preenchido"
             style="width:${meta.percentual}%;background:${esc(cor)}"></div>
      </div>

      <div class="meta__rodape">
        ${
          meta.disciplina
            ? `<span class="badge" style="border-color:${esc(cor)};color:${esc(cor)}">
                 ${esc(meta.disciplina.nome)}
               </span>`
            : ""
        }
        <span class="texto-muted" style="font-size:.78rem">
          ${esc(fmt.porcentagem(meta.percentual, 0))}
        </span>
        <span class="crescer"></span>
        <button class="btn btn--fantasma btn--icone" data-acao="ativa"
                aria-pressed="${meta.ativa}"
                title="${meta.ativa ? "Desativar" : "Reativar"}">
          ${icone(meta.ativa ? "toggle-right" : "toggle-left")}
        </button>
        <button class="btn btn--fantasma btn--icone" data-acao="editar"
                title="Editar">${icone("pencil")}</button>
        <button class="btn btn--fantasma btn--icone" data-acao="excluir"
                title="Excluir">${icone("trash-2")}</button>
      </div>
    </article>`;
}

function render() {
  const lista = estado.metas.length
    ? `<div class="metas">${estado.metas.map(htmlMeta).join("")}</div>`
    : `<div class="card">${vazio({
        icone: "target",
        titulo: "Nenhuma meta definida",
        texto: "Defina quantas horas por semana quer dedicar a cada disciplina. As horas vêm do Pomodoro.",
      })}</div>`;

  estado.conteudo.innerHTML = lista;
  renderizarIcones();
  ligar();
}

async function carregar() {
  try {
    [estado.metas, estado.disciplinas] = await Promise.all([
      api.get("/metas"),
      api.get("/disciplinas"),
    ]);
    render();
  } catch (e) {
    falha(e);
  }
}

/* ─────────────────────────── formulário ─────────────────────────── */

async function abrirFormulario(meta) {
  const editando = Boolean(meta);

  if (!estado.disciplinas.length) {
    return falha({ message: "Cadastre uma disciplina antes de criar metas." });
  }

  await modal({
    titulo: editando ? "Editar meta" : "Nova meta",
    confirmar: editando ? "Salvar" : "Criar",
    corpo: `
      <div class="campo">
        <label class="campo__rotulo campo__rotulo--obrigatorio" for="disciplina_id">
          Disciplina
        </label>
        <select class="select" id="disciplina_id" name="disciplina_id">
          ${estado.disciplinas
            .map(
              (d) =>
                `<option value="${d.id}" ${
                  meta?.disciplina_id === d.id ? "selected" : ""
                }>${esc(d.nome)}</option>`
            )
            .join("")}
        </select>
      </div>

      <div class="grade-campos">
        <div class="campo">
          <label class="campo__rotulo campo__rotulo--obrigatorio" for="alvo_horas">
            Horas
          </label>
          <input class="input" type="number" id="alvo_horas" name="alvo_horas"
                 min="0.5" step="0.5" value="${esc(meta?.alvo_horas || 10)}" required />
        </div>
        <div class="campo">
          <label class="campo__rotulo" for="periodo">Período</label>
          <select class="select" id="periodo" name="periodo">
            ${Object.entries(ROTULO_PERIODO)
              .map(
                ([valor, rotulo]) =>
                  `<option value="${valor}" ${
                    (meta?.periodo || "semanal") === valor ? "selected" : ""
                  }>${esc(rotulo)}</option>`
              )
              .join("")}
          </select>
        </div>
      </div>

      <div class="campo">
        <label class="campo__rotulo campo__rotulo--obrigatorio" for="descricao">
          Descrição
        </label>
        <input class="input" type="text" id="descricao" name="descricao"
               value="${esc(meta?.descricao || "")}"
               placeholder="10 h de Matemática por semana" required />
      </div>

      <label class="checkbox">
        <input type="checkbox" name="ativa" ${meta?.ativa !== false ? "checked" : ""} />
        <span>Meta ativa</span>
      </label>`,

    aoMontar: (form) => {
      // Sugere a descrição a partir da disciplina, das horas e do período,
      // mas sem sobrescrever o que o usuário já escreveu.
      const campoDescricao = form.querySelector('[name="descricao"]');
      let tocado = Boolean(campoDescricao.value);
      campoDescricao.addEventListener("input", () => {
        tocado = true;
      });

      const sugerir = () => {
        if (tocado) return;
        const disciplina = estado.disciplinas.find(
          (d) => String(d.id) === form.disciplina_id.value
        );
        const horas = form.alvo_horas.value;
        const periodo = ROTULO_PERIODO[form.periodo.value];
        if (disciplina && horas) {
          campoDescricao.value = `${horas} h de ${disciplina.nome} ${periodo}`;
        }
      };

      ["disciplina_id", "alvo_horas", "periodo"].forEach((nome) =>
        form[nome].addEventListener("change", sugerir)
      );
      sugerir();
    },

    aoConfirmar: async (form) => {
      try {
        const dados = lerForm(form);
        if (editando) {
          await api.put(`/metas/${meta.id}`, dados);
          sucesso("Meta atualizada.");
        } else {
          await api.post("/metas", dados);
          sucesso("Meta criada.");
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
  estado.conteudo.querySelectorAll("[data-acao]").forEach((botao) =>
    botao.addEventListener("click", async () => {
      const id = Number(botao.closest("[data-id]").dataset.id);
      const meta = estado.metas.find((m) => m.id === id);
      if (!meta) return;

      try {
        switch (botao.dataset.acao) {
          case "ativa":
            await api.put(`/metas/${id}`, { ativa: !meta.ativa });
            return carregar();
          case "editar":
            return abrirFormulario(meta);
          case "excluir": {
            const certo = await confirmar(`Excluir a meta "${meta.descricao}"?`);
            if (!certo) return;
            await api.del(`/metas/${id}`);
            sucesso("Meta excluída.");
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
      pagina: "estudos",
      sub: "metas",
      titulo: "Metas",
      acoes: `<button class="btn btn--ouro" data-nova>
                ${icone("plus")} Nova meta
              </button>`,
    });
    estado.conteudo = conteudo;

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
