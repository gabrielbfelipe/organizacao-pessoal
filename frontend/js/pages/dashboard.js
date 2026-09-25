/* ════════════════════════════════════════════════════════════════════
   Ordo — Dashboard

   Um único request (/api/dashboard) pinta o painel inteiro: nenhum
   cartão faz a sua própria chamada.

   O card "Minha próxima escala" fica em destaque no topo, separado do
   resto, com contagem regressiva ao vivo — é o que o planejamento pede
   e o que mais importa no dia a dia.

   Cartões sem conteúdo não aparecem, em vez de ocupar a grade com
   caixas vazias.
   ══════════════════════════════════════════════════════════════════ */

import { api } from "../core/api.js";
import * as fmt from "../core/fmt.js";
import { contexto, definirTitulo, montar } from "../core/layout.js";
import { esc, falha, icone, renderizarIcones, sucesso, vazio } from "../core/ui.js";

const BADGE_STATUS = {
  pendente: "badge--ouro",
  confirmada: "badge--sucesso",
  troca_solicitada: "badge--perigo",
};

const ROTULO_STATUS = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  troca_solicitada: "Troca solicitada",
};

const ROTULO_TIPO_HORARIO = {
  missa: "missa",
  confissao: "confissão",
  adoracao: "adoração",
};

const estado = { dados: null, conteudo: null, cronometro: null };

/* ─────────────────── card da próxima escala ─────────────────── */

function cardEscala(dados) {
  const escala = dados.proxima_escala;

  if (!escala) {
    return `
      <section class="card card--destaque grade-dashboard__destaque">
        <p class="card__rotulo">Minha próxima escala</p>
        ${vazio({
          icone: "church",
          titulo: "Nenhuma escala à frente",
          texto: "Cadastre a escala do mês para vê-la aqui com a contagem regressiva.",
          acao: `<a class="btn btn--ouro btn--pequeno" href="/pages/igreja-escalas.html">
                   Cadastrar escala</a>`,
        })}
      </section>`;
  }

  const diaSemana = fmt.capitalizar(
    fmt.paraData(escala.data).toLocaleDateString("pt-BR", { weekday: "long" })
  );

  return `
    <section class="card card--destaque grade-dashboard__destaque escala-card">
      <div class="linha-espalhada" style="align-items:flex-start;flex-wrap:wrap">
        <div>
          <p class="card__rotulo">Minha próxima escala</p>
          <h2 class="escala-card__celebracao">${esc(escala.celebracao)}</h2>
          <p class="escala-card__quando">
            ${esc(diaSemana)}, ${esc(fmt.data(escala.data))}
            às ${esc(fmt.hora(escala.horario))}
            ${escala.local ? ` · ${esc(escala.local)}` : ""}
          </p>
        </div>

        <div class="escala-card__contagem">
          <div class="escala-card__relogio" data-contagem
               data-inicio="${esc(escala.inicio)}">
            ${esc(fmt.contagem(escala.inicio))}
          </div>
          <div class="escala-card__relogio-rotulo">${esc(fmt.relativo(escala.data))}</div>
        </div>
      </div>

      <div class="escala-card__rodape">
        ${
          escala.funcao
            ? `<span class="badge badge--ouro">${icone("hand")}${esc(escala.funcao)}</span>`
            : ""
        }
        <span class="badge ${BADGE_STATUS[escala.status] || ""}">
          <span class="badge__ponto"></span>${esc(ROTULO_STATUS[escala.status])}
        </span>
        ${
          dados.escalas_pendentes
            ? `<span class="badge">${dados.escalas_pendentes} pendente${
                dados.escalas_pendentes > 1 ? "s" : ""
              } à frente</span>`
            : ""
        }
        <div class="crescer"></div>
        ${
          escala.status !== "confirmada"
            ? `<button class="btn btn--ouro btn--pequeno" data-confirmar="${escala.id}">
                 ${icone("check")} Confirmar presença
               </button>`
            : ""
        }
        <a class="btn btn--contorno btn--pequeno" href="/pages/igreja-escalas.html">
          Ver a escala
        </a>
      </div>

      ${
        escala.observacoes
          ? `<p class="escala-card__obs">${icone("message-square")}
               <span>${esc(escala.observacoes)}</span></p>`
          : ""
      }
    </section>`;
}

/* ─────────────────── agenda, lembretes e avisos ─────────────────── */

