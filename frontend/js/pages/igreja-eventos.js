/* ════════════════════════════════════════════════════════════════════
   Ordo — Eventos e missas da paróquia

   Solenidades, festas, retiros, ensaios e formações. Cada um alimenta
   o materializador de lembretes com a sua própria antecedência.
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

const ROTULO_TIPO = {
  missa: "Missa",
  solenidade: "Solenidade",
  festa: "Festa",
  retiro: "Retiro",
  ensaio: "Ensaio",
  formacao: "Formação",
};

const ICONE_TIPO = {
  missa: "church",
  solenidade: "crown",
  festa: "sparkles",
  retiro: "tent-tree",
  ensaio: "music",
  formacao: "graduation-cap",
};

const estado = {
  eventos: [],
  constantes: null,
  tipo: "",
  passados: false,
  conteudo: null,
};

/* ─────────────────────────── render ─────────────────────────── */

function htmlEvento(evento) {
  const d = fmt.paraData(evento.data_hora);
  const passado = d < new Date();

  return `
    <div class="evento ${passado ? "evento--passado" : ""}" data-id="${evento.id}">
      <div class="evento__data">
        <span class="evento__dia">${d.getDate()}</span>
        <span class="evento__mes">${esc(
          d.toLocaleDateString("pt-BR", { month: "short" })
        )}</span>
      </div>

      <div class="crescer">
        <h3 class="evento__titulo">${esc(evento.titulo)}</h3>
        <div class="evento__meta">
          <span class="badge">${icone(ICONE_TIPO[evento.tipo] || "calendar")}${esc(
            ROTULO_TIPO[evento.tipo] || evento.tipo
          )}</span>
          <span>${esc(fmt.hora(evento.data_hora))}</span>
          ${evento.local ? `<span>·</span><span>${esc(evento.local)}</span>` : ""}
          ${
            !passado
              ? `<span>·</span><span>${esc(fmt.relativo(evento.data_hora))}</span>`
              : ""
          }
        </div>
        ${
          evento.descricao
            ? `<p class="evento__descricao">${esc(evento.descricao)}</p>`
            : ""
        }
      </div>

      <div class="linha">
        <button class="btn btn--fantasma btn--icone" data-acao="editar"
                title="Editar">${icone("pencil")}</button>
        <button class="btn btn--fantasma btn--icone" data-acao="excluir"
                title="Excluir">${icone("trash-2")}</button>
      </div>
    </div>`;
}

function htmlFiltros() {
  const tipos = [["", "Todos"], ...Object.entries(ROTULO_TIPO)];

  return `
    <div class="linha-espalhada" style="margin-bottom:18px;flex-wrap:wrap;gap:12px">
      <div class="linha" style="flex-wrap:wrap">
        ${tipos
          .map(
            ([valor, rotulo]) => `
          <button class="chip" data-tipo="${valor}"
                  aria-pressed="${estado.tipo === valor}">${esc(rotulo)}</button>`
          )
          .join("")}
      </div>
      <label class="checkbox">
        <input type="checkbox" data-passados ${estado.passados ? "checked" : ""} />
        <span>Incluir os que já passaram</span>
      </label>
    </div>`;
}

function render() {
  const lista = estado.eventos.length
    ? `<div class="card">${estado.eventos.map(htmlEvento).join("")}</div>`
    : `<div class="card">${vazio({
        icone: "calendar-heart",
        titulo: estado.passados
          ? "Nenhum evento cadastrado"
          : "Nada marcado à frente",
        texto: "Cadastre solenidades, retiros, ensaios e formações para não perder nenhum.",
      })}</div>`;

  estado.conteudo.innerHTML = htmlFiltros() + lista;
  renderizarIcones();
  ligar();
}

async function carregar() {
  try {
    estado.eventos = await api.get("/igreja/eventos", {
      tipo: estado.tipo,
      passados: estado.passados ? 1 : "",
    });
    render();
  } catch (e) {
    falha(e);
  }
}

