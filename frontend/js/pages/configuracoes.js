/* ════════════════════════════════════════════════════════════════════
   Ordo — Configurações

   Perfil e senha, categorias, disciplinas, datas litúrgicas fixas,
   tema e backup do banco.

   As datas fixas merecem destaque: são elas que fazem o vermelho dos
   mártires e a solenidade de Aparecida aparecerem no lugar certo. O
   cálculo móvel sozinho não cobre isso.
   ══════════════════════════════════════════════════════════════════ */

import { api } from "../core/api.js";
import * as fmt from "../core/fmt.js";
import { montar } from "../core/layout.js";
import { alternar as alternarTema, temaAtual } from "../core/tema.js";
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

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const ROTULO_GRAU = {
  solenidade: "Solenidade",
  festa: "Festa",
  memoria: "Memória",
  comemoracao: "Comemoração",
};

const estado = {
  usuario: null,
  categorias: [],
  disciplinas: [],
  datasFixas: [],
  cores: {},
  backup: null,
  aba: "perfil",
  conteudo: null,
};

const ABAS = [
  { chave: "perfil", rotulo: "Perfil", icone: "user" },
  { chave: "categorias", rotulo: "Categorias", icone: "tag" },
  { chave: "disciplinas", rotulo: "Disciplinas", icone: "graduation-cap" },
  { chave: "liturgia", rotulo: "Datas litúrgicas", icone: "church" },
  { chave: "sistema", rotulo: "Tema e backup", icone: "settings" },
];

/* ═════════════════════════ perfil ═════════════════════════ */

function htmlPerfil() {
  const u = estado.usuario;
  return `
    <div class="config-colunas">
      <section class="card">
        <div class="card__cabecalho">
          <h2 class="card__titulo">Seus dados</h2>
        </div>
        <form class="pilha" data-form-perfil>
          <div class="campo">
            <label class="campo__rotulo" for="nome">Nome</label>
            <input class="input" type="text" id="nome" name="nome"
                   value="${esc(u?.nome || "")}" />
          </div>
          <div class="campo">
            <label class="campo__rotulo" for="email">E-mail</label>
            <input class="input" type="email" id="email" name="email"
                   value="${esc(u?.email || "")}" />
          </div>
          <button class="btn btn--ouro" type="submit"
                  style="align-self:flex-start">Salvar</button>
        </form>
      </section>

      <section class="card">
        <div class="card__cabecalho">
          <h2 class="card__titulo">Trocar a senha</h2>
        </div>
        <form class="pilha" data-form-senha>
          <div class="campo">
            <label class="campo__rotulo" for="senha_atual">Senha atual</label>
            <input class="input" type="password" id="senha_atual"
                   name="senha_atual" autocomplete="current-password" />
          </div>
          <div class="campo">
            <label class="campo__rotulo" for="senha_nova">Nova senha</label>
            <input class="input" type="password" id="senha_nova"
                   name="senha_nova" autocomplete="new-password" />
            <span class="texto-muted" style="font-size:.78rem">
              Pelo menos 8 caracteres.
            </span>
          </div>
          <button class="btn btn--ouro" type="submit"
                  style="align-self:flex-start">Trocar</button>
        </form>

        <p class="texto-muted" style="margin:16px 0 0;font-size:.8rem;
                  padding-top:14px;border-top:1px solid var(--border)">
          Mudar <code>ADMIN_SENHA</code> no <code>.env</code> não tem efeito:
          o seed só cria o usuário quando ainda não existe nenhum.
        </p>
      </section>
    </div>`;
}

/* ═════════════════════ listas simples ═════════════════════ */

/** Categorias e disciplinas têm a mesma forma: nome + cor. */
function htmlListaColorida(itens, tipo, { comModulo } = {}) {
  return `
    <section class="card">
      <div class="card__cabecalho">
        <h2 class="card__titulo">
          ${tipo === "categoria" ? "Categorias" : "Disciplinas"}
        </h2>
        <button class="btn btn--ouro btn--pequeno" data-novo="${tipo}">
          ${icone("plus")} Nova
        </button>
      </div>

      ${
        itens.length
          ? itens
              .map(
                (item) => `
        <div class="item-lista" data-id="${item.id}" data-tipo="${tipo}">
          <span class="amostra-cor amostra-cor--pequena"
                style="background:${esc(item.cor)}"></span>
          <span class="crescer">${esc(item.nome)}</span>
          ${
            comModulo && item.modulo
              ? `<span class="badge">${esc(item.modulo)}</span>`
              : ""
          }
          <button class="btn btn--fantasma btn--icone" data-acao="editar"
                  title="Editar">${icone("pencil")}</button>
          <button class="btn btn--fantasma btn--icone" data-acao="excluir"
                  title="Excluir">${icone("trash-2")}</button>
        </div>`
              )
              .join("")
          : `<p class="texto-muted" style="margin:0;font-size:.88rem">
               Nenhuma cadastrada.</p>`
      }
    </section>`;
}