function itemCompromisso(c) {
  const d = fmt.paraData(c.inicio);
  return `
    <div class="item-lista">
      <div class="item-lista__data" ${
        c.categoria ? `style="border-color:${esc(c.categoria.cor)}"` : ""
      }>
        <span class="item-lista__dia">${d.getDate()}</span>
        <span class="item-lista__mes">${esc(
          d.toLocaleDateString("pt-BR", { month: "short" })
        )}</span>
      </div>
      <div class="crescer" style="min-width:0">
        <div class="truncar">${esc(c.titulo)}</div>
        <div class="texto-muted" style="font-size:.78rem">
          ${c.dia_inteiro ? "Dia inteiro" : esc(fmt.hora(c.inicio))}${
            c.local ? ` · ${esc(c.local)}` : ""
          }
        </div>
      </div>
      ${
        c.categoria
          ? `<span class="amostra-cor amostra-cor--pequena"
                   style="background:${esc(c.categoria.cor)}"
                   title="${esc(c.categoria.nome)}"></span>`
          : ""
      }
    </div>`;
}

function cardAgenda(dados) {
  const hoje = dados.compromissos_hoje;
  const semana = dados.compromissos_semana;

  const corpo =
    hoje.length || semana.length
      ? `
      ${
        hoje.length
          ? `<p class="card__rotulo">Hoje</p>${hoje.map(itemCompromisso).join("")}`
          : `<p class="texto-muted" style="margin:0 0 4px;font-size:.88rem">
               Nada marcado para hoje.</p>`
      }
      ${
        semana.length
          ? `<p class="card__rotulo" style="margin-top:16px">Próximos 7 dias</p>
             ${semana.map(itemCompromisso).join("")}`
          : ""
      }`
      : `<p class="texto-muted" style="margin:0;font-size:.88rem">
           Nenhum compromisso nos próximos dias.</p>`;

  return `
    <section class="card">
      <div class="card__cabecalho">
        <h2 class="card__titulo">Agenda</h2>
        <a class="btn btn--fantasma btn--pequeno" href="/pages/agenda.html">
          Abrir ${icone("arrow-right")}
        </a>
      </div>
      ${corpo}
    </section>`;
}

function cardLembretes(lembretes) {
  if (!lembretes.length) return "";
  return `
    <section class="card">
      <div class="card__cabecalho">
        <h2 class="card__titulo">Lembretes</h2>
        <span class="badge badge--ouro">${lembretes.length}</span>
      </div>
      ${lembretes
        .map(
          (l) => `
        <div class="item-lista">
          ${icone("bell")}
          <div class="crescer" style="min-width:0">
            <div class="truncar">${esc(l.titulo)}</div>
            <div class="texto-muted" style="font-size:.78rem">
              ${esc(fmt.dataHora(l.disparar_em))}
            </div>
          </div>
        </div>`
        )
        .join("")}
    </section>`;
}

function cardAvisos(avisos) {
  if (!avisos.length) return "";
  return `
    <section class="card">
      <div class="card__cabecalho">
        <h2 class="card__titulo">Avisos fixados</h2>
        <a class="btn btn--fantasma btn--pequeno" href="/pages/avisos.html">
          Quadro ${icone("arrow-right")}
        </a>
      </div>
      ${avisos
        .map(
          (a) => `
        <div class="item-lista">
          <span class="amostra-cor amostra-cor--pequena"
                style="background:${esc(a.cor)}"></span>
          <div class="crescer" style="min-width:0">
            <div class="truncar">${esc(a.titulo)}</div>
            ${
              a.conteudo
                ? `<div class="texto-muted truncar" style="font-size:.78rem">
                     ${esc(a.conteudo)}</div>`
                : ""
            }
          </div>
        </div>`
        )
        .join("")}
    </section>`;
}

/* ─────────────────── tarefas ─────────────────── */

function itemTarefa(t, atrasada) {
  return `
    <div class="item-lista">
      ${icone(atrasada ? "circle-alert" : "square")}
      <div class="crescer" style="min-width:0">
        <div class="truncar">${esc(t.titulo)}</div>
        <div class="texto-muted" style="font-size:.78rem">
          ${t.prazo ? esc(fmt.relativo(t.prazo)) : "sem prazo"}
          ${t.modulo !== "geral" ? ` · ${esc(t.modulo)}` : ""}
        </div>
      </div>
      ${t.prioridade === "alta" ? `<span class="badge badge--perigo">Alta</span>` : ""}
    </div>`;
}

function cardTarefas(dados) {
  const hoje = dados.tarefas_hoje;
  const atrasadas = dados.tarefas_atrasadas;
  if (!hoje.length && !atrasadas.length) return "";

  return `
    <section class="card">
      <div class="card__cabecalho">
        <h2 class="card__titulo">Tarefas</h2>
        <a class="btn btn--fantasma btn--pequeno" href="/pages/tarefas.html">
          Quadro ${icone("arrow-right")}
        </a>
      </div>

      ${
        atrasadas.length
          ? `<p class="card__rotulo" style="color:var(--danger-texto)">
               ${atrasadas.length} atrasada${atrasadas.length > 1 ? "s" : ""}
             </p>
             ${atrasadas.map((t) => itemTarefa(t, true)).join("")}`
          : ""
      }

      ${
        hoje.length
          ? `<p class="card__rotulo" ${atrasadas.length ? 'style="margin-top:16px"' : ""}>
               Para hoje
             </p>
             ${hoje.map((t) => itemTarefa(t, false)).join("")}`
          : ""
      }
    </section>`;
}