/* ─────────────────────────── formulário ─────────────────────────── */

function camposEvento(e = {}) {
  const antecedencias = estado.constantes?.antecedencias || [];

  return `
    <div class="campo">
      <label class="campo__rotulo campo__rotulo--obrigatorio" for="titulo">Título</label>
      <input class="input" type="text" id="titulo" name="titulo"
             value="${esc(e.titulo || "")}" required />
    </div>

    <div class="grade-campos">
      <div class="campo">
        <label class="campo__rotulo" for="tipo">Tipo</label>
        <select class="select" id="tipo" name="tipo">
          ${Object.entries(ROTULO_TIPO)
            .map(
              ([valor, rotulo]) =>
                `<option value="${valor}" ${
                  (e.tipo || "missa") === valor ? "selected" : ""
                }>${esc(rotulo)}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="campo">
        <label class="campo__rotulo campo__rotulo--obrigatorio" for="data_hora">
          Data e hora
        </label>
        <input class="input" type="datetime-local" id="data_hora" name="data_hora"
               value="${esc(fmt.paraInputDataHora(e.data_hora))}" required />
      </div>
    </div>

    <div class="grade-campos">
      <div class="campo">
        <label class="campo__rotulo" for="local">Local</label>
        <input class="input" type="text" id="local" name="local"
               value="${esc(e.local || "")}" />
      </div>
      <div class="campo">
        <label class="campo__rotulo" for="lembrete_min">Lembrete</label>
        <select class="select" id="lembrete_min" name="lembrete_min">
          <option value="">— sem lembrete —</option>
          ${antecedencias
            .map(
              (a) =>
                `<option value="${a.minutos}" ${
                  String(a.minutos) === String(e.lembrete_min ?? 1440)
                    ? "selected"
                    : ""
                }>${esc(a.rotulo)}</option>`
            )
            .join("")}
        </select>
      </div>
    </div>

    <div class="campo">
      <label class="campo__rotulo" for="descricao">Descrição</label>
      <textarea class="textarea" id="descricao" name="descricao">${esc(
        e.descricao || ""
      )}</textarea>
    </div>`;
}

async function abrirFormulario(evento) {
  const editando = Boolean(evento);

  await modal({
    titulo: editando ? "Editar evento" : "Novo evento",
    corpo: camposEvento(evento),
    confirmar: editando ? "Salvar" : "Cadastrar",
    aoConfirmar: async (form) => {
      const dados = lerForm(form);
      try {
        if (editando) {
          await api.put(`/igreja/eventos/${evento.id}`, dados);
          sucesso("Evento atualizado.");
        } else {
          await api.post("/igreja/eventos", dados);
          sucesso("Evento cadastrado.");
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
  estado.conteudo.querySelectorAll("[data-tipo]").forEach((chip) =>
    chip.addEventListener("click", () => {
      estado.tipo = chip.dataset.tipo;
      carregar();
    })
  );

  estado.conteudo
    .querySelector("[data-passados]")
    .addEventListener("change", (e) => {
      estado.passados = e.target.checked;
      carregar();
    });

  estado.conteudo.querySelectorAll("[data-acao]").forEach((botao) =>
    botao.addEventListener("click", async () => {
      const id = Number(botao.closest("[data-id]").dataset.id);
      const evento = estado.eventos.find((x) => x.id === id);
      if (!evento) return;

      try {
        if (botao.dataset.acao === "editar") return abrirFormulario(evento);

        const certo = await confirmar(`Excluir o evento "${evento.titulo}"?`);
        if (!certo) return;
        await api.del(`/igreja/eventos/${id}`);
        sucesso("Evento excluído.");
        carregar();
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
      sub: "eventos",
      titulo: "Eventos e missas",
      acoes: `<button class="btn btn--ouro" data-novo>
                ${icone("plus")} Novo evento
              </button>`,
    });
    estado.conteudo = conteudo;

    estado.constantes = await api.get("/constantes");
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
