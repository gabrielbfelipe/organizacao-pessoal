/* ════════════════════════════════════════════════════════════════════
   Ordo — Escala de cerimoniário

   Primeira tela CRUD completa do projeto, e o molde das demais:
   navegação por mês, contadores, tabela, modal de edição e um cadastro
   em lote para a escala do mês inteiro.
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

const BADGE = {
  pendente: "badge--ouro",
  confirmada: "badge--sucesso",
  troca_solicitada: "badge--perigo",
};

const ROTULO_STATUS = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  troca_solicitada: "Troca solicitada",
};

const estado = {
  mes: fmt.mesAtualISO(),
  escalas: [],
  resumo: null,
  constantes: null,
  conteudo: null,
};

/* ─────────────────────────── apoio ─────────────────────────── */

function nomeDoMes(mes) {
  const [ano, m] = mes.split("-").map(Number);
  return fmt.capitalizar(
    new Date(ano, m - 1, 1).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    })
  );
}

function deslocarMes(mes, passos) {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(ano, m - 1 + passos, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Todos os domingos do mês, em AAAA-MM-DD. Usado no cadastro em lote. */
function domingosDoMes(mes) {
  const [ano, m] = mes.split("-").map(Number);
  const domingos = [];
  const d = new Date(ano, m - 1, 1);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  while (d.getMonth() === m - 1) {
    domingos.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`
    );
    d.setDate(d.getDate() + 7);
  }
  return domingos;
}

function opcoesFuncao(selecionada) {
  const lista = estado.constantes?.funcoes_cerimoniario || [];
  return [
    `<option value="">— sem função —</option>`,
    ...lista.map(
      (f) =>
        `<option value="${esc(f)}" ${f === selecionada ? "selected" : ""}>${esc(
          f
        )}</option>`
    ),
  ].join("");
}

/* ─────────────────────────── render ─────────────────────────── */

function htmlContadores() {
  const r = estado.resumo || {};
  const blocos = [
    ["Total no mês", r.total ?? 0],
    ["Confirmadas", r.confirmada ?? 0],
    ["Pendentes", r.pendente ?? 0],
    ["Trocas pedidas", r.troca_solicitada ?? 0],
  ];
  return `<div class="contadores">
    ${blocos
      .map(
        ([rotulo, valor]) => `
      <div class="card contador">
        <div class="contador__valor">${valor}</div>
        <div class="contador__rotulo">${esc(rotulo)}</div>
      </div>`
      )
      .join("")}
  </div>`;
}

function htmlLinha(escala) {
  const passada = new Date(escala.inicio) < new Date();
  const data = fmt.paraData(escala.data);

  return `
    <tr data-id="${escala.id}" data-status="${esc(escala.status)}"
        data-passada="${passada ? "sim" : "nao"}">
      <td class="col-data">
        <strong>${esc(fmt.data(escala.data))}</strong>
        <div class="texto-muted" style="font-size:.78rem">
          ${esc(
            fmt.capitalizar(data.toLocaleDateString("pt-BR", { weekday: "long" }))
          )} · ${esc(fmt.hora(escala.horario))}
        </div>
      </td>
      <td>
        <div>${esc(escala.celebracao)}</div>
        ${
          escala.observacoes
            ? `<div class="obs">${icone("message-square")}<span>${esc(
                escala.observacoes
              )}</span></div>`
            : ""
        }
      </td>
      <td>${escala.funcao ? esc(escala.funcao) : '<span class="texto-muted">—</span>'}</td>
      <td>${escala.local ? esc(escala.local) : '<span class="texto-muted">—</span>'}</td>
      <td>
        <span class="badge ${BADGE[escala.status] || ""}">
          <span class="badge__ponto"></span>${esc(ROTULO_STATUS[escala.status] || escala.status)}
        </span>
      </td>
      <td class="col-acoes">
        ${
          escala.status !== "confirmada"
            ? `<button class="btn btn--fantasma btn--icone" data-acao="confirmar"
                       title="Confirmar">${icone("check")}</button>`
            : ""
        }
        ${
          escala.status !== "troca_solicitada"
            ? `<button class="btn btn--fantasma btn--icone" data-acao="troca"
                       title="Pedir troca">${icone("repeat")}</button>`
            : ""
        }
        <button class="btn btn--fantasma btn--icone" data-acao="editar"
                title="Editar">${icone("pencil")}</button>
        <button class="btn btn--fantasma btn--icone" data-acao="excluir"
                title="Excluir">${icone("trash-2")}</button>
      </td>
    </tr>`;
}

function htmlTabela() {
  if (!estado.escalas.length) {
    return `<div class="card">
      ${vazio({
        icone: "church",
        titulo: "Nenhuma escala neste mês",
        texto: "Cadastre uma escala avulsa ou use o cadastro em lote para o mês inteiro.",
      })}
    </div>`;
  }

  return `
    <div class="tabela-envolve">
      <table class="tabela">
        <thead>
          <tr>
            <th>Data</th>
            <th>Celebração</th>
            <th>Função</th>
            <th>Local</th>
            <th>Status</th>
            <th class="col-acoes">Ações</th>
          </tr>
        </thead>
        <tbody>${estado.escalas.map(htmlLinha).join("")}</tbody>
      </table>
    </div>`;
}

function render() {
  estado.conteudo.innerHTML = `
    <div class="linha-espalhada" style="margin-bottom:18px;flex-wrap:wrap">
      <div class="mes-nav">
        <button class="btn btn--contorno btn--icone" data-mes="-1"
                aria-label="Mês anterior">${icone("chevron-left")}</button>
        <span class="mes-nav__rotulo">${esc(nomeDoMes(estado.mes))}</span>
        <button class="btn btn--contorno btn--icone" data-mes="1"
                aria-label="Mês seguinte">${icone("chevron-right")}</button>
        <button class="btn btn--fantasma btn--pequeno" data-mes="hoje">Hoje</button>
      </div>
      <div class="linha">
        <button class="btn btn--contorno" data-novo-lote>
          ${icone("list-plus")} Cadastro em lote
        </button>
        <button class="btn btn--ouro" data-nova>
          ${icone("plus")} Nova escala
        </button>
      </div>
    </div>
    ${htmlContadores()}
    ${htmlTabela()}`;

  renderizarIcones();
  ligar();
}

/* ─────────────────────────── dados ─────────────────────────── */

async function carregar() {
  estado.conteudo.innerHTML = `<div class="carregando">
    <span class="girando"></span>Carregando escalas...</div>`;
  try {
    const [lista, resumo] = await Promise.all([
      api.get("/igreja/escalas", { mes: estado.mes }),
      api.get("/igreja/escalas/resumo", { mes: estado.mes }),
    ]);
    estado.escalas = lista.itens;
    estado.resumo = resumo;
    render();
  } catch (e) {
    falha(e);
  }
}

/* ─────────────────────────── formulários ─────────────────────────── */

function camposEscala(escala = {}) {
  return `
    <div class="grade-campos">
      <div class="campo">
        <label class="campo__rotulo campo__rotulo--obrigatorio" for="data">Data</label>
        <input class="input" type="date" id="data" name="data"
               value="${esc(escala.data || "")}" required />
      </div>
      <div class="campo">
        <label class="campo__rotulo campo__rotulo--obrigatorio" for="horario">Horário</label>
        <input class="input" type="time" id="horario" name="horario"
               value="${esc(escala.horario ? escala.horario.slice(0, 5) : "")}" required />
      </div>
    </div>

    <div class="campo">
      <label class="campo__rotulo campo__rotulo--obrigatorio" for="celebracao">Celebração</label>
      <input class="input" type="text" id="celebracao" name="celebracao"
             placeholder="Missa Dominical, Solenidade de Cristo Rei..."
             value="${esc(escala.celebracao || "")}" required />
    </div>

    <div class="grade-campos">
      <div class="campo">
        <label class="campo__rotulo" for="funcao">Função</label>
        <select class="select" id="funcao" name="funcao">${opcoesFuncao(escala.funcao)}</select>
      </div>
      <div class="campo">
        <label class="campo__rotulo" for="local">Local</label>
        <input class="input" type="text" id="local" name="local"
               value="${esc(escala.local || "")}" />
      </div>
    </div>

    <div class="campo">
      <label class="campo__rotulo" for="status">Status</label>
      <select class="select" id="status" name="status">
        ${Object.entries(ROTULO_STATUS)
          .map(
            ([valor, rotulo]) =>
              `<option value="${valor}" ${
                (escala.status || "pendente") === valor ? "selected" : ""
              }>${esc(rotulo)}</option>`
          )
          .join("")}
      </select>
    </div>

    <div class="campo">
      <label class="campo__rotulo" for="observacoes">Observações</label>
      <textarea class="textarea" id="observacoes" name="observacoes"
                placeholder="O que levar, com quem confirmar, detalhes da celebração...">${esc(
                  escala.observacoes || ""
                )}</textarea>
    </div>`;
}

async function abrirFormulario(escala) {
  const editando = Boolean(escala);

  await modal({
    titulo: editando ? "Editar escala" : "Nova escala",
    corpo: camposEscala(escala || { data: `${estado.mes}-01` }),
    confirmar: editando ? "Salvar" : "Cadastrar",
    aoConfirmar: async (form) => {
      const dados = lerForm(form);
      try {
        if (editando) {
          await api.put(`/igreja/escalas/${escala.id}`, dados);
          sucesso("Escala atualizada.");
        } else {
          await api.post("/igreja/escalas", dados);
          sucesso("Escala cadastrada.");
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

/* ─────────────────────────── cadastro em lote ─────────────────────────── */

function htmlLinhaLote(data = "") {
  return `
    <div class="lote-linha" data-linha>
      <input class="input" type="date" name="data" value="${esc(data)}" />
      <input class="input" type="time" name="horario" value="10:00" />
      <input class="input" type="text" name="celebracao" placeholder="Celebração" />
      <select class="select" name="funcao">${opcoesFuncao()}</select>
      <button type="button" class="btn btn--fantasma btn--icone" data-remover
              aria-label="Remover linha">${icone("x")}</button>
    </div>`;
}

async function abrirLote() {
  await modal({
    titulo: `Cadastro em lote — ${nomeDoMes(estado.mes)}`,
    largo: true,
    confirmar: "Cadastrar tudo",
    corpo: `
      <p class="texto-muted" style="margin:0">
        Preencha as linhas e cadastre a escala do mês de uma vez. Se qualquer
        linha estiver incompleta, nada é gravado.
      </p>

      <div class="linha" style="flex-wrap:wrap">
        <button type="button" class="btn btn--contorno btn--pequeno" data-domingos>
          ${icone("calendar-plus")} Preencher os domingos do mês
        </button>
        <button type="button" class="btn btn--contorno btn--pequeno" data-adicionar>
          ${icone("plus")} Adicionar linha
        </button>
        <span class="texto-muted" style="font-size:.8rem" data-contagem></span>
      </div>

      <div class="campo">
        <label class="campo__rotulo" for="local-lote">
          Local, aplicado a todas as linhas
        </label>
        <input class="input" type="text" id="local-lote" name="local_comum"
               placeholder="Igreja Matriz" />
      </div>

      <div class="lote-linha lote-cabecalho">
        <span>Data</span><span>Horário</span><span>Celebração</span>
        <span>Função</span><span></span>
      </div>
      <div class="lote-linhas" data-linhas></div>`,

    aoMontar: (form) => {
      const caixa = form.querySelector("[data-linhas]");
      const contagem = form.querySelector("[data-contagem]");

      const atualizarContagem = () => {
        const n = caixa.querySelectorAll("[data-linha]").length;
        contagem.textContent = n ? `${n} linha${n > 1 ? "s" : ""}` : "";
      };

      const adicionar = (data) => {
        caixa.insertAdjacentHTML("beforeend", htmlLinhaLote(data));
        renderizarIcones();
        atualizarContagem();
      };

      form.querySelector("[data-adicionar]").addEventListener("click", () => adicionar());

      form.querySelector("[data-domingos]").addEventListener("click", () => {
        caixa.innerHTML = "";
        for (const domingo of domingosDoMes(estado.mes)) adicionar(domingo);
        caixa.querySelectorAll('[name="celebracao"]').forEach((campo) => {
          campo.value = "Missa Dominical";
        });
      });

      caixa.addEventListener("click", (e) => {
        const botao = e.target.closest("[data-remover]");
        if (!botao) return;
        botao.closest("[data-linha]").remove();
        atualizarContagem();
      });

      adicionar();
    },

    aoConfirmar: async (form) => {
      const local = form.querySelector('[name="local_comum"]').value.trim();
      const escalas = [];

      for (const linha of form.querySelectorAll("[data-linha]")) {
        const valor = (nome) => linha.querySelector(`[name="${nome}"]`).value.trim();
        // Linhas totalmente vazias são ignoradas em silêncio.
        if (!valor("data") && !valor("celebracao")) continue;
        escalas.push({
          data: valor("data") || null,
          horario: valor("horario") || null,
          celebracao: valor("celebracao") || null,
          funcao: valor("funcao") || null,
          local: local || null,
        });
      }

      if (!escalas.length) {
        falha({ message: "Preencha ao menos uma linha." });
        return false;
      }

      try {
        const resultado = await api.post("/igreja/escalas/lote", { escalas });
        sucesso(
          `${resultado.criadas} escala${resultado.criadas > 1 ? "s" : ""} cadastrada${
            resultado.criadas > 1 ? "s" : ""
          }.`
        );
        await carregar();
        return true;
      } catch (e) {
        const campos = falha(e);
        // Os erros vêm como "escalas[2].data": destaca a linha correspondente.
        const linhas = [...form.querySelectorAll("[data-linha]")];
        linhas.forEach((l) => (l.style.outline = ""));
        for (const chave of Object.keys(campos)) {
          const indice = Number(chave.match(/\[(\d+)\]/)?.[1]);
          if (!Number.isNaN(indice) && linhas[indice]) {
            linhas[indice].style.outline = "2px solid var(--danger)";
            linhas[indice].style.outlineOffset = "2px";
          }
        }
        return false;
      }
    },
  });
}

/* ─────────────────────────── eventos ─────────────────────────── */

function ligar() {
  estado.conteudo.querySelectorAll("[data-mes]").forEach((botao) =>
    botao.addEventListener("click", () => {
      const valor = botao.dataset.mes;
      estado.mes =
        valor === "hoje" ? fmt.mesAtualISO() : deslocarMes(estado.mes, Number(valor));
      carregar();
    })
  );

  estado.conteudo
    .querySelector("[data-nova]")
    .addEventListener("click", () => abrirFormulario(null));
  estado.conteudo
    .querySelector("[data-novo-lote]")
    .addEventListener("click", abrirLote);

  const tabela = estado.conteudo.querySelector("tbody");
  if (!tabela) return;

  tabela.addEventListener("click", async (e) => {
    const botao = e.target.closest("[data-acao]");
    if (!botao) return;

    const id = Number(botao.closest("tr").dataset.id);
    const escala = estado.escalas.find((x) => x.id === id);
    if (!escala) return;

    try {
      switch (botao.dataset.acao) {
        case "confirmar":
          await api.patch(`/igreja/escalas/${id}/status`, { status: "confirmada" });
          sucesso("Escala confirmada.");
          return carregar();

        case "troca":
          await api.patch(`/igreja/escalas/${id}/status`, {
            status: "troca_solicitada",
          });
          sucesso("Troca solicitada.");
          return carregar();

        case "editar":
          return abrirFormulario(escala);

        case "excluir": {
          const certo = await confirmar(
            `Excluir a escala de ${fmt.data(escala.data)} — ${escala.celebracao}?`
          );
          if (!certo) return;
          await api.del(`/igreja/escalas/${id}`);
          sucesso("Escala excluída.");
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
      pagina: "igreja",
      sub: "escalas",
      titulo: "Escala de cerimoniário",
    });
    estado.conteudo = conteudo;

    estado.constantes = await api.get("/constantes");
    await carregar();
  } catch (e) {
    if (e?.status === 401) return;
    falha(e);
  }
}

iniciar();