/* ─────────────────── igreja ─────────────────── */

function cardLiturgia(liturgia) {
  if (!liturgia) return "";
  return `
    <section class="card">
      <p class="card__rotulo">Tempo litúrgico</p>
      <div class="linha" style="gap:14px;align-items:flex-start">
        <span class="amostra-cor" style="background:${esc(liturgia.cor_hex)}"></span>
        <div class="crescer">
          <h3 style="margin:0 0 2px">${esc(liturgia.tempo)}</h3>
          <p class="texto-muted" style="margin:0;font-size:.86rem">
            Cor litúrgica: ${esc(liturgia.cor)}
          </p>
          ${
            liturgia.celebracao
              ? `<p class="serif" style="margin:8px 0 0;font-size:1.05rem;color:var(--gold-texto)">
                   ${esc(liturgia.celebracao)}</p>`
              : ""
          }
        </div>
      </div>
    </section>`;
}

function cardOracao(oracao) {
  if (!oracao) return "";

  // Só as primeiras linhas: o texto inteiro é o modo Rezar.
  const linhas = (oracao.texto || "").split("\n");
  const previa = linhas.slice(0, 4).join("\n");

  return `
    <section class="card">
      <div class="card__cabecalho">
        <h2 class="card__titulo">Oração do momento</h2>
      </div>
      <h3 class="serif" style="margin:0 0 8px;font-size:1.2rem;color:var(--gold-texto)">
        ${esc(oracao.titulo)}
      </h3>
      <p class="serif" style="margin:0 0 14px;font-size:1.02rem;line-height:1.7;
                              white-space:pre-wrap">${esc(previa)}${
                                linhas.length > 4 ? "…" : ""
                              }</p>
      <a class="btn btn--contorno btn--pequeno" href="/pages/igreja-oracoes.html">
        ${icone("book-open")} Rezar
      </a>
    </section>`;
}

function cardIgreja(dados) {
  const evento = dados.proximo_evento_igreja;
  const confissao = dados.proxima_confissao;
  const seguintes = dados.escalas_seguintes;

  if (!evento && !confissao && !seguintes.length) return "";

  return `
    <section class="card">
      <div class="card__cabecalho">
        <h2 class="card__titulo">Na paróquia</h2>
        <a class="btn btn--fantasma btn--pequeno" href="/pages/igreja-eventos.html">
          Eventos ${icone("arrow-right")}
        </a>
      </div>

      ${
        evento
          ? `<div class="item-lista">
               ${icone("calendar-heart")}
               <div class="crescer" style="min-width:0">
                 <div class="truncar">${esc(evento.titulo)}</div>
                 <div class="texto-muted" style="font-size:.78rem">
                   ${esc(fmt.relativo(evento.data_hora))} às
                   ${esc(fmt.hora(evento.data_hora))}
                   ${evento.local ? ` · ${esc(evento.local)}` : ""}
                 </div>
               </div>
             </div>`
          : ""
      }

      ${
        confissao
          ? `<div class="item-lista">
               ${icone("hand-heart")}
               <div class="crescer" style="min-width:0">
                 <div>Próxima ${esc(
                   ROTULO_TIPO_HORARIO[confissao.tipo] || confissao.tipo
                 )}</div>
                 <div class="texto-muted" style="font-size:.78rem">
                   ${esc(fmt.relativo(confissao.quando))} às
                   ${esc(fmt.hora(confissao.quando))}
                   ${confissao.local ? ` · ${esc(confissao.local)}` : ""}
                 </div>
               </div>
             </div>`
          : ""
      }

      ${
        seguintes.length
          ? `<p class="card__rotulo" style="margin-top:14px">Escalas seguintes</p>
             ${seguintes
               .slice(0, 3)
               .map(
                 (e) => `
               <div class="item-lista">
                 <div class="item-lista__data">
                   <span class="item-lista__dia">${fmt.paraData(e.data).getDate()}</span>
                   <span class="item-lista__mes">${esc(
                     fmt
                       .paraData(e.data)
                       .toLocaleDateString("pt-BR", { month: "short" })
                   )}</span>
                 </div>
                 <div class="crescer" style="min-width:0">
                   <div class="truncar">${esc(e.celebracao)}</div>
                   <div class="texto-muted" style="font-size:.78rem">
                     ${esc(fmt.hora(e.horario))}${e.funcao ? ` · ${esc(e.funcao)}` : ""}
                   </div>
                 </div>
               </div>`
               )
               .join("")}`
          : ""
      }
    </section>`;
}