async function abrirFormColorido(tipo, item) {
  const editando = Boolean(item);
  const ehCategoria = tipo === "categoria";

  await modal({
    titulo: `${editando ? "Editar" : "Nova"} ${
      ehCategoria ? "categoria" : "disciplina"
    }`,
    confirmar: "Salvar",
    corpo: `
      <div class="campo">
        <label class="campo__rotulo campo__rotulo--obrigatorio" for="nome">Nome</label>
        <input class="input" type="text" id="nome" name="nome"
               value="${esc(item?.nome || "")}" required />
      </div>

      <div class="campo">
        <label class="campo__rotulo" for="cor">Cor</label>
        <input class="input-cor" type="color" id="cor" name="cor"
               value="${esc(item?.cor || "#1B2A41")}" />
      </div>

      ${
        ehCategoria
          ? `<div class="campo">
               <label class="campo__rotulo" for="modulo">Módulo</label>
               <select class="select" id="modulo" name="modulo">
                 ${["geral", "igreja", "estudos"]
                   .map(
                     (m) =>
                       `<option value="${m}" ${
                         (item?.modulo || "geral") === m ? "selected" : ""
                       }>${fmt.capitalizar(m)}</option>`
                   )
                   .join("")}
               </select>
             </div>`
          : ""
      }`,

    aoConfirmar: async (form) => {
      const rota = ehCategoria ? "/categorias" : "/disciplinas";
      try {
        const dados = lerForm(form);
        if (editando) await api.put(`${rota}/${item.id}`, dados);
        else await api.post(rota, dados);
        sucesso(editando ? "Atualizada." : "Criada.");
        await carregar();
        return true;
      } catch (e) {
        marcarErros(form, falha(e));
        return false;
      }
    },
  });
}

/* ═════════════════════ datas litúrgicas ═════════════════════ */

function htmlLiturgia() {
  const porMes = {};
  for (const data of estado.datasFixas) {
    (porMes[data.mes] ||= []).push(data);
  }

  return `
    <section class="card">
      <div class="card__cabecalho">
        <div>
          <h2 class="card__titulo">Datas litúrgicas fixas</h2>
          <p class="texto-muted" style="margin:2px 0 0;font-size:.8rem">
            Solenidades e festas de data fixa. O cálculo móvel cobre Páscoa,
            Advento e companhia; estas completam o calendário.
          </p>
        </div>
        <button class="btn btn--ouro btn--pequeno" data-nova-data>
          ${icone("plus")} Nova
        </button>
      </div>

      <div class="liturgia-meses">
        ${Object.keys(porMes)
          .map(Number)
          .sort((a, b) => a - b)
          .map(
            (mes) => `
          <div class="liturgia-mes">
            <div class="liturgia-mes__nome">${esc(fmt.capitalizar(MESES[mes - 1]))}</div>
            ${porMes[mes]
              .sort((a, b) => a.dia - b.dia)
              .map(
                (d) => `
              <div class="item-lista" data-data="${d.id}">
                <span class="liturgia-dia">${d.dia}</span>
                <span class="amostra-cor amostra-cor--pequena"
                      style="background:var(--lit-${esc(d.cor)})"
                      title="${esc(d.cor)}"></span>
                <div class="crescer" style="min-width:0">
                  <div class="truncar" style="font-size:.88rem">${esc(d.titulo)}</div>
                  <div class="texto-muted" style="font-size:.74rem">
                    ${esc(ROTULO_GRAU[d.grau] || d.grau)}
                  </div>
                </div>
                <button class="btn btn--fantasma btn--icone" data-apagar-data
                        title="Remover">${icone("trash-2")}</button>
              </div>`
              )
              .join("")}
          </div>`
          )
          .join("")}
      </div>
    </section>`;
}

