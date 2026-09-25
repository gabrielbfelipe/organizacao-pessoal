/* ════════════════════════════════════════════════════════════════════
   Ordo — Materiais de estudo

   PDFs e links agrupados por tema. Os PDFs abrem dentro do sistema com
   o PDF.js, sem download e sem sair da tela.

   O download passa por rota autenticada: a pasta uploads/ fica fora de
   frontend/ e nada ali é servido como estático.
   ══════════════════════════════════════════════════════════════════ */

import { api } from "../core/api.js";
import * as fmt from "../core/fmt.js";
import { montar } from "../core/layout.js";
import {
  confirmar,
  esc,
  falha,
  icone,
  modal,
  renderizarIcones,
  sucesso,
  vazio,
} from "../core/ui.js";

const estado = {
  materiais: [],
  temas: [],
  constantes: null,
  tema: "",
  busca: "",
  conteudo: null,
};

/* ─────────────────────── visualizador de PDF ─────────────────────── */

async function abrirPdf(material) {
  const tela = document.createElement("div");
  tela.className = "visor";
  tela.innerHTML = `
    <div class="visor__topo">
      <span class="crescer truncar">${esc(material.nome_original)}</span>
      <a class="btn btn--contorno btn--pequeno"
         href="/api/arquivos/${material.id}/download" download>
        ${icone("download")} Baixar
      </a>
      <button class="btn btn--fantasma btn--icone" data-fechar aria-label="Fechar">
        ${icone("x")}
      </button>
    </div>
    <div class="visor__quadro" data-quadro>
      <div class="carregando"><span class="girando"></span>Abrindo o PDF...</div>
    </div>`;

  function fechar() {
    document.removeEventListener("keydown", aoTeclar);
    tela.remove();
  }
  function aoTeclar(e) {
    if (e.key === "Escape") fechar();
  }

  tela.querySelector("[data-fechar]").addEventListener("click", fechar);
  tela.addEventListener("click", (e) => {
    if (e.target === tela) fechar();
  });
  document.addEventListener("keydown", aoTeclar);

  document.body.appendChild(tela);
  renderizarIcones();

  const quadro = tela.querySelector("[data-quadro]");

  try {
    const pdfjs = await import(
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.min.mjs"
    );
    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs";

    const documento = await pdfjs.getDocument(
      `/api/arquivos/${material.id}/download`
    ).promise;

    quadro.innerHTML = "";

    // Renderiza no máximo 30 páginas: além disso o navegador engasga, e
    // o botão de baixar continua ali para o documento inteiro.
    const total = Math.min(documento.numPages, 30);
    for (let n = 1; n <= total; n++) {
      const pagina = await documento.getPage(n);
      const escala = Math.min(1.6, (quadro.clientWidth - 40) / pagina.getViewport({ scale: 1 }).width);
      const viewport = pagina.getViewport({ scale: escala });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      quadro.appendChild(canvas);

      await pagina.render({
        canvasContext: canvas.getContext("2d"),
        viewport,
      }).promise;
    }

    if (documento.numPages > total) {
      quadro.insertAdjacentHTML(
        "beforeend",
        `<p class="texto-muted" style="padding:16px">
           Mostrando ${total} de ${documento.numPages} páginas. Baixe o
           arquivo para ver o documento inteiro.
         </p>`
      );
    }
  } catch (e) {
    quadro.innerHTML = `<div class="carregando">
      Não foi possível abrir o PDF aqui. Use o botão Baixar.</div>`;
    console.error(e);
  }
}

/* ─────────────────────────── render ─────────────────────────── */

function iconeDoMaterial(material) {
  if (material.link_externo) return "link";
  const tipo = material.mimetype || "";
  if (tipo.includes("pdf")) return "file-text";
  if (tipo.startsWith("image/")) return "image";
  return "file";
}

function htmlMaterial(material) {
  const ehPdf = (material.mimetype || "").includes("pdf");

  return `
    <article class="card material" data-id="${material.id}">
      <div class="material__icone">${icone(iconeDoMaterial(material))}</div>

      <div class="crescer" style="min-width:0">
        <div class="material__nome">${esc(material.nome_original)}</div>
        <div class="material__meta">
          ${
            material.link_externo
              ? "Link externo"
              : `${esc(fmt.tamanhoArquivo(material.tamanho))} · ${esc(
                  fmt.data(material.criado_em)
                )}`
          }
        </div>

        <div class="material__acoes">
          ${
            material.link_externo
              ? `<a class="btn btn--fantasma btn--pequeno"
                    href="${esc(material.link_externo)}" target="_blank"
                    rel="noopener noreferrer">${icone("external-link")} Abrir</a>`
              : ehPdf
                ? `<button class="btn btn--fantasma btn--pequeno" data-acao="ver">
                     ${icone("eye")} Ver
                   </button>`
                : `<a class="btn btn--fantasma btn--pequeno"
                      href="/api/arquivos/${material.id}/download" download>
                     ${icone("download")} Baixar
                   </a>`
          }
          <button class="btn btn--fantasma btn--icone" data-acao="excluir"
                  title="Excluir">${icone("trash-2")}</button>
        </div>
      </div>
    </article>`;
}

