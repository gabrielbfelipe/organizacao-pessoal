/* ════════════════════════════════════════════════════════════════════
   Ordo — a única porta de saída para o backend

   Nenhuma página chama fetch() direto. Centralizar aqui garante que o
   Content-Type de JSON (exigido pelo backend contra CSRF), o tratamento
   de 401 e o formato de erro sejam sempre os mesmos.
   ══════════════════════════════════════════════════════════════════ */

const BASE = "/api";

export class ErroApi extends Error {
  constructor(mensagem, status, campos) {
    super(mensagem);
    this.name = "ErroApi";
    this.status = status;
    this.campos = campos || {};
  }
}

function paraLogin() {
  if (!location.pathname.endsWith("login.html")) {
    location.href = "/login.html";
  }
}

async function requisicao(metodo, caminho, corpo) {
  const opcoes = {
    method: metodo,
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  };

  if (corpo !== undefined) {
    opcoes.headers["Content-Type"] = "application/json";
    opcoes.body = JSON.stringify(corpo);
  }

  let resposta;
  try {
    resposta = await fetch(BASE + caminho, opcoes);
  } catch {
    throw new ErroApi("Sem resposta do servidor. Ele está rodando?", 0);
  }

  if (resposta.status === 401) {
    paraLogin();
    throw new ErroApi("Sessão expirada.", 401);
  }

  if (resposta.status === 204) return null;

  const tipo = resposta.headers.get("Content-Type") || "";
  const dados = tipo.includes("application/json")
    ? await resposta.json().catch(() => null)
    : null;

  if (!resposta.ok) {
    const mensagem = dados?.erro || `Erro ${resposta.status}.`;
    throw new ErroApi(mensagem, resposta.status, dados?.campos);
  }

  return dados;
}

/** Monta ?a=1&b=2 ignorando valores vazios. */
function query(params) {
  if (!params) return "";
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== "") {
      busca.set(chave, valor);
    }
  }
  const texto = busca.toString();
  return texto ? `?${texto}` : "";
}

export const api = {
  get: (caminho, params) => requisicao("GET", caminho + query(params)),
  post: (caminho, corpo) => requisicao("POST", caminho, corpo ?? {}),
  put: (caminho, corpo) => requisicao("PUT", caminho, corpo ?? {}),
  patch: (caminho, corpo) => requisicao("PATCH", caminho, corpo ?? {}),
  del: (caminho) => requisicao("DELETE", caminho),

  /** Uploads são a exceção declarada: multipart, sem Content-Type manual. */
  async upload(caminho, formData) {
    const resposta = await fetch(BASE + caminho, {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    });

    if (resposta.status === 401) {
      paraLogin();
      throw new ErroApi("Sessão expirada.", 401);
    }

    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      throw new ErroApi(dados?.erro || "Falha no envio do arquivo.", resposta.status);
    }
    return dados;
  },
};
