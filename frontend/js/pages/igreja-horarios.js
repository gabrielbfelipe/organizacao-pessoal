/* ════════════════════════════════════════════════════════════════════
   Ordo — Horários fixos

   Grade semanal de missas, confissões e adoração. O servidor devolve a
   grade já agrupada por dia, e projeta as próximas ocorrências em datas
   concretas — é daí que sai "a próxima confissão" do dashboard.
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
} from "../core/ui.js";

const ROTULO_TIPO = {
  missa: "Missa",
  confissao: "Confissão",
  adoracao: "Adoração",
};

const estado = { grade: [], proximos: [], tipo: "", conteudo: null };

/** O backend usa 0 = segunda; getDay() usa 0 = domingo. */
function diaDeHoje() {
  return (new Date().getDay() + 6) % 7;
}

/* ─────────────────────────── render ─────────────────────────── */

function htmlHorario(horario) {
  return `
    <div class="horario" data-id="${horario.id}" data-tipo="${esc(horario.tipo)}">
      <span class="horario__hora">${esc(fmt.hora(horario.horario))}</span>
      <span class="horario__tipo"></span>
      <div class="crescer">
        <div class="horario__texto">${esc(ROTULO_TIPO[horario.tipo] || horario.tipo)}</div>
        ${
          horario.local || horario.observacao
            ? `<div class="horario__local">
                 ${esc(horario.local || "")}${
                   horario.local && horario.observacao ? " · " : ""
                 }${esc(horario.observacao || "")}
               </div>`
            : ""
        }
      </div>
      <button class="btn btn--fantasma btn--icone horario__excluir"
              data-acao="excluir" title="Remover">${icone("trash-2")}</button>
    </div>`;
}

function htmlGrade() {
  const hoje = diaDeHoje();

  return `
    <div class="grade">
      ${estado.grade
        .map(
          (dia) => `
        <section class="card dia ${dia.dia_semana === hoje ? "dia--hoje" : ""}">
          <div class="dia__nome">
            ${esc(dia.nome)}${dia.dia_semana === hoje ? " · hoje" : ""}
          </div>
          ${
            dia.horarios.length
              ? dia.horarios.map(htmlHorario).join("")
              : `<div class="dia__vazio">Sem horários.</div>`
          }
        </section>`
        )
        .join("")}
    </div>`;
}

function htmlProximos() {
  if (!estado.proximos.length) return "";

  return `
    <section class="card" style="margin-bottom:18px">
      <div class="card__cabecalho">
        <h2 class="card__titulo">Próximas ocorrências</h2>
      </div>
      <div class="linha" style="flex-wrap:wrap;gap:10px">
        ${estado.proximos
          .map(
            (p) => `
          <span class="badge badge--ouro">
            ${esc(ROTULO_TIPO[p.tipo] || p.tipo)} ·
            ${esc(fmt.relativo(p.quando))} às ${esc(fmt.hora(p.quando))}
          </span>`
          )
          .join("")}
      </div>
    </section>`;
}

function htmlFiltros() {
  const tipos = [["", "Tudo"], ...Object.entries(ROTULO_TIPO)];
  return `
    <div class="linha" style="margin-bottom:18px;flex-wrap:wrap">
      ${tipos
        .map(
          ([valor, rotulo]) => `
        <button class="chip" data-tipo="${valor}"
                aria-pressed="${estado.tipo === valor}">${esc(rotulo)}</button>`
        )
        .join("")}
    </div>`;
}

function render() {
  estado.conteudo.innerHTML = htmlFiltros() + htmlProximos() + htmlGrade();
  renderizarIcones();
  ligar();
}

async function carregar() {
  try {
    const [grade, proximos] = await Promise.all([
      api.get("/igreja/horarios", { tipo: estado.tipo }),
      api.get("/igreja/horarios/proximos", { tipo: estado.tipo }),
    ]);
    estado.grade = grade.grade;
    estado.proximos = proximos;
    render();
  } catch (e) {
    falha(e);
  }
}

/* ─────────────────────────── formulário ─────────────────────────── */

async function abrirFormulario() {
  const dias = [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo",
  ];

  await modal({
    titulo: "Novo horário fixo",
    confirmar: "Adicionar à grade",
    corpo: `
      <div class="grade-campos">
        <div class="campo">
          <label class="campo__rotulo campo__rotulo--obrigatorio" for="tipo">Tipo</label>
          <select class="select" id="tipo" name="tipo">
            ${Object.entries(ROTULO_TIPO)
              .map(([v, r]) => `<option value="${v}">${esc(r)}</option>`)
              .join("")}
          </select>
        </div>
        <div class="campo">
          <label class="campo__rotulo campo__rotulo--obrigatorio" for="dia_semana">
            Dia da semana
          </label>
          <select class="select" id="dia_semana" name="dia_semana">
            ${dias
              .map(
                (d, i) =>
                  `<option value="${i}" ${
                    i === diaDeHoje() ? "selected" : ""
                  }>${esc(d)}</option>`
              )
              .join("")}
          </select>
        </div>
      </div>

      <div class="grade-campos">
        <div class="campo">
          <label class="campo__rotulo campo__rotulo--obrigatorio" for="horario">
            Horário
          </label>
          <input class="input" type="time" id="horario" name="horario"
                 value="19:00" required />
        </div>
        <div class="campo">
          <label class="campo__rotulo" for="local">Local</label>
          <input class="input" type="text" id="local" name="local"
                 placeholder="Igreja Matriz" />
        </div>
      </div>

      <div class="campo">
        <label class="campo__rotulo" for="observacao">Observação</label>
        <input class="input" type="text" id="observacao" name="observacao"
               placeholder="Antes da missa, com confessor visitante..." />
      </div>`,

    aoConfirmar: async (form) => {
      try {
        await api.post("/igreja/horarios", lerForm(form));
        sucesso("Horário adicionado à grade.");
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
  estado.conteudo.querySelectorAll("[data-tipo]").forEach((chip) => {
    if (chip.tagName !== "BUTTON" || !chip.classList.contains("chip")) return;
    chip.addEventListener("click", () => {
      estado.tipo = chip.dataset.tipo;
      carregar();
    });
  });

  estado.conteudo.querySelectorAll('[data-acao="excluir"]').forEach((botao) =>
    botao.addEventListener("click", async () => {
      const linha = botao.closest(".horario");
      const rotulo = linha.querySelector(".horario__texto").textContent.trim();
      const hora = linha.querySelector(".horario__hora").textContent.trim();

      const certo = await confirmar(`Remover ${rotulo} às ${hora} da grade?`, {
        confirmar: "Remover",
      });
      if (!certo) return;

      try {
        await api.del(`/igreja/horarios/${linha.dataset.id}`);
        sucesso("Horário removido.");
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
      sub: "horarios",
      titulo: "Horários fixos",
      acoes: `<button class="btn btn--ouro" data-novo>
                ${icone("plus")} Novo horário
              </button>`,
    });
    estado.conteudo = conteudo;

    document
      .querySelector("[data-novo]")
      .addEventListener("click", abrirFormulario);

    await carregar();
  } catch (e) {
    if (e?.status === 401) return;
    falha(e);
  }
}

iniciar();
