/* ════════════════════════════════════════════════════════════════════
   Ordo — gráficos

   Um lugar só para as decisões de visualização, para que os três
   gráficos do sistema leiam como um conjunto.

   Decisões, e o porquê de cada uma:

   • Série de hue único, nunca a cor da disciplina. As cores das
     disciplinas, postas lado a lado, reprovam na verificação: o roxo do
     Direito Constitucional e o azul do Raciocínio Lógico ficam a ΔE
     12,7 na visão normal, abaixo do piso de 15. Como o trabalho destas
     barras é comparar grandeza, e não distinguir identidade, hue único
     é ao mesmo tempo mais correto e mais legível. A identidade vem do
     nome no eixo.

   • A cor da série não é --gold. Sobre o branco ele dá contraste 2,81,
     abaixo do mínimo de 3:1. O tema claro usa um ouro mais escuro, e o
     escuro tem o seu próprio passo — os dois verificados contra a
     superfície real em que o gráfico é desenhado.

   • Série única não leva legenda: o título já diz o que está plotado.
     Uma caixa com um único quadrinho só repete o título.

   • Marcas finas: barra de no máximo 24px com ponta arredondada de 4px
     e base reta, linha de 2px, ponto de raio 4 com anel de 2px na cor
     da superfície. Grade em 1px sólido, recuada.
   ══════════════════════════════════════════════════════════════════ */

import { esc } from "./ui.js";

/** Lê os tokens do tema vigente. Chamado a cada render. */
function tokens() {
  const estilo = getComputedStyle(document.documentElement);
  const ler = (nome, reserva) =>
    (estilo.getPropertyValue(nome) || reserva).trim();

  return {
    serie: ler("--grafico-serie", "#9a7b2c"),
    serieFraca: ler("--grafico-serie-fraca", "rgba(154,123,44,.12)"),
    grade: ler("--grafico-grade", "#e6e1d6"),
    texto: ler("--grafico-texto", "#7a7568"),
    superficie: ler("--grafico-superficie", "#ffffff"),
    card: ler("--card", "#ffffff"),
    borda: ler("--border", "#e6e1d6"),
    tinta: ler("--text", "#2b2b2b"),
    fonte: ler("--fonte-ui", "Inter, sans-serif"),
  };
}

/** Base comum a todos os gráficos: grade recuada, sem legenda, tooltip
    vestido com o design system. */
function opcoesBase(t, { formatarValor }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 420 },

    // Passar o mouse em qualquer ponto da coluna, não só na marca.
    interaction: { mode: "index", intersect: false },

    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: t.card,
        titleColor: t.tinta,
        bodyColor: t.tinta,
        borderColor: t.borda,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        titleFont: { family: t.fonte, size: 12, weight: "600" },
        bodyFont: { family: t.fonte, size: 13 },
        callbacks: formatarValor
          ? { label: (ctx) => formatarValor(ctx.parsed.y ?? ctx.parsed.x, ctx) }
          : undefined,
      },
    },

    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        border: { color: t.grade },
        ticks: { color: t.texto, font: { family: t.fonte, size: 11 } },
      },
      y: {
        grid: { color: t.grade, drawBorder: false, lineWidth: 1 },
        border: { display: false },
        ticks: { color: t.texto, font: { family: t.fonte, size: 11 } },
      },
    },
  };
}

/* ─────────────────────── os três gráficos ─────────────────────── */

/** Evolução do percentual em simulados, ao longo do tempo. */
export function evolucaoSimulados(canvas, pontos) {
  const t = tokens();
  const base = opcoesBase(t, {
    formatarValor: (v) => `${v}% de acerto`,
  });

  return new Chart(canvas, {
    type: "line",
    data: {
      labels: pontos.map((p) => p.rotulo),
      datasets: [
        {
          data: pontos.map((p) => p.percentual),
          borderColor: t.serie,
          backgroundColor: t.serieFraca,
          borderWidth: 2,
          borderJoinStyle: "round",
          borderCapStyle: "round",
          fill: true,
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: t.serie,
          // Anel na cor da superfície: o ponto continua legível onde
          // cruza a linha, e aumenta a área de acerto do mouse.
          pointBorderColor: t.superficie,
          pointBorderWidth: 2,
          pointHitRadius: 14,
        },
      ],
    },
    options: {
      ...base,
      scales: {
        ...base.scales,
        y: {
          ...base.scales.y,
          beginAtZero: true,
          max: 100,
          ticks: { ...base.scales.y.ticks, callback: (v) => `${v}%` },
        },
      },
    },
  });
}

