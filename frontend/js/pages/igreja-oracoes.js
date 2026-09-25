/* ════════════════════════════════════════════════════════════════════
   Ordo — Orações

   Biblioteca com categorias e favoritas, novenas com contador de
   progresso e o modo Rezar: tela cheia, fonte grande, fundo escuro e
   nada mais na tela.
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

const ROTULO_CATEGORIA = {
  manha: "Manhã",
  noite: "Noite",
  terco: "Terço",
  novena: "Novena",
  ladainha: "Ladainha",
  pessoal: "Pessoal",
};

const CHAVE_FONTE = "ordo:rezar-fonte";
const FONTE_MIN = 18;
const FONTE_MAX = 40;

const estado = {
  oracoes: [],
  novenas: [],
  categoria: "",
  somenteFavoritas: false,
  busca: "",
  conteudo: null,
};

/* ═════════════════════════ modo Rezar ═════════════════════════ */

function fonteGuardada() {
  try {
    return Number(localStorage.getItem(CHAVE_FONTE)) || 24;
  } catch {
    return 24;
  }
}

function guardarFonte(tamanho) {
  try {
    localStorage.setItem(CHAVE_FONTE, String(tamanho));
  } catch {
    /* sem persistência: vale só nesta sessão */
  }
}

/**
 * Abre a oração em tela cheia.
 * @param {object} oracao   com o texto completo
 * @param {object} novena   progresso em andamento, se houver
 */
function abrirRezar(oracao, novena) {
  let tamanho = fonteGuardada();

  const tela = document.createElement("div");
  tela.className = "rezar";
  tela.style.setProperty("--rezar-fonte", `${tamanho}px`);
  tela.innerHTML = `
    <div class="rezar__topo">
      <h1 class="rezar__titulo crescer">${esc(oracao.titulo)}</h1>
      <button class="rezar__acao" data-fonte="-1" aria-label="Diminuir a fonte">
        ${icone("minus")}
      </button>
      <button class="rezar__acao" data-fonte="1" aria-label="Aumentar a fonte">
        ${icone("plus")}
      </button>
      <button class="rezar__acao" data-sair>
        ${icone("x")} Sair
      </button>
    </div>

    <div class="rezar__texto" data-texto>${esc(oracao.texto)}</div>

    <div class="rezar__rodape">
      ${
        novena
          ? `<span>Dia ${novena.dia_atual} de ${novena.total_dias}</span>
             <button class="rezar__acao" data-rezei ${
               novena.rezada_hoje ? "disabled" : ""
             }>
               ${icone("check")} ${
                 novena.rezada_hoje ? "Já rezei hoje" : "Marcar como rezada hoje"
               }
             </button>`
          : `<span>Esc para sair</span>`
      }
    </div>`;

  function fechar() {
    document.removeEventListener("keydown", aoTeclar);
    tela.remove();
  }

  function ajustarFonte(passo) {
    tamanho = Math.min(FONTE_MAX, Math.max(FONTE_MIN, tamanho + passo * 2));
    tela.style.setProperty("--rezar-fonte", `${tamanho}px`);
    guardarFonte(tamanho);
  }

  function aoTeclar(e) {
    if (e.key === "Escape") fechar();
    if (e.key === "+" || e.key === "=") ajustarFonte(1);
    if (e.key === "-") ajustarFonte(-1);
  }

  tela.querySelector("[data-sair]").addEventListener("click", fechar);
  tela
    .querySelectorAll("[data-fonte]")
    .forEach((botao) =>
      botao.addEventListener("click", () =>
        ajustarFonte(Number(botao.dataset.fonte))
      )
    );

  tela.querySelector("[data-rezei]")?.addEventListener("click", async (e) => {
    const botao = e.currentTarget;
    botao.disabled = true;
    try {
      const atualizada = await api.post(
        `/igreja/oracoes/novenas/${novena.id}/avancar`
      );
      sucesso(
        atualizada.concluida
          ? "Novena concluída. Deo gratias."
          : `Dia marcado. Agora no dia ${atualizada.dia_atual} de ${atualizada.total_dias}.`
      );
      fechar();
      await carregar();
    } catch (erro) {
      falha(erro);
      botao.disabled = false;
    }
  });

  document.addEventListener("keydown", aoTeclar);
  document.body.appendChild(tela);
  renderizarIcones();
  tela.querySelector("[data-texto]").focus?.();
}

