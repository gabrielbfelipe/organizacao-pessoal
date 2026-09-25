/* ════════════════════════════════════════════════════════════════════
   Ordo — Pomodoro

   Timer que registra sozinho as horas estudadas por disciplina.

   O cuidado central é não perder tempo já cumprido: o estado do ciclo
   vai para o localStorage a cada segundo e é recuperado ao reabrir a
   página, e um sendBeacon grava a sessão parcial se a aba for fechada
   no meio. Um timer que perde o que você fez não serve para nada.
   ══════════════════════════════════════════════════════════════════ */

import { api } from "../core/api.js";
import * as fmt from "../core/fmt.js";
import * as graficos from "../core/graficos.js";
import { montar } from "../core/layout.js";
import { esc, falha, icone, renderizarIcones, sucesso } from "../core/ui.js";

const CHAVE_ESTADO = "ordo:pomodoro";
const CICLOS_ATE_PAUSA_LONGA = 4;

const DURACOES = { foco: 25, curta: 5, longa: 15 };

const estado = {
  disciplinas: [],
  disciplinaId: "",
  fase: "foco",
  restante: DURACOES.foco * 60,
  rodando: false,
  ciclos: 0,
  inicioReal: null, // quando o ciclo de foco começou, para gravar a sessão
  intervalo: null,
  sessoes: [],
  resumo: null,
  grafico: null,
  conteudo: null,
};

/* ─────────────────────── persistência local ─────────────────────── */

function salvarEstado() {
  try {
    localStorage.setItem(
      CHAVE_ESTADO,
      JSON.stringify({
        fase: estado.fase,
        restante: estado.restante,
        ciclos: estado.ciclos,
        disciplinaId: estado.disciplinaId,
        inicioReal: estado.inicioReal,
        rodando: estado.rodando,
        salvoEm: Date.now(),
      })
    );
  } catch {
    /* sem persistência: o ciclo vale só enquanto a aba estiver aberta */
  }
}

function recuperarEstado() {
  let guardado;
  try {
    guardado = JSON.parse(localStorage.getItem(CHAVE_ESTADO) || "null");
  } catch {
    return;
  }
  if (!guardado) return;

  estado.fase = guardado.fase || "foco";
  estado.ciclos = guardado.ciclos || 0;
  estado.disciplinaId = guardado.disciplinaId || "";
  estado.inicioReal = guardado.inicioReal || null;

  // Se estava rodando, desconta o tempo que passou com a aba fechada.
  const decorrido = guardado.rodando
    ? Math.floor((Date.now() - guardado.salvoEm) / 1000)
    : 0;
  estado.restante = Math.max(0, (guardado.restante || 0) - decorrido);
}

function limparEstado() {
  try {
    localStorage.removeItem(CHAVE_ESTADO);
  } catch {
    /* nada a fazer */
  }
}

/* ─────────────────────── gravação da sessão ─────────────────────── */

/** Grava os minutos de foco cumpridos. Devolve quantos foram. */
async function gravarSessao(minutos) {
  const inteiros = Math.floor(minutos);
  if (inteiros < 1) return 0;

  await api.post("/sessoes", {
    disciplina_id: estado.disciplinaId || null,
    duracao_min: inteiros,
    tipo: "pomodoro",
    inicio: estado.inicioReal
      ? fmt.paraInputDataHora(new Date(estado.inicioReal))
      : null,
  });
  return inteiros;
}

/**
 * Fechar a aba no meio do foco não pode apagar o tempo cumprido.
 * sendBeacon entrega mesmo com a página sendo descarregada.
 */
function gravarParcialAoSair() {
  if (estado.fase !== "foco" || !estado.rodando || !estado.inicioReal) return;

  const minutos = Math.floor(
    (DURACOES.foco * 60 - estado.restante) / 60
  );
  if (minutos < 1) return;

  const corpo = JSON.stringify({
    disciplina_id: estado.disciplinaId || null,
    duracao_min: minutos,
    tipo: "pomodoro",
    inicio: fmt.paraInputDataHora(new Date(estado.inicioReal)),
  });

  navigator.sendBeacon?.(
    "/api/sessoes",
    new Blob([corpo], { type: "application/json" })
  );
  limparEstado();
}

/* ─────────────────────────── o ciclo ─────────────────────────── */

function duracaoDaFase() {
  return DURACOES[estado.fase] * 60;
}

function iniciar_() {
  if (estado.rodando) return;
  estado.rodando = true;
  if (estado.fase === "foco" && !estado.inicioReal) {
    estado.inicioReal = Date.now();
  }

  estado.intervalo = setInterval(() => {
    estado.restante--;
    if (estado.restante <= 0) {
      concluirFase();
    } else {
      salvarEstado();
      pintarRelogio();
    }
  }, 1000);

  render();
}

