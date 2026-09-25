/* ════════════════════════════════════════════════════════════════════
   Ordo — a casca da aplicação

   Este é o único arquivo que desenha a sidebar, a topbar e a faixa
   litúrgica. Cada página chama montar() e recebe de volta o elemento
   onde deve renderizar o seu conteúdo — nenhuma página repete a casca.

       import { montar } from "../js/core/layout.js";
       const { conteudo } = await montar({ pagina: "agenda", titulo: "Agenda" });
       conteudo.innerHTML = "...";
   ══════════════════════════════════════════════════════════════════ */

import { api } from "./api.js";
import { abrir as abrirBusca, iniciar as iniciarBusca } from "./busca.js";
import * as fmt from "./fmt.js";
import {
  estadoPermissao,
  iniciar as iniciarLembretes,
  pedirPermissao,
} from "./lembretes.js";
import { alternar as alternarTema, iniciar as iniciarTema, temaAtual } from "./tema.js";
import { esc, icone, renderizarIcones } from "./ui.js";

/* A sidebar tem exatamente os sete módulos do projeto. As telas internas
   de Igreja e Estudos aparecem como abas dentro do próprio módulo. */
const MENU = [
  { chave: "dashboard", rotulo: "Dashboard", icone: "layout-dashboard", url: "/index.html" },
  { chave: "agenda", rotulo: "Agenda", icone: "calendar-days", url: "/pages/agenda.html" },
  { chave: "tarefas", rotulo: "Tarefas", icone: "check-square", url: "/pages/tarefas.html" },
  { chave: "avisos", rotulo: "Avisos", icone: "pin", url: "/pages/avisos.html" },
  { chave: "igreja", rotulo: "Igreja", icone: "church", url: "/pages/igreja-escalas.html" },
  { chave: "estudos", rotulo: "Estudos", icone: "graduation-cap", url: "/pages/estudos-simulados.html" },
  { chave: "config", rotulo: "Configurações", icone: "settings", url: "/pages/configuracoes.html" },
];

const ABAS = {
  igreja: [
    { chave: "escalas", rotulo: "Escalas", url: "/pages/igreja-escalas.html" },
    { chave: "eventos", rotulo: "Eventos", url: "/pages/igreja-eventos.html" },
    { chave: "horarios", rotulo: "Horários fixos", url: "/pages/igreja-horarios.html" },
    { chave: "oracoes", rotulo: "Orações", url: "/pages/igreja-oracoes.html" },
    { chave: "materiais", rotulo: "Materiais", url: "/pages/igreja-materiais.html" },
    { chave: "leituras", rotulo: "Leituras", url: "/pages/igreja-leituras.html" },
    { chave: "anotacoes", rotulo: "Anotações", url: "/pages/igreja-anotacoes.html" },
  ],
  estudos: [
    { chave: "simulados", rotulo: "Simulados", url: "/pages/estudos-simulados.html" },
    { chave: "erros", rotulo: "Caderno de erros", url: "/pages/estudos-erros.html" },
    { chave: "flashcards", rotulo: "Flashcards", url: "/pages/estudos-flashcards.html" },
    { chave: "pomodoro", rotulo: "Pomodoro", url: "/pages/estudos-pomodoro.html" },
    { chave: "metas", rotulo: "Metas", url: "/pages/estudos-metas.html" },
    { chave: "anotacoes", rotulo: "Anotações", url: "/pages/estudos-anotacoes.html" },
  ],
};

/** Dados compartilhados que a página pode reaproveitar sem novo request. */
export const contexto = { usuario: null, liturgia: null };

function htmlSidebar(paginaAtiva, usuario) {
  const itens = MENU.map(
    (item) => `
    <a class="sidebar__item" href="${item.url}"
       ${item.chave === paginaAtiva ? 'aria-current="page"' : ""}>
      ${icone(item.icone)}<span>${esc(item.rotulo)}</span>
    </a>`
  ).join("");

  return `
    <aside class="sidebar">
      <div class="sidebar__marca">
        <span class="sidebar__cruz" aria-hidden="true">✝</span>
        <span class="sidebar__nome">Ordo</span>
      </div>
      <p class="sidebar__lema">Ordem para a vida, a igreja e os estudos.</p>

      <nav class="sidebar__nav" aria-label="Módulos">${itens}</nav>

      <div class="sidebar__pe">
        <div class="sidebar__usuario">
          <div class="sidebar__usuario-nome">${esc(usuario?.nome || "—")}</div>
          <div class="sidebar__usuario-email">${esc(usuario?.email || "")}</div>
        </div>
        <button type="button" class="sidebar__acao" data-tema
                aria-label="Alternar tema">
          ${icone(temaAtual() === "dark" ? "sun" : "moon")}
        </button>
        <button type="button" class="sidebar__acao" data-sair aria-label="Sair">
          ${icone("log-out")}
        </button>
      </div>
    </aside>`;
}

function htmlTopbar({ titulo, subtitulo, acoes }) {
  return `
    <div class="faixa-liturgica" data-faixa></div>
    <header class="topbar">
      <button type="button" class="topbar__menu" data-menu aria-label="Abrir menu">
        ${icone("menu")}
      </button>
      <div class="crescer">
        <h1 class="topbar__titulo">${esc(titulo)}</h1>
        <div class="topbar__sub" data-subtitulo>${subtitulo || ""}</div>
      </div>
      <div class="topbar__acoes">
        <button type="button" class="busca-atalho" data-busca>
          ${icone("search")}
          <span class="busca-atalho__texto">Buscar</span>
          <span class="busca-atalho__tecla">Ctrl K</span>
        </button>
        <button type="button" class="btn btn--contorno btn--icone" data-sino
                aria-label="Notificações de lembretes" title="Notificações">
          ${icone("bell")}
        </button>
        ${acoes || ""}
      </div>
    </header>`;
}