async function rezar(id) {
  try {
    const oracao = await api.get(`/igreja/oracoes/${id}`);
    let novena = null;

    if (oracao.novena_ativa) {
      novena = {
        ...oracao.novena_ativa,
        total_dias: oracao.novena_ativa.total_dias || oracao.dias_novena,
        // fmt.hojeISO() é a data local; toISOString() daria UTC e erraria
        // o dia à noite, no fuso do Brasil.
        rezada_hoje: oracao.novena_ativa.ultimo_dia_em === fmt.hojeISO(),
      };
    }

    abrirRezar(oracao, novena);
  } catch (e) {
    falha(e);
  }
}

/* ═════════════════════════ listagem ═════════════════════════ */

function htmlOracao(oracao) {
  return `
    <div class="oracao-envolve">
      <article class="card oracao" data-id="${oracao.id}" data-acao="rezar">
        <h3 class="oracao__titulo">${esc(oracao.titulo)}</h3>
        <div class="linha" style="flex-wrap:wrap;gap:6px">
          <span class="badge">${esc(
            ROTULO_CATEGORIA[oracao.categoria] || oracao.categoria
          )}</span>
          ${oracao.e_novena ? `<span class="badge badge--ouro">Novena</span>` : ""}
        </div>
      </article>

      <button class="oracao__favorita" data-id="${oracao.id}" data-acao="favorita"
              aria-pressed="${oracao.favorita}"
              title="${oracao.favorita ? "Tirar dos favoritos" : "Favoritar"}">
        ${icone(oracao.favorita ? "star" : "star")}
      </button>
    </div>`;
}

function htmlNovenas() {
  if (!estado.novenas.length) return "";

  return `
    <section style="margin-bottom:22px">
      <h2 class="card__titulo" style="margin-bottom:12px">Novenas em andamento</h2>
      <div class="oracoes">
        ${estado.novenas
          .map((n) => {
            const pct = (n.dia_atual / (n.total_dias || 9)) * 100;
            return `
          <article class="card novena" data-novena="${n.id}">
            <div class="linha-espalhada" style="align-items:flex-start">
              <div class="crescer">
                <h3 style="margin:0 0 3px;font-size:1.08rem">
                  ${esc(n.oracao.titulo)}
                </h3>
                <p class="texto-muted" style="margin:0;font-size:.8rem">
                  ${n.rezada_hoje ? "Já rezada hoje" : "Ainda não rezada hoje"}
                </p>
              </div>
              <span class="novena__contador">${n.dia_atual}/${n.total_dias || 9}</span>
            </div>

            <div class="progresso" style="margin:12px 0 10px">
              <div class="progresso__preenchido" style="width:${pct}%"></div>
            </div>

            <div class="linha">
              <button class="btn btn--ouro btn--pequeno" data-acao="rezar"
                      data-id="${n.oracao_id}">
                ${icone("book-open")} Rezar
              </button>
              <span class="crescer"></span>
              <button class="btn btn--fantasma btn--icone" data-acao="abandonar"
                      data-novena="${n.id}" title="Encerrar esta novena">
                ${icone("x")}
              </button>
            </div>
          </article>`;
          })
          .join("")}
      </div>
    </section>`;
}

function htmlFiltros() {
  const categorias = [["", "Todas"], ...Object.entries(ROTULO_CATEGORIA)];

  return `
    <div class="linha-espalhada" style="margin-bottom:18px;flex-wrap:wrap;gap:12px">
      <div class="linha" style="flex-wrap:wrap">
        ${categorias
          .map(
            ([valor, rotulo]) => `
          <button class="chip" data-categoria="${valor}"
                  aria-pressed="${estado.categoria === valor}">${esc(rotulo)}</button>`
          )
          .join("")}
      </div>

      <div class="linha">
        <button class="chip" data-favoritas
                aria-pressed="${estado.somenteFavoritas}">
          ${icone("star")} Favoritas
        </button>
        <input class="input" type="search" data-busca placeholder="Buscar..."
               value="${esc(estado.busca)}" style="width:auto;min-width:170px" />
      </div>
    </div>`;
}