/** Percentual de acerto por disciplina, somando todos os simulados. */
export function acertosPorDisciplina(canvas, blocos) {
  const t = tokens();
  const base = opcoesBase(t, {
    formatarValor: (v, ctx) => {
      const bloco = blocos[ctx.dataIndex];
      return `${v}% · ${bloco.acertos} de ${bloco.validas}`;
    },
  });

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: blocos.map((b) => b.nome),
      datasets: [
        {
          data: blocos.map((b) => b.percentual),
          backgroundColor: t.serie,
          // Ponta arredondada, base reta na linha de origem.
          borderRadius: { topLeft: 0, topRight: 4, bottomLeft: 0, bottomRight: 4 },
          borderSkipped: false,
          maxBarThickness: 24,
        },
      ],
    },
    options: {
      ...base,
      indexAxis: "y", // nomes de disciplina são longos: barra deitada
      scales: {
        x: {
          ...base.scales.y,
          beginAtZero: true,
          max: 100,
          ticks: { ...base.scales.y.ticks, callback: (v) => `${v}%` },
        },
        y: {
          ...base.scales.x,
          ticks: { ...base.scales.x.ticks, font: { family: t.fonte, size: 12 } },
        },
      },
    },
  });
}

/** Horas estudadas por dia, nos últimos 14 dias. */
export function horasPorDia(canvas, serie) {
  const t = tokens();
  const base = opcoesBase(t, {
    formatarValor: (v) =>
      v ? `${String(v).replace(".", ",")} h estudadas` : "nada registrado",
  });

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: serie.map((p) => p.rotulo),
      datasets: [
        {
          data: serie.map((p) => p.horas),
          backgroundColor: t.serie,
          borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: false,
          maxBarThickness: 24,
        },
      ],
    },
    options: {
      ...base,
      scales: {
        ...base.scales,
        y: {
          ...base.scales.y,
          beginAtZero: true,
          ticks: {
            ...base.scales.y.ticks,
            precision: 1,
            callback: (v) => `${String(v).replace(".", ",")} h`,
          },
        },
      },
    },
  });
}

/* ─────────────────────── apoio ─────────────────────── */

/**
 * Envolve o canvas num bloco com título e tabela de dados.
 *
 * A tabela não é enfeite: é o que garante que o gráfico não seja o
 * único caminho até os números, para quem usa leitor de tela, imprime,
 * ou simplesmente quer o valor exato.
 */
export function bloco({ id, titulo, subtitulo, altura = 260, colunas, linhas }) {
  return `
    <section class="card grafico">
      <div class="card__cabecalho">
        <div>
          <h2 class="card__titulo">${esc(titulo)}</h2>
          ${
            subtitulo
              ? `<p class="texto-muted" style="margin:2px 0 0;font-size:.8rem">
                   ${esc(subtitulo)}</p>`
              : ""
          }
        </div>
      </div>

      <div class="grafico__tela" style="height:${altura}px">
        <canvas id="${esc(id)}"></canvas>
      </div>

      ${
        linhas?.length
          ? `<details class="grafico__dados">
               <summary>Ver os números</summary>
               <div class="tabela-envolve" style="margin-top:10px">
                 <table class="tabela">
                   <thead><tr>${colunas
                     .map((c) => `<th>${esc(c)}</th>`)
                     .join("")}</tr></thead>
                   <tbody>
                     ${linhas
                       .map(
                         (linha) =>
                           `<tr>${linha
                             .map((celula) => `<td>${esc(celula)}</td>`)
                             .join("")}</tr>`
                       )
                       .join("")}
                   </tbody>
                 </table>
               </div>
             </details>`
          : ""
      }
    </section>`;
}

/**
 * Redesenha os gráficos quando o tema muda.
 *
 * O Chart.js guarda as cores no momento da criação, então trocar o tema
 * deixaria o gráfico com as cores do tema anterior.
 */
export function aoTrocarTema(redesenhar) {
  const observador = new MutationObserver((mudancas) => {
    if (mudancas.some((m) => m.attributeName === "data-theme")) redesenhar();
  });
  observador.observe(document.documentElement, { attributes: true });
  return () => observador.disconnect();
}
