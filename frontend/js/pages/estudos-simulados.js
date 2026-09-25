/* ════════════════════════════════════════════════════════════════════
   Ordo — Simulados

   Cadastro da prova, lançamento do gabarito e das respostas numa grade
   navegável pelo teclado, e a correção automática com quebra por
   disciplina. Cada questão errada vira um registro no caderno de erros
   com um clique.
   ══════════════════════════════════════════════════════════════════ */

import { api } from "../core/api.js";
import * as fmt from "../core/fmt.js";
import * as graficos from "../core/graficos.js";
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
  simulados: [],
  disciplinas: [],
  evolucao: [],
  desempenho: [],
  instancias: [],
  conteudo: null,
};

/* ─────────────────────────── lista ─────────────────────────── */

function classeNota(pct) {
  if (pct === null || pct === undefined) return "";
  if (pct >= 70) return "simulado__nota--bom";
  if (pct < 50) return "simulado__nota--ruim";
  return "";
}

function htmlSimulado(simulado) {
  return `
    <article class="card simulado" data-id="${simulado.id}">
      <h3 class="simulado__titulo">${esc(simulado.titulo)}</h3>
      <p class="simulado__meta">
        ${esc(fmt.data(simulado.data))}${
          simulado.banca ? ` · ${esc(simulado.banca)}` : ""
        } · ${simulado.total_questoes} questões
      </p>

      <div class="linha-espalhada">
        <div>
          <div class="simulado__nota ${classeNota(simulado.percentual)}">
            ${
              simulado.percentual === null
                ? "—"
                : esc(fmt.porcentagem(simulado.percentual, 1))
            }
          </div>
          <div class="simulado__fracao">
            ${
              simulado.validas
                ? `${simulado.acertos} de ${simulado.validas} válidas`
                : "gabarito não lançado"
            }
          </div>
        </div>
        ${icone("chevron-right", "icone")}
      </div>
    </article>`;
}

/** Os gráficos só aparecem quando há o que mostrar: um ponto sozinho
    não é uma evolução, e disciplina sem questão corrigida não é dado. */
function htmlGraficos() {
  let saida = "";

  if (estado.evolucao.length >= 2) {
    saida += graficos.bloco({
      id: "grafico-evolucao",
      titulo: "Evolução",
      subtitulo: "Percentual de acerto em cada simulado, na ordem das datas",
      colunas: ["Simulado", "Data", "Acertos", "Percentual"],
      linhas: estado.evolucao.map((p) => [
        p.titulo,
        fmt.data(p.data),
        `${p.acertos} de ${p.validas}`,
        p.percentual === null ? "—" : fmt.porcentagem(p.percentual, 1),
      ]),
    });
  }

  if (estado.desempenho.length) {
    saida += graficos.bloco({
      id: "grafico-disciplinas",
      titulo: "Acertos por disciplina",
      subtitulo: "Somando todos os simulados, da pior para a melhor",
      altura: Math.max(200, estado.desempenho.length * 46 + 60),
      colunas: ["Disciplina", "Acertos", "Questões válidas", "Percentual"],
      linhas: estado.desempenho.map((d) => [
        d.nome,
        String(d.acertos),
        String(d.validas),
        fmt.porcentagem(d.percentual, 1),
      ]),
    });
  }

  return saida ? `<div class="graficos">${saida}</div>` : "";
}

function desenharGraficos() {
  estado.instancias.forEach((g) => g.destroy());
  estado.instancias = [];

  const telaEvolucao = document.getElementById("grafico-evolucao");
  if (telaEvolucao) {
    estado.instancias.push(
      graficos.evolucaoSimulados(
        telaEvolucao,
        estado.evolucao.map((p) => ({
          rotulo: fmt.dataCurta(p.data),
          percentual: p.percentual,
        }))
      )
    );
  }

  const telaDisciplinas = document.getElementById("grafico-disciplinas");
  if (telaDisciplinas) {
    estado.instancias.push(
      graficos.acertosPorDisciplina(telaDisciplinas, estado.desempenho)
    );
  }
}