function render() {
  const lista = estado.oracoes.length
    ? `<div class="oracoes">${estado.oracoes.map(htmlOracao).join("")}</div>`
    : `<div class="card">${vazio({
        icone: "book-open",
        titulo: "Nenhuma oração encontrada",
        texto: "Cadastre as orações que você reza com frequência para tê-las sempre à mão.",
      })}</div>`;

  estado.conteudo.innerHTML = htmlNovenas() + htmlFiltros() + lista;
  renderizarIcones();
  ligar();
}

async function carregar() {
  try {
    const [oracoes, novenas] = await Promise.all([
      api.get("/igreja/oracoes", {
        categoria: estado.categoria,
        favoritas: estado.somenteFavoritas ? 1 : "",
        busca: estado.busca,
      }),
      api.get("/igreja/oracoes/novenas"),
    ]);
    estado.oracoes = oracoes;
    estado.novenas = novenas;
    render();
  } catch (e) {
    falha(e);
  }
}

/* ═════════════════════════ formulário ═════════════════════════ */

function camposOracao(o = {}) {
  return `
    <div class="campo">
      <label class="campo__rotulo campo__rotulo--obrigatorio" for="titulo">Título</label>
      <input class="input" type="text" id="titulo" name="titulo"
             value="${esc(o.titulo || "")}" required />
    </div>

    <div class="campo">
      <label class="campo__rotulo campo__rotulo--obrigatorio" for="texto">Texto</label>
      <textarea class="textarea" id="texto" name="texto" required
                style="min-height:200px">${esc(o.texto || "")}</textarea>
    </div>

    <div class="grade-campos">
      <div class="campo">
        <label class="campo__rotulo" for="categoria">Categoria</label>
        <select class="select" id="categoria" name="categoria">
          ${Object.entries(ROTULO_CATEGORIA)
            .map(
              ([valor, rotulo]) =>
                `<option value="${valor}" ${
                  (o.categoria || "pessoal") === valor ? "selected" : ""
                }>${esc(rotulo)}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="campo" data-campo-dias>
        <label class="campo__rotulo" for="dias_novena">Dias da novena</label>
        <input class="input" type="number" id="dias_novena" name="dias_novena"
               min="2" max="60" value="${esc(o.dias_novena || 9)}" />
      </div>
    </div>

    <label class="checkbox">
      <input type="checkbox" name="e_novena" ${o.e_novena ? "checked" : ""} />
      <span>É uma novena</span>
    </label>

    <label class="checkbox">
      <input type="checkbox" name="favorita" ${o.favorita ? "checked" : ""} />
      <span>Marcar como favorita</span>
    </label>`;
}

async function abrirFormulario(oracao) {
  const editando = Boolean(oracao);

  await modal({
    titulo: editando ? "Editar oração" : "Nova oração",
    largo: true,
    corpo: camposOracao(oracao),
    confirmar: editando ? "Salvar" : "Cadastrar",

    aoMontar: (form) => {
      // O número de dias só faz sentido quando é novena.
      const caixa = form.querySelector('[name="e_novena"]');
      const campo = form.querySelector("[data-campo-dias]");
      const aplicar = () => {
        campo.style.display = caixa.checked ? "" : "none";
      };
      caixa.addEventListener("change", aplicar);
      aplicar();
    },

    aoConfirmar: async (form) => {
      try {
        const dados = lerForm(form);
        if (editando) {
          await api.put(`/igreja/oracoes/${oracao.id}`, dados);
          sucesso("Oração atualizada.");
        } else {
          await api.post("/igreja/oracoes", dados);
          sucesso("Oração cadastrada.");
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

/* ═════════════════════════ eventos ═════════════════════════ */

function ligar() {
  estado.conteudo.querySelectorAll("[data-categoria]").forEach((chip) =>
    chip.addEventListener("click", () => {
      estado.categoria = chip.dataset.categoria;
      carregar();
    })
  );

  estado.conteudo.querySelector("[data-favoritas]").addEventListener("click", () => {
    estado.somenteFavoritas = !estado.somenteFavoritas;
    carregar();
  });

  const busca = estado.conteudo.querySelector("[data-busca]");
  let atraso;
  busca.addEventListener("input", () => {
    estado.busca = busca.value;
    clearTimeout(atraso);
    atraso = setTimeout(carregar, 320);
  });

  estado.conteudo.querySelectorAll("[data-acao]").forEach((alvo) =>
    alvo.addEventListener("click", async (e) => {
      e.stopPropagation();
      const acao = alvo.dataset.acao;

      try {
        if (acao === "rezar") return rezar(Number(alvo.dataset.id));

        if (acao === "favorita") {
          await api.patch(`/igreja/oracoes/${alvo.dataset.id}/favorita`);
          return carregar();
        }

        if (acao === "abandonar") {
          const certo = await confirmar(
            "Encerrar esta novena? O progresso será perdido.",
            { confirmar: "Encerrar" }
          );
          if (!certo) return;
          await api.del(`/igreja/oracoes/novenas/${alvo.dataset.novena}`);
          sucesso("Novena encerrada.");
          return carregar();
        }
      } catch (erro) {
        falha(erro);
      }
    })
  );

  // Botão direito no cartão abre a edição, sem poluir a grade com ícones.
  estado.conteudo.querySelectorAll(".oracao").forEach((cartao) =>
    cartao.addEventListener("contextmenu", async (e) => {
      e.preventDefault();
      try {
        const oracao = await api.get(`/igreja/oracoes/${cartao.dataset.id}`);
        abrirFormulario(oracao);
      } catch (erro) {
        falha(erro);
      }
    })
  );
}

/* ═════════════════════════ início ═════════════════════════ */

async function iniciar() {
  try {
    const { conteudo } = await montar({
      pagina: "igreja",
      sub: "oracoes",
      titulo: "Orações",
      acoes: `<button class="btn btn--contorno" data-nova-novena>
                ${icone("calendar-check")} Iniciar novena
              </button>
              <button class="btn btn--ouro" data-nova>
                ${icone("plus")} Nova oração
              </button>`,
    });
    estado.conteudo = conteudo;

    document
      .querySelector("[data-nova]")
      .addEventListener("click", () => abrirFormulario(null));

    document
      .querySelector("[data-nova-novena]")
      .addEventListener("click", abrirIniciarNovena);

    await carregar();
  } catch (e) {
    if (e?.status === 401) return;
    falha(e);
  }
}

/** Escolhe entre as orações marcadas como novena e começa o acompanhamento. */
async function abrirIniciarNovena() {
  try {
    const disponiveis = await api.get("/igreja/oracoes", { novenas: 1 });
    const emAndamento = new Set(estado.novenas.map((n) => n.oracao_id));
    const opcoes = disponiveis.filter((o) => !emAndamento.has(o.id));

    if (!opcoes.length) {
      return falha({
        message: disponiveis.length
          ? "Todas as novenas cadastradas já estão em andamento."
          : "Cadastre uma oração marcada como novena primeiro.",
      });
    }

    await modal({
      titulo: "Iniciar novena",
      confirmar: "Começar hoje",
      corpo: `
        <div class="campo">
          <label class="campo__rotulo" for="oracao_id">Oração</label>
          <select class="select" id="oracao_id" name="oracao_id">
            ${opcoes
              .map(
                (o) =>
                  `<option value="${o.id}">${esc(o.titulo)} · ${o.dias_novena} dias</option>`
              )
              .join("")}
          </select>
        </div>
        <p class="texto-muted" style="margin:0;font-size:.85rem">
          O contador começa hoje, no dia 1, e avança uma vez por dia.
        </p>`,
      aoConfirmar: async (form) => {
        try {
          await api.post(`/igreja/oracoes/${form.oracao_id.value}/novena`);
          sucesso("Novena iniciada.");
          await carregar();
          return true;
        } catch (e) {
          falha(e);
          return false;
        }
      },
    });
  } catch (e) {
    falha(e);
  }
}

iniciar();
