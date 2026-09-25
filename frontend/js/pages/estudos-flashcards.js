/* ════════════════════════════════════════════════════════════════════
   Ordo — Flashcards

   Duas telas no mesmo lugar: a revisão do dia, que é o uso diário, e a
   lista completa, para criar e editar as cartas.

   O intervalo até a próxima revisão sai de services/srs.py no servidor:
   fácil espaça, médio espaça menos, difícil traz de volta amanhã.
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

const DIFICULDADES = [
  { chave: "dificil", rotulo: "Difícil", detalhe: "volta amanhã", tecla: "1" },
  { chave: "medio", rotulo: "Médio", detalhe: "em breve", tecla: "2" },
  { chave: "facil", rotulo: "Fácil", detalhe: "daqui a um tempo", tecla: "3" },
];

const estado = {
  visao: "revisar", // "revisar" | "lista"
  fila: [],
  indice: 0,
  virada: false,
  totalCartas: 0,
  revisadasAgora: 0,
  cartas: [],
  disciplinas: [],
  disciplinaId: "",
  conteudo: null,
};

/* ─────────────────────────── apoio ─────────────────────────── */

function cartaAtual() {
  return estado.fila[estado.indice] || null;
}

function disciplinaDe(carta) {
  return estado.disciplinas.find((d) => d.id === carta?.disciplina_id) || null;
}

/* ═════════════════════════ revisão ═════════════════════════ */

function htmlRevisao() {
  const carta = cartaAtual();

  if (!carta) {
    const fezAlguma = estado.revisadasAgora > 0;
    return `<div class="card">${vazio({
      icone: fezAlguma ? "party-popper" : "layers",
      titulo: fezAlguma
        ? "Fila do dia concluída"
        : estado.totalCartas
          ? "Nada para revisar hoje"
          : "Nenhum flashcard ainda",
      texto: fezAlguma
        ? `${estado.revisadasAgora} carta${
            estado.revisadasAgora === 1 ? "" : "s"
          } revisada${estado.revisadasAgora === 1 ? "" : "s"}. Volte amanhã.`
        : estado.totalCartas
          ? "Todas as cartas já estão agendadas para outro dia."
          : "Crie a primeira carta e ela entra na fila de hoje.",
    })}</div>`;
  }

  const disciplina = disciplinaDe(carta);
  const restantes = estado.fila.length - estado.indice;

  return `
    <div class="revisao">
      <div class="linha-espalhada" style="margin-bottom:12px">
        <span class="texto-muted" style="font-size:.82rem">
          ${restantes} na fila${
            estado.revisadasAgora
              ? ` · ${estado.revisadasAgora} revisada${
                  estado.revisadasAgora === 1 ? "" : "s"
                }`
              : ""
          }
        </span>
        <span class="texto-muted" style="font-size:.82rem">
          intervalo atual: ${carta.intervalo_dias} dia${
            carta.intervalo_dias === 1 ? "" : "s"
          }
        </span>
      </div>

      <article class="card carta" data-virar>
        ${
          disciplina
            ? `<span class="carta__disciplina" style="color:${esc(disciplina.cor)}">
                 ${esc(disciplina.nome)}
               </span>`
            : ""
        }

        <div class="carta__lado ${estado.virada ? "" : "carta__frente"}">
          ${esc(estado.virada ? carta.verso : carta.frente)}
        </div>

        <span class="carta__dica">
          ${estado.virada ? "Escolha a dificuldade abaixo" : "Clique ou aperte espaço para virar"}
        </span>
      </article>

      ${
        estado.virada
          ? `<div class="botoes-dificuldade">
               ${DIFICULDADES.map(
                 (d) => `
                 <button class="botao-dificuldade" data-dificuldade="${d.chave}">
                   <div class="botao-dificuldade__rotulo">${esc(d.rotulo)}</div>
                   <div class="botao-dificuldade__tecla">${esc(d.detalhe)} · ${d.tecla}</div>
                 </button>`
               ).join("")}
             </div>`
          : `<div class="botoes-dificuldade" style="grid-template-columns:1fr">
               <button class="botao-dificuldade" data-virar-botao>
                 <div class="botao-dificuldade__rotulo">Virar a carta</div>
                 <div class="botao-dificuldade__tecla">espaço</div>
               </button>
             </div>`
      }
    </div>`;
}

function virar() {
  if (!cartaAtual()) return;
  estado.virada = true;
  render();
}

