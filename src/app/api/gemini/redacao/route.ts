/**
 * POST /api/gemini/redacao
 *
 * O Gemini redige o texto do PDF seguindo o JSON que o Jev decidiu.
 * Nao acrescenta hipotese, nao inventa passo, nao cria encaminhamento.
 */
import { NextResponse } from "next/server";
import { zPedidoRedacao, zRedacao } from "@/lib/schemas";
import { promptRedacao } from "@/lib/prompts";
import {
  chamarGemini,
  ErroIA,
  extrairJson,
  iaDesabilitada,
} from "@/lib/ia-servidor";

export const runtime = "nodejs";
export const maxDuration = 120;

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

  const entrada = zPedidoRedacao.safeParse(bruto);
  if (!entrada.success) {
    return NextResponse.json(
      { erro: "Payload rejeitado.", detalhe: entrada.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { texto, modelo } = await chamarGemini([
      { text: promptRedacao(entrada.data) },
    ]);
    const analisado = zRedacao.safeParse(extrairJson(texto));
    if (!analisado.success) {
      return NextResponse.json(
        {
          erro: "O modelo devolveu uma estrutura fora do contrato.",
          detalhe: analisado.error.flatten(),
        },
        { status: 502 },
      );
    }

    const redacao = analisado.data;

    // Encaminhamento nao pode ser inventado pelo modelo: ou veio por regra,
    // ou nao existe. Aqui substituimos pelo texto deterministico.
    if (entrada.data.encaminhamentos.length > 0) {
      redacao.encaminhamento = entrada.data.encaminhamentos.join("\n\n");
    } else {
      redacao.encaminhamento = "";
    }

    // Passos nao podem exceder o que o Jev decidiu.
    const permitidos = new Set(
      entrada.data.decisao.acoesSugeridas.map((a) => a.texto.trim()),
    );
    if (permitidos.size === 0) {
      redacao.passos = { agora: [], curto: [], medio: [], longo: [] };
    }

    return NextResponse.json({ redacao, modelo });
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