function htmlAbas(modulo, subAtiva) {
  const abas = ABAS[modulo];
  if (!abas) return "";
  const itens = abas
    .map(
      (aba) => `
      <a class="chip" href="${aba.url}"
         aria-pressed="${aba.chave === subAtiva ? "true" : "false"}">
        ${esc(aba.rotulo)}
      </a>`
    )
    .join("");
  return `<nav class="linha" style="flex-wrap:wrap;margin-bottom:20px"
               aria-label="Telas do módulo">${itens}</nav>`;
}

/** Aplica a cor do tempo litúrgico na faixa e no marcador da topbar. */
function pintarLiturgia(liturgia) {
  if (!liturgia) return;
  const faixa = document.querySelector("[data-faixa]");
  if (faixa) {
    faixa.style.background = liturgia.cor_hex;
    faixa.setAttribute(
      "title",
      `${liturgia.tempo} — cor ${liturgia.cor}${
        liturgia.celebracao ? ` · ${liturgia.celebracao}` : ""
      }`
    );
  }
}

function subtituloPadrao(liturgia) {
  const partes = [
    `<span>${esc(fmt.dataLonga(new Date()))}</span>`,
    "<span>·</span>",
    `<span class="liturgia-ponto" style="background:${esc(
      liturgia?.cor_hex || "#7A7568"
    )}"></span>`,
    `<span>${esc(liturgia?.tempo || "—")}</span>`,
  ];
  if (liturgia?.celebracao) {
    partes.push("<span>·</span>", `<strong>${esc(liturgia.celebracao)}</strong>`);
  }
  return partes.join(" ");
}

/**
 * Monta a casca e devolve os pontos de apoio da página.
 *
 * @param {object} opcoes
 * @param {string} opcoes.pagina     chave do item de menu ativo
 * @param {string} opcoes.sub        aba ativa, nos módulos Igreja e Estudos
 * @param {string} opcoes.titulo     título da topbar
 * @param {string} opcoes.subtitulo  HTML; sem isso, mostra data e tempo litúrgico
 * @param {string} opcoes.acoes      HTML dos botões à direita da topbar
 */
export async function montar({ pagina, sub, titulo, subtitulo, acoes }) {
  iniciarTema();

  // O 401 do /api/me já leva ao login pelo api.js.
  const [usuario, liturgia] = await Promise.all([
    api.get("/me"),
    api.get("/liturgia/hoje").catch(() => null),
  ]);
  contexto.usuario = usuario;
  contexto.liturgia = liturgia;

  document.title = `${titulo} · Ordo`;

  const app = document.createElement("div");
  app.className = "app";
  app.innerHTML = `
    ${htmlSidebar(pagina, usuario)}
    <div class="principal">
      ${htmlTopbar({ titulo, subtitulo: subtitulo ?? subtituloPadrao(liturgia), acoes })}
      <main class="conteudo">${htmlAbas(pagina, sub)}<div data-pagina></div></main>
    </div>`;

  document.body.innerHTML = "";
  document.body.appendChild(app);

  ligarEventos(app);
  pintarLiturgia(liturgia);
  renderizarIcones();

  // O polling de lembretes roda em toda página, não só na agenda.
  iniciarLembretes();

  // Ctrl+K em qualquer tela.
  iniciarBusca();

  return {
    conteudo: app.querySelector("[data-pagina]"),
    topbar: app.querySelector(".topbar"),
    usuario,
    liturgia,
  };
}

function ligarEventos(app) {
  app.querySelector("[data-menu]")?.addEventListener("click", () => {
    const aberto = app.dataset.menu === "aberto";
    app.dataset.menu = aberto ? "fechado" : "aberto";
  });

  app.querySelector("[data-tema]")?.addEventListener("click", (e) => {
    const tema = alternarTema();
    e.currentTarget.innerHTML = icone(tema === "dark" ? "sun" : "moon");
    renderizarIcones();
  });

  app.querySelector("[data-sair]")?.addEventListener("click", async () => {
    try {
      await api.post("/logout");
    } finally {
      location.href = "/login.html";
    }
  });

  const sino = app.querySelector("[data-sino]");
  if (sino) {
    const pintarSino = () => {
      const ativo = estadoPermissao() === "granted";
      sino.innerHTML = icone(ativo ? "bell" : "bell-off");
      sino.title = ativo
        ? "Notificações ativas"
        : "Ativar notificações de lembretes";
      renderizarIcones();
    };
    pintarSino();
    sino.addEventListener("click", async () => {
      await pedirPermissao();
      pintarSino();
    });
  }

  app.querySelector("[data-busca]")?.addEventListener("click", abrirBusca);
}

/** Troca o título da topbar depois da montagem.

    Útil quando o título depende de dados que só existem após montar(),
    como o nome do usuário na saudação do dashboard. */
export function definirTitulo(texto) {
  const alvo = document.querySelector(".topbar__titulo");
  if (alvo) alvo.textContent = texto;
  document.title = `${texto} · Ordo`;
}

/** Troca o subtítulo da topbar depois da montagem. */
export function definirSubtitulo(html) {
  const alvo = document.querySelector("[data-subtitulo]");
  if (alvo) alvo.innerHTML = html;
}
