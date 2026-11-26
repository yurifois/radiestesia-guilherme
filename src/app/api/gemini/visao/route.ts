/**
 * POST /api/gemini/visao
 *
 * Identifica qual lamina esta na mesa, a partir de UMA foto sob demanda.
 * Nunca le resultado nem interpreta movimento: isso e do tracker local.
 *
 * Dossie, p. 25: "Lamina importada nao esta pronta so porque foi fotografada."
 * Reconhecer a prancha nao informa significado, autoria, unidade nem regra.
 */
import { NextResponse } from "next/server";
import { zPedidoVisao, zRespostaVisao } from "@/lib/schemas";
import { promptVisao } from "@/lib/prompts";
import {
  chamarGemini,
  ErroIA,
  extrairJson,
  iaDesabilitada,
} from "@/lib/ia-servidor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (iaDesabilitada()) {
    return NextResponse.json(
      { erro: "A camada de IA está desligada neste ambiente." },
      { status: 503 },
    );
  }

  let bruto: unknown;
  try {
    bruto = await req.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const entrada = zPedidoVisao.safeParse(bruto);
  if (!entrada.success) {
    return NextResponse.json(
      { erro: "Payload rejeitado.", detalhe: entrada.error.flatten() },
      { status: 400 },
    );
  }

  const idsValidos = new Set(entrada.data.candidatas.map((c) => c.id));

  try {
    const { texto, modelo } = await chamarGemini([
      { text: promptVisao(entrada.data.candidatas) },
      {
        inline_data: {
          mime_type: entrada.data.mimeType,
          data: entrada.data.imagemBase64,
        },
      },
    ]);
    const analisado = zRespostaVisao.safeParse(extrairJson(texto));
    if (!analisado.success) {
      return NextResponse.json(
        {
          erro: "O modelo devolveu uma estrutura fora do contrato.",
          detalhe: analisado.error.flatten(),
        },
        { status: 502 },
      );
    }

    const resposta = analisado.data;

    // Controle fora do prompt: id fora da lista nao passa.
    if (resposta.laminaId && !idsValidos.has(resposta.laminaId)) {
      resposta.laminaId = null;
      resposta.confiancaDeclarada = "nenhuma";
      resposta.impedimentos.push(
        "O modelo apontou uma lâmina fora do catálogo; sugestão descartada.",
      );
    }
    // Confianca baixa nao seleciona nada sozinha.
    if (
      resposta.confiancaDeclarada === "baixa" ||
      resposta.confiancaDeclarada === "nenhuma"
    ) {
      resposta.laminaId = null;
    }

    return NextResponse.json({ resposta, modelo });
  } catch (e) {
    if (e instanceof ErroIA) {
      return NextResponse.json(
        { erro: e.message, detalhe: e.detalhe },
        { status: e.status },
      );
    }
    const msg = e instanceof Error ? e.message : "Falha inesperada.";
    return NextResponse.json({ erro: msg }, { status: 502 });
  }
}
