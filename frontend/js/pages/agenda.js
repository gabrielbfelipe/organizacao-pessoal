/* ════════════════════════════════════════════════════════════════════
   Ordo — Agenda

   Calendário unificado: compromissos (já expandidos em ocorrências pelo
   servidor), escalas de cerimoniário e eventos da paróquia.

   O ponto delicado é a recorrência. Ao mexer numa ocorrência de uma
   série, o usuário escolhe entre alterar aquele dia — que vira uma
   exceção — ou a série inteira.
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

const TIPOS = [
  { chave: "compromisso", rotulo: "Compromissos", cor: "#4A6FA5" },
  { chave: "escala", rotulo: "Escalas", cor: "#B8963E" },
  { chave: "evento", rotulo: "Eventos da igreja", cor: "#6B3FA0" },
];

const estado = {
  calendario: null,
  categorias: [],
  constantes: null,
  tipos: new Set(TIPOS.map((t) => t.chave)),
  categoriaId: "",
  conteudo: null,
};

/* ─────────────────────────── formulário ─────────────────────────── */

function opcoesCategoria(selecionada) {
  return [
    `<option value="">— sem categoria —</option>`,
    ...estado.categorias.map(
      (c) =>
        `<option value="${c.id}" ${
          String(c.id) === String(selecionada) ? "selected" : ""
        }>${esc(c.nome)}</option>`
    ),
  ].join("");
}

function opcoesAntecedencia(selecionada) {
  const lista = estado.constantes?.antecedencias || [];
  return [
    `<option value="">— sem lembrete —</option>`,
    ...lista.map(
      (a) =>
        `<option value="${a.minutos}" ${
          String(a.minutos) === String(selecionada) ? "selected" : ""
        }>${esc(a.rotulo)}</option>`
    ),
  ].join("");
}

