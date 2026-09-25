/* ════════════════════════════════════════════════════════════════════
   Ordo — Caderno de erros

   Cada questão errada vira um registro com o motivo do erro e a
   explicação correta. O motivo é o que importa: errar por falta de
   conteúdo pede estudo; errar por desatenção pede outra coisa.
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

const ROTULO_MOTIVO = {
  falta_conteudo: "Falta de conteúdo",
  desatencao: "Desatenção",
  interpretacao: "Interpretação",
  tempo: "Tempo",
};

const estado = {
  erros: [],
  resumo: null,
  disciplinas: [],
  filtros: { disciplina_id: "", motivo: "", revisado: "" },
  conteudo: null,
};

/* ─────────────────────────── render ─────────────────────────── */

function htmlErro(erro) {
  return `
    <article class="card erro ${erro.revisado ? "erro--revisado" : ""}"
             data-id="${erro.id}">
      <div class="erro__questao">${esc(erro.resumo_questao || "Sem resumo")}</div>

      ${
        erro.explicacao
          ? `<p class="erro__explicacao">${esc(erro.explicacao)}</p>`
          : `<p class="erro__explicacao" style="font-style:italic">
               Sem explicação registrada ainda.</p>`
      }

      <div class="erro__rodape">
        ${
          erro.motivo
            ? `<span class="badge">${esc(ROTULO_MOTIVO[erro.motivo] || erro.motivo)}</span>`
            : ""
        }
        ${
          erro.disciplina
            ? `<span class="badge" style="border-color:${esc(erro.disciplina.cor)};
                     color:${esc(erro.disciplina.cor)}">
                 ${esc(erro.disciplina.nome)}
               </span>`
            : ""
        }
        <span class="crescer"></span>
        <button class="btn btn--fantasma btn--icone" data-acao="revisado"
                aria-pressed="${erro.revisado}"
                title="${erro.revisado ? "Marcar como pendente" : "Marcar como revisado"}">
          ${icone(erro.revisado ? "check-check" : "check")}
        </button>
        <button class="btn btn--fantasma btn--icone" data-acao="editar"
                title="Editar">${icone("pencil")}</button>
        <button class="btn btn--fantasma btn--icone" data-acao="excluir"
                title="Excluir">${icone("trash-2")}</button>
      </div>
    </article>`;
}

function htmlResumo() {
  const r = estado.resumo;
  if (!r) return "";

  const blocos = [
    ["Pendentes", r.pendentes],
    ...Object.entries(ROTULO_MOTIVO).map(([chave, rotulo]) => [
      rotulo,
      r.por_motivo[chave] || 0,
    ]),
  ];

  return `
    <div class="contadores-motivo">
      ${blocos
        .map(
          ([rotulo, valor]) => `
        <div class="card" style="padding:13px 15px">
          <div style="font-family:var(--fonte-titulo);font-size:1.7rem;
                      font-weight:600;line-height:1;color:var(--titulo)">${valor}</div>
          <div style="font-size:.73rem;text-transform:uppercase;
                      letter-spacing:.06em;color:var(--muted);margin-top:4px">
            ${esc(rotulo)}
          </div>
        </div>`
        )
        .join("")}
    </div>`;
}

function htmlFiltros() {
  const seletor = (nome, rotulo, opcoes) => `
    <select class="select" data-filtro="${nome}" aria-label="${esc(rotulo)}"
            style="width:auto;min-width:160px">
      <option value="">${esc(rotulo)}</option>
      ${opcoes
        .map(
          ([valor, texto]) =>
            `<option value="${esc(valor)}" ${
              String(estado.filtros[nome]) === String(valor) ? "selected" : ""
            }>${esc(texto)}</option>`
        )
        .join("")}
    </select>`;

  return `
    <div class="linha" style="margin-bottom:18px;flex-wrap:wrap;gap:10px">
      ${seletor(
        "disciplina_id",
        "Todas as disciplinas",
        estado.disciplinas.map((d) => [d.id, d.nome])
      )}
      ${seletor("motivo", "Todos os motivos", Object.entries(ROTULO_MOTIVO))}
      ${seletor("revisado", "Todos", [
        ["0", "Só os pendentes"],
        ["1", "Só os revisados"],
      ])}
    </div>`;
}