async function abrirFormData() {
  const cores = Object.keys(estado.cores.cores_liturgicas || {});
  const graus = estado.cores.graus_liturgicos || Object.keys(ROTULO_GRAU);

  await modal({
    titulo: "Nova data litúrgica",
    confirmar: "Cadastrar",
    corpo: `
      <div class="campo">
        <label class="campo__rotulo campo__rotulo--obrigatorio" for="titulo">
          Celebração
        </label>
        <input class="input" type="text" id="titulo" name="titulo"
               placeholder="São Francisco de Assis" required />
      </div>

      <div class="grade-campos">
        <div class="campo">
          <label class="campo__rotulo campo__rotulo--obrigatorio" for="dia">Dia</label>
          <input class="input" type="number" id="dia" name="dia"
                 min="1" max="31" value="1" required />
        </div>
        <div class="campo">
          <label class="campo__rotulo campo__rotulo--obrigatorio" for="mes">Mês</label>
          <select class="select" id="mes" name="mes">
            ${MESES.map(
              (nome, i) =>
                `<option value="${i + 1}">${fmt.capitalizar(nome)}</option>`
            ).join("")}
          </select>
        </div>
      </div>

      <div class="grade-campos">
        <div class="campo">
          <label class="campo__rotulo" for="cor">Cor litúrgica</label>
          <select class="select" id="cor" name="cor">
            ${cores
              .map(
                (c) =>
                  `<option value="${c}" ${c === "branco" ? "selected" : ""}>${
                    fmt.capitalizar(c)
                  }</option>`
              )
              .join("")}
          </select>
        </div>
        <div class="campo">
          <label class="campo__rotulo" for="grau">Grau</label>
          <select class="select" id="grau" name="grau">
            ${graus
              .map(
                (g) =>
                  `<option value="${g}" ${g === "memoria" ? "selected" : ""}>${esc(
                    ROTULO_GRAU[g] || g
                  )}</option>`
              )
              .join("")}
          </select>
        </div>
      </div>

      <p class="texto-muted" style="margin:0;font-size:.8rem">
        O grau define a precedência: na Quaresma e no Advento, só
        solenidades sobrepõem o tempo; no Tríduo, nada sobrepõe.
      </p>`,

    aoConfirmar: async (form) => {
      try {
        await api.post("/liturgia/datas-fixas", lerForm(form));
        sucesso("Data cadastrada.");
        await carregar();
        return true;
      } catch (e) {
        marcarErros(form, falha(e));
        return false;
      }
    },
  });
}

/* ═════════════════════ tema e backup ═════════════════════ */

function htmlSistema() {
  const escuro = temaAtual() === "dark";
  const b = estado.backup;

  return `
    <div class="config-colunas">
      <section class="card">
        <div class="card__cabecalho">
          <h2 class="card__titulo">Aparência</h2>
        </div>
        <div class="linha-espalhada">
          <div>
            <div style="font-weight:500">Modo ${escuro ? "escuro" : "claro"}</div>
            <div class="texto-muted" style="font-size:.8rem">
              Sem escolha registrada, o Ordo segue o sistema.
            </div>
          </div>
          <button class="btn btn--contorno" data-alternar-tema>
            ${icone(escuro ? "sun" : "moon")} Mudar para ${escuro ? "claro" : "escuro"}
          </button>
        </div>
      </section>

      <section class="card">
        <div class="card__cabecalho">
          <h2 class="card__titulo">Backup</h2>
        </div>

        ${
          b?.disponivel
            ? `<p class="texto-muted" style="margin:0 0 14px;font-size:.88rem">
                 Baixa o banco inteiro num arquivo <code>.sql</code>, com a
                 estrutura e todos os dados. Para restaurar:
                 <code>mysql -u root -p ordo &lt; arquivo.sql</code>
               </p>
               <button class="btn btn--ouro" data-backup>
                 ${icone("download")} Baixar o backup
               </button>`
            : `<p class="texto-muted" style="margin:0;font-size:.88rem">
                 ${esc(b?.motivo || "Backup indisponível.")}
               </p>`
        }
      </section>

      <section class="card">
        <div class="card__cabecalho">
          <h2 class="card__titulo">Sobre</h2>
        </div>
        <p class="texto-muted" style="margin:0;font-size:.88rem;line-height:1.7">
          <strong class="serif" style="font-size:1.1rem;color:var(--gold-texto)">Ordo</strong>
          — do latim, "ordem". Também é o nome do calendário litúrgico que
          orienta as celebrações da Igreja.
        </p>
      </section>
    </div>`;
}

async function baixarBackup(botao) {
  const original = botao.innerHTML;
  botao.disabled = true;
  botao.textContent = "Gerando...";

  try {
    // Download binário: sai do api.js, que só lida com JSON.
    const resposta = await fetch("/api/backup", { credentials: "same-origin" });
    if (!resposta.ok) {
      const dados = await resposta.json().catch(() => null);
      throw new Error(dados?.erro || "Não foi possível gerar o backup.");
    }

    const blob = await resposta.blob();
    const nome =
      resposta.headers
        .get("Content-Disposition")
        ?.match(/filename="(.+)"/)?.[1] || "backup.sql";

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    link.click();
    URL.revokeObjectURL(url);

    sucesso(`Backup salvo: ${nome}`);
  } catch (e) {
    falha(e);
  } finally {
    botao.disabled = false;
    botao.innerHTML = original;
    renderizarIcones();
  }
}

/* ═════════════════════ render ═════════════════════ */