function render() {
  const lista = estado.simulados.length
    ? `<div class="simulados">${estado.simulados.map(htmlSimulado).join("")}</div>`
    : `<div class="card">${vazio({
        icone: "file-text",
        titulo: "Nenhum simulado lançado",
        texto: "Cadastre a prova, lance o gabarito e as suas respostas — a correção é automática.",
      })}</div>`;

  estado.conteudo.innerHTML = htmlGraficos() + lista;
  renderizarIcones();
  desenharGraficos();

  estado.conteudo.querySelectorAll(".simulado").forEach((cartao) =>
    cartao.addEventListener("click", () => abrirResultado(Number(cartao.dataset.id)))
  );
}

async function carregar() {
  try {
    [estado.simulados, estado.disciplinas, estado.evolucao, estado.desempenho] =
      await Promise.all([
        api.get("/simulados"),
        api.get("/disciplinas"),
        api.get("/simulados/evolucao"),
        api.get("/simulados/desempenho"),
      ]);
    render();
  } catch (e) {
    falha(e);
  }
}

/* ─────────────────────── cadastro da prova ─────────────────────── */

async function abrirNovoSimulado() {
  await modal({
    titulo: "Novo simulado",
    confirmar: "Criar e lançar",
    corpo: `
      <div class="campo">
        <label class="campo__rotulo campo__rotulo--obrigatorio" for="titulo">Título</label>
        <input class="input" type="text" id="titulo" name="titulo"
               placeholder="Simulado TRF 1ª Região" required />
      </div>

      <div class="grade-campos">
        <div class="campo">
          <label class="campo__rotulo" for="banca">Banca</label>
          <input class="input" type="text" id="banca" name="banca"
                 placeholder="FGV, Cebraspe, FCC..." />
        </div>
        <div class="campo">
          <label class="campo__rotulo campo__rotulo--obrigatorio" for="data">Data</label>
          <input class="input" type="date" id="data" name="data"
                 value="${fmt.hojeISO()}" required />
        </div>
      </div>

      <div class="campo">
        <label class="campo__rotulo campo__rotulo--obrigatorio" for="total_questoes">
          Número de questões
        </label>
        <input class="input" type="number" id="total_questoes" name="total_questoes"
               min="1" max="500" value="60" required />
        <span class="texto-muted" style="font-size:.78rem">
          As questões são criadas numeradas de 1 até este número.
        </span>
      </div>`,

    aoConfirmar: async (form) => {
      try {
        const simulado = await api.post("/simulados", lerForm(form));
        sucesso("Simulado criado. Agora lance o gabarito.");
        await carregar();
        abrirLancamento(simulado.id, "gabarito");
        return true;
      } catch (e) {
        marcarErros(form, falha(e));
        return false;
      }
    },
  });
}

/* ─────────────────── lançamento em grade ─────────────────── */

