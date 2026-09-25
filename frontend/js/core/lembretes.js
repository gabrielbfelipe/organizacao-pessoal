/* ════════════════════════════════════════════════════════════════════
   Ordo — lembretes no navegador

   Não há agendador no servidor: esta é a peça que faz os lembretes
   acontecerem. Roda em todas as páginas, carregada pelo layout.

   A permissão de notificação só é pedida depois de um clique — os
   navegadores bloqueiam o pedido automático, e um pedido negado logo na
   primeira visita é definitivo.
   ══════════════════════════════════════════════════════════════════ */

import { api } from "./api.js";
import { toast } from "./ui.js";

const INTERVALO = 60_000;
const CHAVE_PEDIDO = "ordo:notificacao-pedida";

let temporizador = null;

function suportaNotificacao() {
  return typeof Notification !== "undefined";
}

export function estadoPermissao() {
  if (!suportaNotificacao()) return "indisponivel";
  return Notification.permission; // "default" | "granted" | "denied"
}

/** Só chame a partir de um clique do usuário. */
export async function pedirPermissao() {
  if (!suportaNotificacao()) {
    toast("Este navegador não suporta notificações.", "aviso");
    return "indisponivel";
  }

  if (Notification.permission === "granted") {
    toast("As notificações já estão ativas.", "sucesso");
    return "granted";
  }

  if (Notification.permission === "denied") {
    toast(
      "As notificações estão bloqueadas. Libere nas permissões do site.",
      "aviso",
      6000
    );
    return "denied";
  }

  const resultado = await Notification.requestPermission();
  try {
    localStorage.setItem(CHAVE_PEDIDO, "1");
  } catch {
    /* sem persistência: o pedido pode reaparecer noutra visita */
  }

  toast(
    resultado === "granted"
      ? "Notificações ativadas."
      : "Sem notificações. Os lembretes ainda aparecem aqui na tela.",
    resultado === "granted" ? "sucesso" : "aviso"
  );
  return resultado;
}

function mostrar(lembrete) {
  const corpo = lembrete.titulo;

  if (estadoPermissao() === "granted") {
    try {
      const n = new Notification("Ordo", { body: corpo, tag: `ordo-${lembrete.id}` });
      n.onclick = () => {
        window.focus();
        n.close();
      };
      return;
    } catch {
      /* alguns navegadores recusam Notification fora de service worker */
    }
  }

  // Sem permissão, o lembrete não se perde: vira um toast mais longo.
  toast(corpo, "aviso", 10_000);
}

async function verificar() {
  let pendentes;
  try {
    pendentes = await api.get("/lembretes/pendentes");
  } catch {
    // Servidor fora do ar ou sessão expirada: tenta de novo no próximo ciclo.
    return;
  }

  for (const lembrete of pendentes) {
    mostrar(lembrete);
    // Marca como enviado logo após mostrar, para não repetir no próximo ciclo.
    try {
      await api.patch(`/lembretes/${lembrete.id}/enviado`);
    } catch {
      /* se falhar, aparece de novo — preferível a sumir em silêncio */
    }
  }

  if (pendentes.length) {
    document.dispatchEvent(
      new CustomEvent("ordo:lembretes", { detail: pendentes })
    );
  }
}

export function iniciar() {
  if (temporizador) return;
  verificar();
  temporizador = setInterval(verificar, INTERVALO);

  // Ao voltar para a aba, confere na hora em vez de esperar o ciclo.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") verificar();
  });
}

export function parar() {
  clearInterval(temporizador);
  temporizador = null;
}