function pausar() {
  estado.rodando = false;
  clearInterval(estado.intervalo);
  salvarEstado();
  render();
}

function reiniciarFase() {
  clearInterval(estado.intervalo);
  estado.rodando = false;
  estado.restante = duracaoDaFase();
  estado.inicioReal = null;
  salvarEstado();
  render();
}

async function concluirFase() {
  clearInterval(estado.intervalo);
  estado.rodando = false;

  if (estado.fase === "foco") {
    estado.ciclos++;
    try {
      const minutos = await gravarSessao(DURACOES.foco);
      if (minutos) sucesso(`${minutos} minutos registrados.`);
      await carregarHistorico();
    } catch (e) {
      falha(e);
    }
    estado.inicioReal = null;
    estado.fase =
      estado.ciclos % CICLOS_ATE_PAUSA_LONGA === 0 ? "longa" : "curta";
  } else {
    estado.fase = "foco";
  }

  estado.restante = duracaoDaFase();
  salvarEstado();
  avisar();
  render();
}

/** Aviso discreto ao fim de cada fase. */
function avisar() {
  const texto =
    estado.fase === "foco"
      ? "Pausa encerrada. De volta ao estudo."
      : "Ciclo concluído. Hora da pausa.";

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification("Ordo · Pomodoro", { body: texto });
      return;
    } catch {
      /* cai no toast */
    }
  }
  sucesso(texto);
}

/* ─────────────────────────── render ─────────────────────────── */

function formatarRelogio(segundos) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Atualiza só os números, a cada segundo, sem refazer a tela inteira. */
function pintarRelogio() {
  const relogio = estado.conteudo.querySelector("[data-relogio]");
  const anel = estado.conteudo.querySelector("[data-anel]");
  if (!relogio) return;

  relogio.textContent = formatarRelogio(estado.restante);
  document.title = `${formatarRelogio(estado.restante)} · Ordo`;

  if (anel) {
    const pct = ((duracaoDaFase() - estado.restante) / duracaoDaFase()) * 100;
    anel.style.width = `${pct}%`;
  }
}