function htmlQuestao(questao, campo) {
  const valor = questao[campo] || "";
  return `
    <div class="questao ${questao.anulada ? "questao--anulada" : ""}"
         data-numero="${questao.numero}">
      <span class="questao__numero">${questao.numero}</span>
      <input class="questao__letra" type="text" maxlength="1" value="${esc(valor)}"
             data-campo aria-label="Questão ${questao.numero}" />
      ${
        campo === "gabarito"
          ? `<input type="checkbox" data-anulada ${questao.anulada ? "checked" : ""}
                    title="Anulada" style="width:15px;height:15px;
                    accent-color:var(--danger-texto);cursor:pointer" />`
          : ""
      }
    </div>`;
}

/**
 * Grade de lançamento do gabarito ou das respostas.
 * Digitar uma letra pula sozinho para a questão seguinte.
 */
async function abrirLancamento(id, campo) {
  const simulado = await api.get(`/simulados/${id}`);
  const ehGabarito = campo === "gabarito";

  await modal({
    titulo: ehGabarito ? "Lançar gabarito oficial" : "Lançar suas respostas",
    largo: true,
    confirmar: "Salvar",
    corpo: `
      <p class="texto-muted" style="margin:0">
        Digite a letra de cada questão. O cursor avança sozinho.
        ${ehGabarito ? "Marque a caixa para anular a questão." : ""}
      </p>
      <div class="grade-questoes" data-grade>
        ${simulado.questoes.map((q) => htmlQuestao(q, campo)).join("")}
      </div>`,

    aoMontar: (form) => {
      const campos = [...form.querySelectorAll("[data-campo]")];

      campos.forEach((entrada, indice) => {
        entrada.addEventListener("input", () => {
          entrada.value = entrada.value.toUpperCase().slice(0, 1);
          // Avança só quando há letra: apagar não deve pular.
          if (entrada.value) campos[indice + 1]?.focus();
        });

        entrada.addEventListener("keydown", (e) => {
          if (e.key === "ArrowDown" || e.key === "Enter") {
            e.preventDefault();
            campos[indice + 1]?.focus();
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            campos[indice - 1]?.focus();
          }
          if (e.key === "Backspace" && !entrada.value) {
            campos[indice - 1]?.focus();
          }
        });
      });

      campos[0]?.focus();
    },

    aoConfirmar: async (form) => {
      const questoes = [...form.querySelectorAll("[data-numero]")].map((linha) => {
        const item = {
          numero: Number(linha.dataset.numero),
          [campo]: linha.querySelector("[data-campo]").value.trim() || null,
        };
        const anulada = linha.querySelector("[data-anulada]");
        if (anulada) item.anulada = anulada.checked;
        return item;
      });

      try {
        await api.put(`/simulados/${id}/${ehGabarito ? "gabarito" : "respostas"}`, {
          questoes,
        });
        sucesso(ehGabarito ? "Gabarito lançado." : "Respostas lançadas.");
        await carregar();
        return true;
      } catch (e) {
        falha(e);
        return false;
      }
    },
  });
}

/* ─────────────────── disciplinas por faixa ─────────────────── */

async function abrirDisciplinas(simulado) {
  if (!estado.disciplinas.length) {
    return falha({ message: "Cadastre ao menos uma disciplina primeiro." });
  }

  const opcoes = estado.disciplinas
    .map((d) => `<option value="${d.id}">${esc(d.nome)}</option>`)
    .join("");

  function htmlFaixa() {
    return `
      <div class="linha" data-faixa style="gap:8px">
        <input class="input" type="number" placeholder="de" min="1"
               max="${simulado.total_questoes}" data-de style="width:80px" />
        <input class="input" type="number" placeholder="até" min="1"
               max="${simulado.total_questoes}" data-ate style="width:80px" />
        <select class="select crescer" data-disciplina>${opcoes}</select>
        <button type="button" class="btn btn--fantasma btn--icone" data-remover
                aria-label="Remover faixa">${icone("x")}</button>
      </div>`;
  }

  await modal({
    titulo: "Disciplinas por faixa de questões",
    confirmar: "Aplicar",
    corpo: `
      <p class="texto-muted" style="margin:0">
        Numa prova organizada por blocos, marcar a faixa é mais rápido que
        questão por questão. É isso que dá a quebra por disciplina no resultado.
      </p>
      <div class="pilha" data-faixas>${htmlFaixa()}</div>
      <button type="button" class="btn btn--contorno btn--pequeno" data-add
              style="align-self:flex-start">
        ${icone("plus")} Adicionar faixa
      </button>`,

    aoMontar: (form) => {
      const caixa = form.querySelector("[data-faixas]");
      form.querySelector("[data-add]").addEventListener("click", () => {
        caixa.insertAdjacentHTML("beforeend", htmlFaixa());
        renderizarIcones();
      });
      caixa.addEventListener("click", (e) => {
        const botao = e.target.closest("[data-remover]");
        if (botao && caixa.children.length > 1) botao.closest("[data-faixa]").remove();
      });
    },

    aoConfirmar: async (form) => {
      const faixas = [...form.querySelectorAll("[data-faixa]")]
        .map((linha) => ({
          de: Number(linha.querySelector("[data-de]").value),
          ate: Number(linha.querySelector("[data-ate]").value),
          disciplina_id: Number(linha.querySelector("[data-disciplina]").value),
        }))
        .filter((f) => f.de && f.ate && f.ate >= f.de);

      if (!faixas.length) {
        falha({ message: "Preencha ao menos uma faixa válida." });
        return false;
      }

      try {
        await api.put(`/simulados/${simulado.id}/disciplinas`, { faixas });
        sucesso("Disciplinas aplicadas.");
        return true;
      } catch (e) {
        falha(e);
        return false;
      }
    },
  });
}

/* ─────────────────────────── resultado ─────────────────────────── */

function htmlBarraDisciplina(bloco) {
  const pct = bloco.percentual ?? 0;
  return `
    <div class="barra-disciplina">
      <span class="barra-disciplina__nome">
        <span class="amostra-cor amostra-cor--pequena"
              style="background:${esc(bloco.cor)};display:inline-block"></span>
        ${esc(bloco.nome)}
      </span>
      <div class="progresso crescer">
        <div class="progresso__preenchido"
             style="width:${pct}%;background:${esc(bloco.cor)}"></div>
      </div>
      <span class="barra-disciplina__valor">
        ${bloco.acertos}/${bloco.validas} · ${
          bloco.percentual === null ? "—" : esc(fmt.porcentagem(pct, 0))
        }
      </span>
    </div>`;
}

async function abrirResultado(id) {
  const resultado = await api.get(`/simulados/${id}/resultado`);
  const g = resultado.geral;
  const s = resultado.simulado;

  const blocos = [
    ["Acertos", g.acertos],
    ["Erros", g.erros - g.brancos],
    ["Brancos", g.brancos],
    ["Anuladas", g.anuladas],
    ["Válidas", g.validas],
  ];

  await modal({
    titulo: s.titulo,
    largo: true,
    confirmar: "Fechar",
    cancelar: null,
    corpo: `
      <div class="texto-centro">
        <div class="simulado__nota ${classeNota(g.percentual)}"
             style="font-size:3rem">
          ${g.percentual === null ? "—" : esc(fmt.porcentagem(g.percentual, 1))}
        </div>
        <p class="texto-muted" style="margin:2px 0 18px">
          ${
            g.validas
              ? `${g.acertos} acertos em ${g.validas} questões válidas`
              : "Lance o gabarito e as respostas para ver o resultado"
          }
        </p>
      </div>

      <div class="resultado-geral">
        ${blocos
          .map(
            ([rotulo, valor]) => `
          <div class="resultado-bloco">
            <div class="resultado-bloco__valor">${valor}</div>
            <div class="resultado-bloco__rotulo">${esc(rotulo)}</div>
          </div>`
          )
          .join("")}
      </div>

      ${
        resultado.por_disciplina.length
          ? `<h3 style="margin:0 0 4px;font-size:1.05rem">Por disciplina</h3>
             <p class="texto-muted" style="margin:0 0 6px;font-size:.8rem">
               Da pior para a melhor — é por onde começar a revisão.
             </p>
             ${resultado.por_disciplina.map(htmlBarraDisciplina).join("")}`
          : ""
      }

      ${
        resultado.questoes_erradas.length
          ? `<hr />
             <div class="linha-espalhada">
               <h3 style="margin:0;font-size:1.05rem">
                 ${resultado.questoes_erradas.length} questões erradas
               </h3>
               <button type="button" class="btn btn--contorno btn--pequeno"
                       data-acao="caderno">
                 ${icone("circle-alert")} Mandar ao caderno de erros
               </button>
             </div>
             <div class="linha" style="flex-wrap:wrap;gap:5px;margin-top:8px">
               ${resultado.questoes_erradas
                 .map(
                   (q) =>
                     `<span class="badge badge--perigo">${q.numero}</span>`
                 )
                 .join("")}
             </div>`
          : ""
      }

      <hr />
      <div class="linha" style="flex-wrap:wrap;gap:8px">
        <button type="button" class="btn btn--contorno btn--pequeno" data-acao="gabarito">
          ${icone("list-checks")} Gabarito
        </button>
        <button type="button" class="btn btn--contorno btn--pequeno" data-acao="respostas">
          ${icone("pencil")} Respostas
        </button>
        <button type="button" class="btn btn--contorno btn--pequeno" data-acao="disciplinas">
          ${icone("tags")} Disciplinas
        </button>
        <span class="crescer"></span>
        <button type="button" class="btn btn--perigo btn--pequeno" data-acao="excluir">
          ${icone("trash-2")} Excluir
        </button>
      </div>`,

    aoMontar: (form, fechar) => {
      form.querySelectorAll("[data-acao]").forEach((botao) =>
        botao.addEventListener("click", () => fechar(botao.dataset.acao))
      );
    },
    aoConfirmar: () => "fechar",
  }).then(async (escolha) => {
    try {
      switch (escolha) {
        case "gabarito":
          return abrirLancamento(id, "gabarito");
        case "respostas":
          return abrirLancamento(id, "resposta");
        case "disciplinas":
          return abrirDisciplinas(s);
        case "caderno":
          return mandarAoCaderno(resultado.questoes_erradas);
        case "excluir": {
          const certo = await confirmar(
            `Excluir "${s.titulo}" e todas as suas questões?`
          );
          if (!certo) return;
          await api.del(`/simulados/${id}`);
          sucesso("Simulado excluído.");
          return carregar();
        }
      }
    } catch (e) {
      falha(e);
    }
  });
}

/* ─────────────────── envio ao caderno de erros ─────────────────── */

async function mandarAoCaderno(erradas) {
  await modal({
    titulo: `Mandar ${erradas.length} questões ao caderno`,
    confirmar: "Registrar",
    corpo: `
      <p class="texto-muted" style="margin:0">
        Cada questão vira um registro no caderno de erros. O motivo pode
        ser ajustado depois, questão por questão.
      </p>
      <div class="campo">
        <label class="campo__rotulo" for="motivo">Motivo predominante</label>
        <select class="select" id="motivo" name="motivo">
          ${Object.entries(ROTULO_MOTIVO)
            .map(([v, r]) => `<option value="${v}">${esc(r)}</option>`)
            .join("")}
        </select>
      </div>`,

    aoConfirmar: async (form) => {
      const motivo = form.motivo.value;
      let criados = 0;
      let repetidos = 0;

      for (const questao of erradas) {
        try {
          await api.post("/erros", { questao_id: questao.id, motivo });
          criados++;
        } catch (e) {
          // 409 = a questão já estava no caderno; não é falha.
          if (e.status === 409) repetidos++;
          else throw e;
        }
      }

      sucesso(
        `${criados} registrada${criados === 1 ? "" : "s"}` +
          (repetidos ? `, ${repetidos} já estava${repetidos === 1 ? "" : "m"} lá.` : ".")
      );
      return true;
    },
  });
}

/* ─────────────────────────── início ─────────────────────────── */

async function iniciar() {
  try {
    const { conteudo } = await montar({
      pagina: "estudos",
      sub: "simulados",
      titulo: "Simulados",
      acoes: `<button class="btn btn--ouro" data-novo>
                ${icone("plus")} Novo simulado
              </button>`,
    });
    estado.conteudo = conteudo;

    document
      .querySelector("[data-novo]")
      .addEventListener("click", abrirNovoSimulado);

    // O Chart.js guarda as cores na criação: trocar o tema pede redesenho.
    graficos.aoTrocarTema(desenharGraficos);

    await carregar();
  } catch (e) {
    if (e?.status === 401) return;
    falha(e);
  }
}

iniciar();