function render() {
  const lista = estado.erros.length
    ? `<div class="erros">${estado.erros.map(htmlErro).join("")}</div>`
    : `<div class="card">${vazio({
        icone: "circle-alert",
        titulo: "Caderno vazio",
        texto: "Depois de corrigir um simulado, mande as questões erradas para cá.",
        acao: `<a class="btn btn--ouro btn--pequeno"
                  href="/pages/estudos-simulados.html">Ir aos simulados</a>`,
      })}</div>`;

  estado.conteudo.innerHTML = htmlResumo() + htmlFiltros() + lista;
  renderizarIcones();
  ligar();
}

async function carregar() {
  try {
    const [erros, resumo] = await Promise.all([
      api.get("/erros", estado.filtros),
      api.get("/erros/resumo"),
    ]);
    estado.erros = erros;
    estado.resumo = resumo;
    render();
  } catch (e) {
    falha(e);
  }
}

/* ─────────────────────────── formulário ─────────────────────────── */

async function abrirFormulario(registro) {
  const editando = Boolean(registro);

  await modal({
    titulo: editando ? "Editar registro" : "Novo registro no caderno",
    confirmar: "Salvar",
    corpo: `
      <div class="campo">
        <label class="campo__rotulo campo__rotulo--obrigatorio" for="resumo_questao">
          A questão
        </label>
        <textarea class="textarea" id="resumo_questao" name="resumo_questao"
                  placeholder="O enunciado, ou o suficiente para reconhecê-la."
                  >${esc(registro?.resumo_questao || "")}</textarea>
      </div>

      <div class="grade-campos">
        <div class="campo">
          <label class="campo__rotulo" for="motivo">Por que errei</label>
          <select class="select" id="motivo" name="motivo">
            ${Object.entries(ROTULO_MOTIVO)
              .map(
                ([valor, rotulo]) =>
                  `<option value="${valor}" ${
                    registro?.motivo === valor ? "selected" : ""
                  }>${esc(rotulo)}</option>`
              )
              .join("")}
          </select>
        </div>
        <div class="campo">
          <label class="campo__rotulo" for="disciplina_id">Disciplina</label>
          <select class="select" id="disciplina_id" name="disciplina_id">
            <option value="">— sem disciplina —</option>
            ${estado.disciplinas
              .map(
                (d) =>
                  `<option value="${d.id}" ${
                    registro?.disciplina_id === d.id ? "selected" : ""
                  }>${esc(d.nome)}</option>`
              )
              .join("")}
          </select>
        </div>
      </div>

      <div class="campo">
        <label class="campo__rotulo" for="explicacao">A explicação correta</label>
        <textarea class="textarea" id="explicacao" name="explicacao"
                  style="min-height:130px"
                  placeholder="O raciocínio certo, para quando você revisar."
                  >${esc(registro?.explicacao || "")}</textarea>
      </div>

      <label class="checkbox">
        <input type="checkbox" name="revisado" ${registro?.revisado ? "checked" : ""} />
        <span>Já revisei este erro</span>
      </label>`,

    aoConfirmar: async (form) => {
      try {
        const dados = lerForm(form);
        if (editando) {
          await api.put(`/erros/${registro.id}`, dados);
          sucesso("Registro atualizado.");
        } else {
          await api.post("/erros", dados);
          sucesso("Registro criado.");
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
  estado.conteudo.querySelectorAll("[data-filtro]").forEach((campo) =>
    campo.addEventListener("change", () => {
      estado.filtros[campo.dataset.filtro] = campo.value;
      carregar();
    })
  );

  estado.conteudo.querySelectorAll("[data-acao]").forEach((botao) =>
    botao.addEventListener("click", async () => {
      const id = Number(botao.closest("[data-id]").dataset.id);
      const registro = estado.erros.find((e) => e.id === id);
      if (!registro) return;

      try {
        switch (botao.dataset.acao) {
          case "revisado":
            await api.patch(`/erros/${id}/revisado`);
            return carregar();
          case "editar":
            return abrirFormulario(registro);
          case "excluir": {
            const certo = await confirmar("Excluir este registro do caderno?");
            if (!certo) return;
            await api.del(`/erros/${id}`);
            sucesso("Registro excluído.");
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
      sub: "erros",
      titulo: "Caderno de erros",
      acoes: `<button class="btn btn--ouro" data-novo>
                ${icone("plus")} Novo registro
              </button>`,
    });
    estado.conteudo = conteudo;

    estado.disciplinas = await api.get("/disciplinas");
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
