/**
 * POST /api/jev/orquestrar
 *
 * O Jev decide: hipotese simbolica, vinculos com IDs, lacunas, perguntas
 * neutras, passos e proxima lamina. Nao redige o texto final (isso e do
 * Gemini) e nao decide bandeira (isso e regra deterministica no cliente).
 */
import { NextResponse } from "next/server";
import { zDecisaoJev, zPedidoOrquestracao } from "@/lib/schemas";
import { promptOrquestrador } from "@/lib/prompts";
import {
  chamarJev,
  ErroIA,
  extrairJson,
  iaDesabilitada,
} from "@/lib/ia-servidor";
import { CATALOGO } from "@/data/laminas";

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

  const entrada = zPedidoOrquestracao.safeParse(bruto);
  if (!entrada.success) {
    return NextResponse.json(
      { erro: "Payload rejeitado.", detalhe: entrada.error.flatten() },
      { status: 400 },
    );
  }

  const idsValidosResposta = new Set(
    entrada.data.fichaTrechos.map((t) => t.respostaId),
  );
  const idsValidosEvento = new Set(entrada.data.eventos.map((e) => e.eventoId));
  const idsLamina = new Set(CATALOGO.filter((l) => l.configurada).map((l) => l.id));

  try {
    const { texto, modelo } = await chamarJev(
      promptOrquestrador(entrada.data),
    );
    const analisado = zDecisaoJev.safeParse(extrairJson(texto));
    if (!analisado.success) {
      return NextResponse.json(
        {
          erro: "O modelo devolveu uma estrutura fora do contrato.",
          detalhe: analisado.error.flatten(),
        },
        { status: 502 },
      );
    }

    const decisao = analisado.data;

    // Controle fora do prompt: descarta o que cita ID inexistente.
    const vinculosOriginais = decisao.vinculosDeApoio.length;
    decisao.vinculosDeApoio = decisao.vinculosDeApoio.filter(
      (v) =>
        idsValidosResposta.has(v.respostaId) && idsValidosEvento.has(v.eventoId),
    );
    const vinculosDescartados = vinculosOriginais - decisao.vinculosDeApoio.length;

    decisao.acoesSugeridas = decisao.acoesSugeridas.map((a) => ({
      ...a,
      apoio: a.apoio.filter((id) => idsValidosResposta.has(id)),
    }));

    if (decisao.proximaLaminaId && !idsLamina.has(decisao.proximaLaminaId)) {
      decisao.proximaLaminaId = null;
      decisao.proximaLaminaMotivo =
        "A lâmina sugerida pelo modelo não existe no catálogo; sugestão descartada.";
    }

    // Sem vinculo valido, nao existe associacao a apresentar.
    if (decisao.vinculosDeApoio.length === 0 && decisao.status === "rascunho") {
      decisao.status = "inconclusivo";
      decisao.contradicoesELacunas.push(
        "Nenhum vínculo citado pelo modelo pôde ser verificado contra os IDs enviados. A associação foi descartada.",
      );
    }
    if (vinculosDescartados > 0) {
      decisao.contradicoesELacunas.push(
        `${vinculosDescartados} vínculo(s) citavam IDs que não existem nesta sessão e foram descartados.`,
      );
    }

    return NextResponse.json({ decisao, modelo });
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