/* ─────────────────── estudos ─────────────────── */

function cardEstudos(estudos) {
  const ultimo = estudos.ultimo_simulado;
  if (!estudos.horas_semana && !ultimo) return "";

  const corNota =
    ultimo?.percentual >= 70
      ? "var(--success-texto)"
      : ultimo?.percentual < 50
        ? "var(--danger-texto)"
        : "var(--gold-texto)";

  return `
    <section class="card">
      <div class="card__cabecalho">
        <h2 class="card__titulo">Estudos</h2>
        <a class="btn btn--fantasma btn--pequeno" href="/pages/estudos-simulados.html">
          Abrir ${icone("arrow-right")}
        </a>
      </div>

      <div class="linha" style="gap:26px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <div style="font-family:var(--fonte-titulo);font-size:2rem;font-weight:600;
                      line-height:1;color:var(--titulo)">
            ${esc(fmt.horas(estudos.horas_semana))}
          </div>
          <div class="texto-muted" style="font-size:.72rem;text-transform:uppercase;
                      letter-spacing:.06em;margin-top:4px">nesta semana</div>
        </div>

        ${
          ultimo
            ? `<div>
                 <div style="font-family:var(--fonte-titulo);font-size:2rem;
                             font-weight:600;line-height:1;color:${corNota}">
                   ${
                     ultimo.percentual === null
                       ? "—"
                       : esc(fmt.porcentagem(ultimo.percentual, 0))
                   }
                 </div>
                 <div class="texto-muted" style="font-size:.72rem;text-transform:uppercase;
                             letter-spacing:.06em;margin-top:4px">último simulado</div>
               </div>`
            : ""
        }
      </div>

      ${
        ultimo
          ? `<p class="texto-muted" style="margin:14px 0 0;font-size:.82rem">
               ${esc(ultimo.titulo)} · ${esc(fmt.data(ultimo.data))}
               ${ultimo.validas ? ` · ${ultimo.acertos} de ${ultimo.validas}` : ""}
             </p>`
          : ""
      }
    </section>`;
}

/* ─────────────────── contagem regressiva ─────────────────── */

function iniciarCronometro() {
  clearInterval(estado.cronometro);
  const alvo = estado.conteudo.querySelector("[data-contagem]");
  if (!alvo) return;

  const inicio = alvo.dataset.inicio;
  estado.cronometro = setInterval(() => {
    // Se o elemento saiu do DOM num re-render, encerra o intervalo.
    if (!alvo.isConnected) return clearInterval(estado.cronometro);
    alvo.textContent = fmt.contagem(inicio);
  }, 1000);
}

/* ─────────────────── render e eventos ─────────────────── */

function render() {
  const d = estado.dados;

  // O card da escala fica sozinho no topo, em largura cheia; o resto
  // empilha em colunas, na ordem em que interessa olhar.
  estado.conteudo.innerHTML = `
    <div style="margin-bottom:18px">${cardEscala(d)}</div>
    <div class="massa-dashboard">
      ${cardAgenda(d)}
      ${cardTarefas(d)}
      ${cardIgreja(d)}
      ${cardLembretes(d.lembretes_pendentes)}
      ${cardAvisos(d.avisos_fixados)}
      ${cardEstudos(d.estudos)}
      ${cardLiturgia(d.liturgia)}
      ${cardOracao(d.oracao_do_momento)}
    </div>`;

  renderizarIcones();
  iniciarCronometro();

  estado.conteudo
    .querySelector("[data-confirmar]")
    ?.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.confirmar;
      try {
        await api.patch(`/igreja/escalas/${id}/status`, { status: "confirmada" });
        sucesso("Presença confirmada.");
        await carregar();
      } catch (erro) {
        falha(erro);
      }
    });
}

async function carregar() {
  estado.dados = await api.get("/dashboard");
  render();
}

async function iniciar() {
  try {
    const { conteudo } = await montar({ pagina: "dashboard", titulo: "Dashboard" });
    estado.conteudo = conteudo;

    // O nome do usuário só existe depois de montar().
    const primeiroNome = (contexto.usuario?.nome || "").split(" ")[0];
    definirTitulo(primeiroNome ? `${fmt.saudacao()}, ${primeiroNome}` : "Dashboard");

    await carregar();

    // Um lembrete que dispara muda o painel: recarrega em vez de ficar velho.
    document.addEventListener("ordo:lembretes", () => carregar());
  } catch (e) {
    if (e?.status === 401) return;
    document.body.innerHTML = `<div class="carregando">
      Não foi possível carregar o Ordo.</div>`;
    falha(e);
  }
}

iniciar();
