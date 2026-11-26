/**
 * Chamadas aos provedores de IA. SO roda no servidor: as chaves ficam em
 * process.env e nunca chegam ao navegador.
 */
import "server-only";

export class ErroIA extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detalhe?: string,
  ) {
    super(message);
  }
}

export function iaDesabilitada(): boolean {
  return process.env.IA_DESABILITADA === "true";
}

/** Extrai o primeiro objeto JSON de um texto, tolerando cercas de codigo. */
export function extrairJson(texto: string): unknown {
  const limpo = texto
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(limpo);
  } catch {
    const inicio = limpo.indexOf("{");
    const fim = limpo.lastIndexOf("}");
    if (inicio === -1 || fim <= inicio) {
      throw new ErroIA("O modelo não devolveu JSON.", 502, limpo.slice(0, 400));
    }
    return JSON.parse(limpo.slice(inicio, fim + 1));
  }
}

// ---------------------------------------------------------------------------
// OpenRouter (Jev orquestrador)
// ---------------------------------------------------------------------------
export function modeloJev(): string {
  return process.env.OPENROUTER_JEV_MODEL || "typesafe/jev-router";
}

export async function chamarJev(prompt: string): Promise<{
  texto: string;
  modelo: string;
}> {
  const chave = process.env.OPENROUTER_API_KEY;
  if (!chave) {
    throw new ErroIA(
      "OPENROUTER_API_KEY não está configurada no servidor.",
      503,
    );
  }
  const modelo = modeloJev();

  const resposta = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
      "X-Title": "Radiestesia",
    },
    body: JSON.stringify({
      model: modelo,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
      // O roteador escolhe modelos que raciocinam antes de responder, e o
      // raciocinio consome o mesmo orcamento de tokens. Com orcamento curto a
      // resposta vem vazia, com finish_reason "length". Esforco baixo e
      // orcamento folgado: a tarefa aqui e decidir em JSON, nao redigir.
      reasoning: { effort: "low" },
      max_tokens: 12000,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    throw new ErroIA(
      `OpenRouter respondeu ${resposta.status}.`,
      resposta.status === 401 || resposta.status === 402 ? 503 : 502,
      corpo.slice(0, 400),
    );
  }

  const dados = (await resposta.json()) as {
    choices?: {
      message?: { content?: string };
      finish_reason?: string;
      native_finish_reason?: string;
    }[];
    model?: string;
  };
  const escolha = dados.choices?.[0];
  const texto = escolha?.message?.content ?? "";
  if (!texto) {
    const motivo =
      escolha?.finish_reason ?? escolha?.native_finish_reason ?? "sem motivo";
    throw new ErroIA(
      `OpenRouter devolveu resposta vazia (${motivo}).`,
      502,
      `modelo roteado: ${dados.model ?? modelo}`,
    );
  }
  return { texto, modelo: dados.model ?? modelo };
}

// ---------------------------------------------------------------------------
// Gemini (redacao e visao)
// ---------------------------------------------------------------------------
export function modeloGemini(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

type ParteGemini =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export async function chamarGemini(
  partes: ParteGemini[],
): Promise<{ texto: string; modelo: string }> {
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) {
    throw new ErroIA("GEMINI_API_KEY não está configurada no servidor.", 503);
  }
  const modelo = modeloGemini();

  const resposta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": chave,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: partes }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 4000,
          responseMimeType: "application/json",
        },
        safetySettings: [],
      }),
      signal: AbortSignal.timeout(120_000),
    },
  );

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    throw new ErroIA(
      `Gemini respondeu ${resposta.status}.`,
      resposta.status === 401 || resposta.status === 403 ? 503 : 502,
      corpo.slice(0, 400),
    );
  }

  const dados = (await resposta.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
    }[];
    promptFeedback?: { blockReason?: string };
  };

  if (dados.promptFeedback?.blockReason) {
    throw new ErroIA(
      `O Gemini bloqueou o pedido (${dados.promptFeedback.blockReason}).`,
      502,
    );
  }

  const texto =
    dados.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";

  if (!texto) {
    throw new ErroIA(
      `Gemini devolveu resposta vazia (${dados.candidates?.[0]?.finishReason ?? "sem motivo"}).`,
      502,
    );
  }
  return { texto, modelo };
}