function camposCompromisso(c = {}) {
  const recorrencias = [
    ["nenhuma", "Não se repete"],
    ["diaria", "Todo dia"],
    ["semanal", "Toda semana"],
    ["mensal", "Todo mês"],
  ];

  return `
    <div class="campo">
      <label class="campo__rotulo campo__rotulo--obrigatorio" for="titulo">Título</label>
      <input class="input" type="text" id="titulo" name="titulo"
             value="${esc(c.titulo || "")}" required />
    </div>

    <div class="grade-campos">
      <div class="campo">
        <label class="campo__rotulo campo__rotulo--obrigatorio" for="inicio">Início</label>
        <input class="input" type="datetime-local" id="inicio" name="inicio"
               value="${esc(fmt.paraInputDataHora(c.inicio))}" required />
      </div>
      <div class="campo">
        <label class="campo__rotulo" for="fim">Fim</label>
        <input class="input" type="datetime-local" id="fim" name="fim"
               value="${esc(fmt.paraInputDataHora(c.fim))}" />
      </div>
    </div>

    <div class="grade-campos">
      <div class="campo">
        <label class="campo__rotulo" for="categoria_id">Categoria</label>
        <select class="select" id="categoria_id" name="categoria_id">
          ${opcoesCategoria(c.categoria_id)}
        </select>
      </div>
      <div class="campo">
        <label class="campo__rotulo" for="local">Local</label>
        <input class="input" type="text" id="local" name="local"
               value="${esc(c.local || "")}" />
      </div>
    </div>

    <div class="grade-campos">
      <div class="campo">
        <label class="campo__rotulo" for="recorrencia">Repetição</label>
        <select class="select" id="recorrencia" name="recorrencia">
          ${recorrencias
            .map(
              ([valor, rotulo]) =>
                `<option value="${valor}" ${
                  (c.recorrencia || "nenhuma") === valor ? "selected" : ""
                }>${esc(rotulo)}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="campo" data-campo-fim-recorrencia>
        <label class="campo__rotulo" for="recorrencia_fim">Repetir até</label>
        <input class="input" type="date" id="recorrencia_fim" name="recorrencia_fim"
               value="${esc(c.recorrencia_fim || "")}" />
      </div>
    </div>

    <div class="campo">
      <label class="campo__rotulo" for="lembrete_min">Lembrete</label>
      <select class="select" id="lembrete_min" name="lembrete_min">
        ${opcoesAntecedencia(c.lembrete_min)}
      </select>
    </div>

    <div class="campo">
      <label class="campo__rotulo" for="descricao">Descrição</label>
      <textarea class="textarea" id="descricao" name="descricao">${esc(
        c.descricao || ""
      )}</textarea>
    </div>

    <label class="checkbox">
      <input type="checkbox" name="dia_inteiro" ${c.dia_inteiro ? "checked" : ""} />
      <span>O dia inteiro</span>
    </label>`;
}

/** Esconde "Repetir até" quando não há repetição. */
function ligarRecorrencia(form) {
  const seletor = form.querySelector('[name="recorrencia"]');
  const campoFim = form.querySelector("[data-campo-fim-recorrencia]");
  const aplicar = () => {
    campoFim.style.display = seletor.value === "nenhuma" ? "none" : "";
  };
  seletor.addEventListener("change", aplicar);
  aplicar();
}

async function abrirFormulario(compromisso, inicioSugerido) {
  const editando = Boolean(compromisso);
  const base = compromisso || (inicioSugerido ? { inicio: inicioSugerido } : {});

  await modal({
    titulo: editando ? "Editar compromisso" : "Novo compromisso",
    corpo: camposCompromisso(base),
    confirmar: editando ? "Salvar" : "Criar",
    aoMontar: ligarRecorrencia,
    aoConfirmar: async (form) => {
      const dados = lerForm(form);
      try {
        if (editando) {
          await api.put(`/compromissos/${compromisso.id}`, dados);
          sucesso("Compromisso atualizado.");
        } else {
          await api.post("/compromissos", dados);
          sucesso("Compromisso criado.");
        }
        estado.calendario.refetchEvents();
        return true;
      } catch (e) {
        marcarErros(form, falha(e));
        return false;
      }
    },
  });
}

/* ─────────────────────────── detalhe ─────────────────────────── */

function linhaDetalhe(nomeIcone, rotulo, valor) {
  if (!valor) return "";
  return `<div class="detalhe__linha">
    ${icone(nomeIcone)}
    <span class="detalhe__rotulo">${esc(rotulo)}</span>
    <span class="crescer">${esc(valor)}</span>
  </div>`;
}

async function abrirDetalhe(evento) {
  const p = evento.extendedProps;
  const inicio = evento.start;
  const fim = evento.end;

  const quando = fim
    ? `${fmt.dataHora(inicio)} até ${fmt.hora(fim)}`
    : fmt.dataHora(inicio);

  const corpo = `
    <div>
      ${linhaDetalhe("clock", "Quando", quando)}
      ${linhaDetalhe("map-pin", "Local", p.local)}
      ${linhaDetalhe("tag", "Categoria", p.categoria)}
      ${linhaDetalhe("hand", "Função", p.funcao)}
      ${linhaDetalhe("circle-dot", "Status", p.status && fmt.rotulo(p.status))}
      ${linhaDetalhe("repeat", "Repetição", p.recorrente ? "Parte de uma série" : "")}
      ${linhaDetalhe("move", "Observação", p.remarcada ? "Esta ocorrência foi remarcada" : "")}
      ${linhaDetalhe("align-left", "Detalhes", p.descricao)}
    </div>`;

  // Escalas e eventos da igreja são editados nos seus próprios módulos.
  if (p.tipo !== "compromisso") {
    const destino =
      p.tipo === "escala"
        ? "/pages/igreja-escalas.html"
        : "/pages/igreja-eventos.html";
    await modal({
      titulo: evento.title,
      corpo,
      confirmar: "Abrir no módulo Igreja",
      cancelar: "Fechar",
      aoConfirmar: () => {
        location.href = destino;
        return true;
      },
    });
    return;
  }

  const escolha = await modal({
    titulo: evento.title,
    corpo:
      corpo +
      `<div class="linha" style="flex-wrap:wrap;gap:8px;margin-top:6px">
         <button type="button" class="btn btn--contorno btn--pequeno" data-acao="editar">
           ${icone("pencil")} Editar a série
         </button>
         ${
           p.recorrente
             ? `<button type="button" class="btn btn--contorno btn--pequeno" data-acao="cancelar-dia">
                  ${icone("calendar-x")} Cancelar só este dia
                </button>`
             : ""
         }
         ${
           p.remarcada
             ? `<button type="button" class="btn btn--contorno btn--pequeno" data-acao="restaurar">
                  ${icone("undo-2")} Voltar à data original
                </button>`
             : ""
         }
         <button type="button" class="btn btn--perigo btn--pequeno" data-acao="excluir">
           ${icone("trash-2")} Excluir a série
         </button>
       </div>`,
    confirmar: "Fechar",
    cancelar: null,
    aoMontar: (form, fechar) => {
      // As ações ficam no corpo do modal; cada uma fecha resolvendo o
      // seu próprio nome, que executarAcao() interpreta.
      form.querySelectorAll("[data-acao]").forEach((botao) =>
        botao.addEventListener("click", () => fechar(botao.dataset.acao))
      );
    },
    aoConfirmar: () => "fechar",
  });

  await executarAcao(escolha, p);
}

async function executarAcao(escolha, p) {
  try {
    switch (escolha) {
      case "editar": {
        const compromisso = await api.get(`/compromissos/${p.registro_id}`);
        return abrirFormulario(compromisso);
      }

      case "cancelar-dia": {
        const certo = await confirmar(
          `Cancelar a ocorrência de ${fmt.data(p.data_original)}? A série continua.`,
          { confirmar: "Cancelar este dia" }
        );
        if (!certo) return;
        await api.del(
          `/compromissos/${p.registro_id}/ocorrencia?data=${p.data_original}`
        );
        sucesso("Ocorrência cancelada.");
        return estado.calendario.refetchEvents();
      }

      case "restaurar": {
        await api.del(
          `/compromissos/${p.registro_id}/ocorrencia/restaurar?data=${p.data_original}`
        );
        sucesso("Ocorrência de volta à data original.");
        return estado.calendario.refetchEvents();
      }

      case "excluir": {
        const certo = await confirmar(
          "Excluir a série inteira, com todas as ocorrências?",
          { confirmar: "Excluir tudo" }
        );
        if (!certo) return;
        await api.del(`/compromissos/${p.registro_id}`);
        sucesso("Compromisso excluído.");
        return estado.calendario.refetchEvents();
      }
    }
  } catch (e) {
    falha(e);
  }
}

/* ─────────────────────── arrastar e soltar ─────────────────────── */

async function aoMover(info) {
  const p = info.event.extendedProps;

  if (p.tipo !== "compromisso") {
    info.revert();
    return falha({
      message: "Escalas e eventos da igreja são movidos no módulo Igreja.",
    });
  }

  const corpo = {
    inicio: fmt.paraInputDataHora(info.event.start),
    fim: info.event.end ? fmt.paraInputDataHora(info.event.end) : null,
  };

  try {
    if (p.recorrente) {
      // Mover uma ocorrência de uma série cria uma exceção só para aquele dia.
      await api.put(
        `/compromissos/${p.registro_id}/ocorrencia?data=${p.data_original}`,
        corpo
      );
      sucesso("Ocorrência remarcada. A série continua igual.");
    } else {
      const atual = await api.get(`/compromissos/${p.registro_id}`);
      await api.put(`/compromissos/${p.registro_id}`, { ...atual, ...corpo });
      sucesso("Compromisso movido.");
    }
    estado.calendario.refetchEvents();
  } catch (e) {
    info.revert();
    falha(e);
  }
}

/* ─────────────────────────── filtros ─────────────────────────── */

function htmlFiltros() {
  return `
    <div class="filtros">
      <span class="filtros__rotulo">Mostrar</span>
      ${TIPOS.map(
        (t) => `
        <button class="chip" data-tipo="${t.chave}"
                aria-pressed="${estado.tipos.has(t.chave)}">
          <span class="chip__cor" style="background:${t.cor}"></span>${esc(t.rotulo)}
        </button>`
      ).join("")}

      <span class="crescer"></span>

      <select class="select" data-categoria aria-label="Filtrar por categoria"
              style="width:auto;min-width:180px">
        <option value="">Todas as categorias</option>
        ${estado.categorias
          .map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`)
          .join("")}
      </select>
    </div>`;
}

function ligarFiltros() {
  estado.conteudo.querySelectorAll("[data-tipo]").forEach((chip) =>
    chip.addEventListener("click", () => {
      const tipo = chip.dataset.tipo;
      if (estado.tipos.has(tipo)) {
        // Desligar o último filtro deixaria o calendário vazio sem motivo.
        if (estado.tipos.size === 1) return;
        estado.tipos.delete(tipo);
      } else {
        estado.tipos.add(tipo);
      }
      chip.setAttribute("aria-pressed", estado.tipos.has(tipo));
      estado.calendario.refetchEvents();
    })
  );

  estado.conteudo
    .querySelector("[data-categoria]")
    .addEventListener("change", (e) => {
      estado.categoriaId = e.target.value;
      estado.calendario.refetchEvents();
    });
}

/* ─────────────────────────── calendário ─────────────────────────── */

function criarCalendario(elemento) {
  return new FullCalendar.Calendar(elemento, {
    locale: "pt-br",
    initialView: "dayGridMonth",
    height: "auto",
    firstDay: 0,
    nowIndicator: true,
    editable: true,
    eventStartEditable: true,
    eventDurationEditable: false,
    dayMaxEvents: 4,

    // Blocos preenchidos em vez do ponto padrão: é assim que a cor da
    // categoria fica visível e o título ganha espaço.
    eventDisplay: "block",
    displayEventTime: true,
    // omitZeroMinute encurta "19:00" para "19", liberando espaço para o
    // título no bloco estreito da visão de mês.
    eventTimeFormat: {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
      omitZeroMinute: true,
    },
    headerToolbar: {
      left: "prev,next hoje",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
    },
    customButtons: {
      hoje: {
        text: "Hoje",
        click: () => estado.calendario.today(),
      },
    },
    buttonText: {
      month: "Mês",
      week: "Semana",
      day: "Dia",
      list: "Lista",
    },
    allDayText: "Dia inteiro",
    noEventsText: "Nada marcado neste período.",

    // O servidor devolve datas ISO locais, sem fuso. Dizer isto ao
    // FullCalendar evita que ele as reinterprete como UTC.
    timeZone: "local",

    events: async (info, aoTerminar, aoFalhar) => {
      try {
        const eventos = await api.get("/agenda/eventos", {
          inicio: info.startStr.slice(0, 10),
          fim: info.endStr.slice(0, 10),
          tipos: [...estado.tipos].join(","),
          categoria_id: estado.categoriaId,
        });
        aoTerminar(eventos);
      } catch (e) {
        falha(e);
        aoFalhar(e);
      }
    },

    eventClassNames: (arg) => (arg.event.extendedProps.remarcada ? ["remarcada"] : []),
    eventClick: (info) => {
      info.jsEvent.preventDefault();
      abrirDetalhe(info.event);
    },
    eventDrop: aoMover,
    dateClick: (info) => {
      // Clicar num dia abre o formulário já com a data preenchida, às 9h.
      const d = new Date(info.date);
      if (info.allDay) d.setHours(9, 0, 0, 0);
      abrirFormulario(null, d);
    },
  });
}

/* ─────────────────────────── início ─────────────────────────── */

async function iniciar() {
  try {
    const { conteudo } = await montar({
      pagina: "agenda",
      titulo: "Agenda",
      acoes: `<button class="btn btn--ouro" data-novo>
                ${icone("plus")} Novo compromisso
              </button>`,
    });
    estado.conteudo = conteudo;

    [estado.categorias, estado.constantes] = await Promise.all([
      api.get("/categorias"),
      api.get("/constantes"),
    ]);

    conteudo.innerHTML = `${htmlFiltros()}<div id="calendario"></div>`;

    estado.calendario = criarCalendario(conteudo.querySelector("#calendario"));
    estado.calendario.render();

    ligarFiltros();
    document
      .querySelector("[data-novo]")
      .addEventListener("click", () => abrirFormulario(null));

    // Um lembrete que dispara pode ser de um compromisso recém-vencido.
    document.addEventListener("ordo:lembretes", () =>
      estado.calendario.refetchEvents()
    );

    renderizarIcones();
  } catch (e) {
    if (e?.status === 401) return;
    falha(e);
  }
}

iniciar();