function htmlPomodoro() {
  const rotuloFase = {
    foco: "Foco",
    curta: "Pausa curta",
    longa: "Pausa longa",
  }[estado.fase];

  const pct = ((duracaoDaFase() - estado.restante) / duracaoDaFase()) * 100;
  const descanso = estado.fase !== "foco";

  return `
    <div class="pomodoro">
      <div class="card" style="padding:30px 26px">
        <div class="campo" style="max-width:280px;margin:0 auto">
          <label class="campo__rotulo" for="disciplina">Estudando</label>
          <select class="select" id="disciplina" data-disciplina
                  ${estado.rodando ? "disabled" : ""}>
            <option value="">— sem disciplina —</option>
            ${estado.disciplinas
              .map(
                (d) =>
                  `<option value="${d.id}" ${
                    String(d.id) === String(estado.disciplinaId) ? "selected" : ""
                  }>${esc(d.nome)}</option>`
              )
              .join("")}
          </select>
        </div>

        <div class="relogio ${descanso ? "relogio--descanso" : ""}" data-relogio>
          ${formatarRelogio(estado.restante)}
        </div>
        <div class="fase">${esc(rotuloFase)}</div>

        <div class="anel">
          <div class="anel__preenchido" data-anel style="width:${pct}%"></div>
        </div>

        <div class="controles">
          ${
            estado.rodando
              ? `<button class="btn btn--contorno" data-acao="pausar">
                   ${icone("pause")} Pausar
                 </button>`
              : `<button class="btn btn--ouro" data-acao="iniciar">
                   ${icone("play")} ${
                     estado.restante === duracaoDaFase() ? "Começar" : "Continuar"
                   }
                 </button>`
          }
          <button class="btn btn--contorno" data-acao="reiniciar">
            ${icone("rotate-ccw")} Reiniciar
          </button>
          <button class="btn btn--fantasma" data-acao="pular">
            ${icone("skip-forward")} Pular fase
          </button>
        </div>

        <div class="ciclos" title="${estado.ciclos} ciclos concluídos">
          ${Array.from(
            { length: CICLOS_ATE_PAUSA_LONGA },
            (_, i) =>
              `<span class="ciclo ${
                i < estado.ciclos % CICLOS_ATE_PAUSA_LONGA ||
                (estado.ciclos > 0 && estado.ciclos % CICLOS_ATE_PAUSA_LONGA === 0)
                  ? "ciclo--feito"
                  : ""
              }"></span>`
          ).join("")}
        </div>
      </div>

      ${htmlGrafico()}
      ${htmlResumo()}
      ${htmlHistorico()}
    </div>`;
}

function htmlGrafico() {
  const serie = estado.resumo?.serie_14_dias;
  // Sem nenhuma hora registrada, o gráfico seria uma faixa de zeros.
  if (!serie?.length || !serie.some((p) => p.horas > 0)) return "";

  return graficos.bloco({
    id: "grafico-horas",
    titulo: "Horas por dia",
    subtitulo: "Últimos 14 dias",
    altura: 200,
    colunas: ["Dia", "Horas"],
    linhas: serie
      .filter((p) => p.horas > 0)
      .map((p) => [fmt.data(p.data), fmt.horas(p.horas)]),
  });
}

function desenharGrafico() {
  estado.grafico?.destroy();
  estado.grafico = null;

  const tela = document.getElementById("grafico-horas");
  if (!tela) return;

  estado.grafico = graficos.horasPorDia(
    tela,
    estado.resumo.serie_14_dias.map((p) => ({
      rotulo: fmt.dataCurta(p.data),
      horas: p.horas,
    }))
  );
}

function htmlResumo() {
  const r = estado.resumo;
  if (!r) return "";

  return `
    <section class="card historico">
      <div class="card__cabecalho">
        <h2 class="card__titulo">Esta semana</h2>
        <span class="badge badge--ouro">${esc(fmt.horas(r.horas_semana))}</span>
      </div>
      ${
        r.por_disciplina.length
          ? r.por_disciplina
              .map(
                (b) => `
          <div class="item-lista">
            <span class="amostra-cor amostra-cor--pequena"
                  style="background:${esc(b.cor)}"></span>
            <span class="crescer">${esc(b.nome)}</span>
            <span class="texto-muted">${esc(fmt.horas(b.horas))}</span>
          </div>`
              )
              .join("")
          : `<p class="texto-muted" style="margin:0;font-size:.88rem">
               Nenhuma sessão registrada nesta semana.</p>`
      }
    </section>`;
}

function htmlHistorico() {
  if (!estado.sessoes.length) return "";

  return `
    <section class="card historico">
      <div class="card__cabecalho">
        <h2 class="card__titulo">Últimas sessões</h2>
      </div>
      ${estado.sessoes
        .slice(0, 8)
        .map((s) => {
          const disciplina = estado.disciplinas.find(
            (d) => d.id === s.disciplina_id
          );
          return `
        <div class="item-lista">
          ${icone("timer")}
          <div class="crescer">
            <div>${esc(disciplina?.nome || "Sem disciplina")}</div>
            <div class="texto-muted" style="font-size:.78rem">
              ${esc(fmt.dataHora(s.inicio))}
            </div>
          </div>
          <span class="badge">${esc(fmt.duracao(s.duracao_min))}</span>
        </div>`;
        })
        .join("")}
    </section>`;
}

function render() {
  estado.conteudo.innerHTML = htmlPomodoro();
  renderizarIcones();
  desenharGrafico();
  ligar();
}

/* ─────────────────────────── eventos ─────────────────────────── */

function ligar() {
  estado.conteudo
    .querySelector("[data-disciplina]")
    ?.addEventListener("change", (e) => {
      estado.disciplinaId = e.target.value;
      salvarEstado();
    });

  estado.conteudo.querySelectorAll("[data-acao]").forEach((botao) =>
    botao.addEventListener("click", () => {
      switch (botao.dataset.acao) {
        case "iniciar":
          return iniciar_();
        case "pausar":
          return pausar();
        case "reiniciar":
          return reiniciarFase();
        case "pular":
          return concluirFase();
      }
    })
  );
}

async function carregarHistorico() {
  try {
    [estado.sessoes, estado.resumo] = await Promise.all([
      api.get("/sessoes"),
      api.get("/sessoes/resumo"),
    ]);
  } catch (e) {
    falha(e);
  }
}

/* ─────────────────────────── início ─────────────────────────── */

async function iniciarPagina() {
  try {
    const { conteudo } = await montar({
      pagina: "estudos",
      sub: "pomodoro",
      titulo: "Pomodoro",
    });
    estado.conteudo = conteudo;

    estado.disciplinas = await api.get("/disciplinas");
    recuperarEstado();
    await carregarHistorico();
    render();

    // O ciclo continua de onde parou, sem recomeçar do zero.
    if (estado.restante <= 0) {
      concluirFase();
    }

    // O Chart.js guarda as cores na criação: trocar o tema pede redesenho.
    graficos.aoTrocarTema(desenharGrafico);

    window.addEventListener("beforeunload", gravarParcialAoSair);
  } catch (e) {
    if (e?.status === 401) return;
    falha(e);
  }
}

iniciarPagina();