function render() {
  const abas = `
    <div class="linha" style="margin-bottom:20px;flex-wrap:wrap">
      ${ABAS.map(
        (a) => `
        <button class="chip" data-aba="${a.chave}"
                aria-pressed="${estado.aba === a.chave}">
          ${icone(a.icone)} ${esc(a.rotulo)}
        </button>`
      ).join("")}
    </div>`;

  const corpo = {
    perfil: htmlPerfil,
    categorias: () => htmlListaColorida(estado.categorias, "categoria", { comModulo: true }),
    disciplinas: () => htmlListaColorida(estado.disciplinas, "disciplina"),
    liturgia: htmlLiturgia,
    sistema: htmlSistema,
  }[estado.aba]();

  estado.conteudo.innerHTML = abas + corpo;
  renderizarIcones();
  ligar();
}

async function carregar() {
  try {
    const [usuario, categorias, disciplinas, datasFixas, constantes, backup] =
      await Promise.all([
        api.get("/me"),
        api.get("/categorias"),
        api.get("/disciplinas"),
        api.get("/liturgia/datas-fixas"),
        api.get("/constantes"),
        api.get("/backup/status").catch(() => ({ disponivel: false })),
      ]);

    Object.assign(estado, {
      usuario,
      categorias,
      disciplinas,
      datasFixas,
      cores: constantes,
      backup,
    });
    render();
  } catch (e) {
    falha(e);
  }
}

/* ═════════════════════ eventos ═════════════════════ */

function ligar() {
  estado.conteudo.querySelectorAll("[data-aba]").forEach((chip) =>
    chip.addEventListener("click", () => {
      estado.aba = chip.dataset.aba;
      render();
    })
  );

  // ── perfil ──
  estado.conteudo
    .querySelector("[data-form-perfil]")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        estado.usuario = await api.put("/me", lerForm(e.target));
        sucesso("Dados atualizados.");
        render();
      } catch (erro) {
        marcarErros(e.target, falha(erro));
      }
    });

  estado.conteudo
    .querySelector("[data-form-senha]")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dados = lerForm(e.target);
      if (!dados.senha_nova) return falha({ message: "Informe a nova senha." });

      try {
        await api.put("/me", dados);
        sucesso("Senha trocada.");
        e.target.reset();
      } catch (erro) {
        marcarErros(e.target, falha(erro));
      }
    });

  // ── categorias e disciplinas ──
  estado.conteudo.querySelectorAll("[data-novo]").forEach((botao) =>
    botao.addEventListener("click", () =>
      abrirFormColorido(botao.dataset.novo, null)
    )
  );

  estado.conteudo.querySelectorAll("[data-acao]").forEach((botao) =>
    botao.addEventListener("click", async () => {
      const linha = botao.closest("[data-id]");
      const tipo = linha.dataset.tipo;
      const id = Number(linha.dataset.id);
      const lista = tipo === "categoria" ? estado.categorias : estado.disciplinas;
      const item = lista.find((x) => x.id === id);
      if (!item) return;

      try {
        if (botao.dataset.acao === "editar") return abrirFormColorido(tipo, item);

        const aviso =
          tipo === "disciplina"
            ? `Excluir "${item.nome}"? Os flashcards e as metas dela também saem; simulados e anotações apenas perdem o vínculo.`
            : `Excluir "${item.nome}"? Os compromissos ficam sem categoria.`;

        if (!(await confirmar(aviso))) return;
        await api.del(`${tipo === "categoria" ? "/categorias" : "/disciplinas"}/${id}`);
        sucesso("Excluída.");
        carregar();
      } catch (e) {
        falha(e);
      }
    })
  );

  // ── datas litúrgicas ──
  estado.conteudo
    .querySelector("[data-nova-data]")
    ?.addEventListener("click", abrirFormData);

  estado.conteudo.querySelectorAll("[data-apagar-data]").forEach((botao) =>
    botao.addEventListener("click", async () => {
      const linha = botao.closest("[data-data]");
      const titulo = linha.querySelector(".truncar").textContent.trim();
      if (!(await confirmar(`Remover "${titulo}" do calendário?`))) return;

      try {
        await api.del(`/liturgia/datas-fixas/${linha.dataset.data}`);
        sucesso("Data removida.");
        carregar();
      } catch (e) {
        falha(e);
      }
    })
  );

  // ── sistema ──
  estado.conteudo
    .querySelector("[data-alternar-tema]")
    ?.addEventListener("click", () => {
      alternarTema();
      render();
    });

  estado.conteudo
    .querySelector("[data-backup]")
    ?.addEventListener("click", (e) => baixarBackup(e.currentTarget));
}

/* ═════════════════════ início ═════════════════════ */

async function iniciar() {
  try {
    const { conteudo } = await montar({
      pagina: "config",
      titulo: "Configurações",
    });
    estado.conteudo = conteudo;
    await carregar();
  } catch (e) {
    if (e?.status === 401) return;
    falha(e);
  }
}

iniciar();