async function responder(dificuldade) {
  const carta = cartaAtual();
  if (!carta || !estado.virada) return;

  try {
    const atualizada = await api.post(`/flashcards/${carta.id}/revisar`, {
      dificuldade,
    });

    estado.revisadasAgora++;
    estado.indice++;
    estado.virada = false;

    const dias = atualizada.intervalo_dias;
    sucesso(
      dias === 1
        ? "De volta amanhã."
        : `Próxima revisão em ${dias} dias, ${fmt.data(atualizada.proxima_revisao)}.`
    );

    render();
  } catch (e) {
    falha(e);
  }
}

/* ═════════════════════════ lista ═════════════════════════ */

function htmlCarta(carta) {
  const disciplina = disciplinaDe(carta);
  const vencida =
    carta.proxima_revisao &&
    fmt.paraData(carta.proxima_revisao) <= fmt.paraData(fmt.hojeISO());

  return `
    <article class="card carta-item" data-id="${carta.id}">
      <div class="carta-item__frente">${esc(carta.frente)}</div>
      <div class="carta-item__verso">${esc(carta.verso)}</div>

      <div class="linha" style="margin-top:11px;flex-wrap:wrap;gap:6px">
        ${
          disciplina
            ? `<span class="badge" style="border-color:${esc(disciplina.cor)};
                     color:${esc(disciplina.cor)}">${esc(disciplina.nome)}</span>`
            : ""
        }
        <span class="badge ${vencida ? "badge--ouro" : ""}">
          ${
            carta.proxima_revisao
              ? vencida
                ? "na fila de hoje"
                : esc(fmt.relativo(carta.proxima_revisao))
              : "nunca revisada"
          }
        </span>
        <span class="crescer"></span>
        <button class="btn btn--fantasma btn--icone" data-acao="editar"
                title="Editar">${icone("pencil")}</button>
        <button class="btn btn--fantasma btn--icone" data-acao="excluir"
                title="Excluir">${icone("trash-2")}</button>
      </div>
    </article>`;
}

function htmlLista() {
  if (!estado.cartas.length) {
    return `<div class="card">${vazio({
      icone: "layers",
      titulo: "Nenhuma carta cadastrada",
      texto: "Uma pergunta na frente, a resposta no verso. A revisão espaçada cuida do resto.",
    })}</div>`;
  }
  return `<div class="cartas-lista">${estado.cartas.map(htmlCarta).join("")}</div>`;
}

/* ═════════════════════════ formulário ═════════════════════════ */

async function abrirFormulario(carta) {
  const editando = Boolean(carta);

  await modal({
    titulo: editando ? "Editar flashcard" : "Novo flashcard",
    confirmar: editando ? "Salvar" : "Criar",
    corpo: `
      <div class="campo">
        <label class="campo__rotulo" for="disciplina_id">Disciplina</label>
        <select class="select" id="disciplina_id" name="disciplina_id">
          <option value="">— sem disciplina —</option>
          ${estado.disciplinas
            .map(
              (d) =>
                `<option value="${d.id}" ${
                  carta?.disciplina_id === d.id ? "selected" : ""
                }>${esc(d.nome)}</option>`
            )
            .join("")}
        </select>
      </div>

      <div class="campo">
        <label class="campo__rotulo campo__rotulo--obrigatorio" for="frente">
          Frente — a pergunta
        </label>
        <textarea class="textarea" id="frente" name="frente" required
                  style="min-height:90px">${esc(carta?.frente || "")}</textarea>
      </div>

      <div class="campo">
        <label class="campo__rotulo campo__rotulo--obrigatorio" for="verso">
          Verso — a resposta
        </label>
        <textarea class="textarea" id="verso" name="verso" required
                  style="min-height:110px">${esc(carta?.verso || "")}</textarea>
      </div>

      ${
        editando
          ? `<p class="texto-muted" style="margin:0;font-size:.8rem">
               Editar o texto não mexe no agendamento da carta.
             </p>`
          : `<p class="texto-muted" style="margin:0;font-size:.8rem">
               A carta nova entra na fila de hoje.
             </p>`
      }`,

    aoConfirmar: async (form) => {
      try {
        const dados = lerForm(form);
        if (editando) {
          await api.put(`/flashcards/${carta.id}`, dados);
          sucesso("Flashcard atualizado.");
        } else {
          await api.post("/flashcards", dados);
          sucesso("Flashcard criado.");
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

/* ═════════════════════════ render ═════════════════════════ */

function htmlBarra() {
  return `
    <div class="linha-espalhada" style="margin-bottom:18px;flex-wrap:wrap;gap:10px">
      <div class="linha">
        <button class="chip" data-visao="revisar"
                aria-pressed="${estado.visao === "revisar"}">
          ${icone("gallery-vertical-end")} Revisar
          ${estado.fila.length ? `<span class="badge">${estado.fila.length}</span>` : ""}
        </button>
        <button class="chip" data-visao="lista"
                aria-pressed="${estado.visao === "lista"}">
          ${icone("list")} Todas as cartas
        </button>
      </div>

      <select class="select" data-disciplina aria-label="Filtrar por disciplina"
              style="width:auto;min-width:180px">
        <option value="">Todas as disciplinas</option>
        ${estado.disciplinas
          .map(
            (d) =>
              `<option value="${d.id}" ${
                String(d.id) === String(estado.disciplinaId) ? "selected" : ""
              }>${esc(d.nome)}</option>`
          )
          .join("")}
      </select>
    </div>`;
}

function render() {
  estado.conteudo.innerHTML =
    htmlBarra() + (estado.visao === "revisar" ? htmlRevisao() : htmlLista());

  renderizarIcones();
  ligar();
}

async function carregar() {
  try {
    const filtro = estado.disciplinaId
      ? { disciplina_id: estado.disciplinaId }
      : undefined;

    const [fila, cartas, disciplinas] = await Promise.all([
      api.get("/flashcards/fila", filtro),
      api.get("/flashcards", filtro),
      api.get("/disciplinas"),
    ]);

    estado.fila = fila.fila;
    estado.totalCartas = fila.total_cartas;
    estado.cartas = cartas;
    estado.disciplinas = disciplinas;
    estado.indice = 0;
    estado.virada = false;

    render();
  } catch (e) {
    falha(e);
  }
}

/* ═════════════════════════ eventos ═════════════════════════ */

function ligar() {
  estado.conteudo.querySelectorAll("[data-visao]").forEach((chip) =>
    chip.addEventListener("click", () => {
      estado.visao = chip.dataset.visao;
      render();
    })
  );

  estado.conteudo
    .querySelector("[data-disciplina]")
    .addEventListener("change", (e) => {
      estado.disciplinaId = e.target.value;
      estado.revisadasAgora = 0;
      carregar();
    });

  estado.conteudo.querySelector("[data-virar]")?.addEventListener("click", virar);
  estado.conteudo
    .querySelector("[data-virar-botao]")
    ?.addEventListener("click", virar);

  estado.conteudo.querySelectorAll("[data-dificuldade]").forEach((botao) =>
    botao.addEventListener("click", () => responder(botao.dataset.dificuldade))
  );

  estado.conteudo.querySelectorAll("[data-acao]").forEach((botao) =>
    botao.addEventListener("click", async () => {
      const id = Number(botao.closest("[data-id]").dataset.id);
      const carta = estado.cartas.find((c) => c.id === id);
      if (!carta) return;

      try {
        if (botao.dataset.acao === "editar") return abrirFormulario(carta);

        const certo = await confirmar("Excluir este flashcard?");
        if (!certo) return;
        await api.del(`/flashcards/${id}`);
        sucesso("Flashcard excluído.");
        carregar();
      } catch (e) {
        falha(e);
      }
    })
  );
}

/** Espaço vira a carta; 1, 2 e 3 respondem. Revisar sem tirar a mão. */
function ligarTeclado() {
  document.addEventListener("keydown", (e) => {
    if (estado.visao !== "revisar") return;
    if (document.querySelector(".modal-fundo")) return;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;

    if (e.code === "Space") {
      e.preventDefault();
      return estado.virada ? null : virar();
    }

    const atalho = DIFICULDADES.find((d) => d.tecla === e.key);
    if (atalho && estado.virada) {
      e.preventDefault();
      responder(atalho.chave);
    }
  });
}

/* ═════════════════════════ início ═════════════════════════ */

async function iniciar() {
  try {
    const { conteudo } = await montar({
      pagina: "estudos",
      sub: "flashcards",
      titulo: "Flashcards",
      acoes: `<button class="btn btn--ouro" data-nova>
                ${icone("plus")} Novo flashcard
              </button>`,
    });
    estado.conteudo = conteudo;

    document
      .querySelector("[data-nova]")
      .addEventListener("click", () => abrirFormulario(null));

    ligarTeclado();
    await carregar();
  } catch (e) {
    if (e?.status === 401) return;
    falha(e);
  }
}

iniciar();