function htmlFiltros() {
  const temas = [
    ["", `Todos (${estado.materiais.length})`],
    ...estado.temas.map((t) => [t.tema, `${t.tema} (${t.total})`]),
  ];

  return `
    <div class="linha-espalhada" style="margin-bottom:18px;flex-wrap:wrap;gap:12px">
      <div class="temas">
        ${temas
          .map(
            ([valor, rotulo]) => `
          <button class="chip" data-tema="${esc(valor)}"
                  aria-pressed="${estado.tema === valor}">${esc(rotulo)}</button>`
          )
          .join("")}
      </div>
      <input class="input" type="search" data-busca placeholder="Buscar..."
             value="${esc(estado.busca)}" style="width:auto;min-width:180px" />
    </div>`;
}

function render() {
  const lista = estado.materiais.length
    ? `<div class="materiais">${estado.materiais.map(htmlMaterial).join("")}</div>`
    : `<div class="card">${vazio({
        icone: "folder",
        titulo: "Nenhum material aqui",
        texto: "Envie PDFs do IGMR, do Cerimonial dos Bispos, do Catecismo — ou guarde apenas o link.",
      })}</div>`;

  estado.conteudo.innerHTML = htmlFiltros() + lista;
  renderizarIcones();
  ligar();
}

async function carregar() {
  try {
    const [materiais, temas] = await Promise.all([
      api.get("/arquivos", {
        modulo: "igreja",
        tema: estado.tema,
        busca: estado.busca,
      }),
      api.get("/arquivos/temas"),
    ]);
    estado.materiais = materiais;
    estado.temas = temas;
    render();
  } catch (e) {
    falha(e);
  }
}

/* ─────────────────────────── envio ─────────────────────────── */

async function abrirEnvio() {
  const temas = estado.constantes?.temas_material || [];

  await modal({
    titulo: "Novo material",
    confirmar: "Enviar",
    corpo: `
      <div class="campo">
        <label class="campo__rotulo" for="tema">Tema</label>
        <select class="select" id="tema" name="tema">
          ${temas.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}
        </select>
      </div>

      <div class="campo">
        <label class="campo__rotulo" for="arquivo">Arquivo</label>
        <input class="input" type="file" id="arquivo" name="arquivo"
               accept=".pdf,.png,.jpg,.jpeg,.docx,.md,.txt" />
        <span class="texto-muted" style="font-size:.78rem">
          Até 50 MB. PDF, imagem, DOCX, Markdown ou texto.
        </span>
      </div>

      <div class="linha" style="gap:10px">
        <hr class="crescer" />
        <span class="texto-muted" style="font-size:.8rem">ou</span>
        <hr class="crescer" />
      </div>

      <div class="campo">
        <label class="campo__rotulo" for="link_externo">Link externo</label>
        <input class="input" type="url" id="link_externo" name="link_externo"
               placeholder="https://www.vatican.va/..." />
      </div>

      <div class="campo">
        <label class="campo__rotulo" for="nome">Nome do link</label>
        <input class="input" type="text" id="nome" name="nome"
               placeholder="Instrução Geral sobre o Missal Romano" />
      </div>`,

    aoConfirmar: async (form) => {
      const arquivo = form.arquivo.files[0];
      const link = form.link_externo.value.trim();

      if (!arquivo && !link) {
        falha({ message: "Escolha um arquivo ou informe um link." });
        return false;
      }

      const corpo = new FormData();
      corpo.append("modulo", "igreja");
      corpo.append("tema", form.tema.value);
      if (arquivo) corpo.append("arquivo", arquivo);
      if (link) {
        corpo.append("link_externo", link);
        corpo.append("nome", form.nome.value.trim() || link);
      }

      try {
        await api.upload("/arquivos", corpo);
        sucesso("Material adicionado.");
        await carregar();
        return true;
      } catch (e) {
        falha(e);
        return false;
      }
    },
  });
}

/* ─────────────────────────── eventos ─────────────────────────── */

function ligar() {
  estado.conteudo.querySelectorAll("[data-tema]").forEach((chip) =>
    chip.addEventListener("click", () => {
      estado.tema = chip.dataset.tema;
      carregar();
    })
  );

  const busca = estado.conteudo.querySelector("[data-busca]");
  let atraso;
  busca.addEventListener("input", () => {
    estado.busca = busca.value;
    clearTimeout(atraso);
    atraso = setTimeout(carregar, 320);
  });

  estado.conteudo.querySelectorAll("[data-acao]").forEach((botao) =>
    botao.addEventListener("click", async () => {
      const id = Number(botao.closest("[data-id]").dataset.id);
      const material = estado.materiais.find((m) => m.id === id);
      if (!material) return;

      try {
        if (botao.dataset.acao === "ver") return abrirPdf(material);

        const certo = await confirmar(`Excluir "${material.nome_original}"?`);
        if (!certo) return;
        await api.del(`/arquivos/${id}`);
        sucesso("Material excluído.");
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
      sub: "materiais",
      titulo: "Materiais de estudo",
      acoes: `<button class="btn btn--ouro" data-novo>
                ${icone("upload")} Novo material
              </button>`,
    });
    estado.conteudo = conteudo;

    estado.constantes = await api.get("/constantes");
    document.querySelector("[data-novo]").addEventListener("click", abrirEnvio);

    await carregar();
  } catch (e) {
    if (e?.status === 401) return;
    falha(e);
  }
}

iniciar();
