/**
 * Validacao nas fronteiras: o que entra nas rotas /api e o que a IA devolve.
 *
 * Dossie, p. 38 ("Controles fora do prompt"): "Validar campos e IDs no servidor;
 * [...] Um prompt isolado nao garante esses comportamentos."
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Payload enviado ao orquestrador. Ja desidentificado no cliente.
// ---------------------------------------------------------------------------
export const zTrechoFicha = z.object({
  respostaId: z.string().min(1).max(32),
  perguntaTexto: z.string().min(1).max(400),
  trecho: z.string().min(1).max(1200),
  tags: z.array(z.string().max(40)).max(12).default([]),
  origem: z.string().max(40),
});

export const zEventoConfirmado = z.object({
  eventoId: z.string().min(1).max(32),
  perguntaTexto: z.string().min(1).max(400),
  laminaNome: z.string().min(1).max(120),
  laminaVersao: z.number().int().nonnegative(),
  modoEntrada: z.enum(["manual", "camera"]),
  movimento: z.string().max(40).optional(),
  zonaRotulo: z.string().max(120).optional(),
  zonaSignificado: z.string().max(600).optional(),
  zonaTags: z.array(z.string().max(40)).max(12).default([]),
  valor: z
    .object({
      numero: z.number(),
      unidade: z.string().max(20),
      min: z.number(),
      max: z.number(),
    })
    .optional(),
  statusResultado: z.enum([
    "confirmado_pelo_terapeuta",
    "inconclusivo",
    "pendente",
    "lamina_nao_configurada",
  ]),
  motivosAbstencao: z.array(z.string().max(60)).max(12).default([]),
});

export const zPedidoOrquestracao = z.object({
  /** Tema declarado da sessao. */
  tema: z.string().min(1).max(200),
  /** Preferencia de linguagem (B14). */
  preferenciaLinguagem: z.enum(["espiritual", "simbolica", "neutra"]),
  /** B15: temas que a pessoa nao deseja abordar. A IA deve respeitar. */
  assuntosEvitados: z.array(z.string().max(120)).max(20).default([]),
  /** Modulos usados, com o limite de interpretacao de cada um. */
  modulos: z
    .array(
      z.object({
        id: z.string().max(32),
        titulo: z.string().max(200),
        limiteInterpretacao: z.string().max(600),
      }),
    )
    .max(14),
  fichaTrechos: z.array(zTrechoFicha).max(200),
  eventos: z.array(zEventoConfirmado).max(60),
  /** Bandeiras ja detectadas por regra. A IA nao decide isso. */
  bandeiras: z
    .array(z.object({ tipo: z.string().max(60), trecho: z.string().max(400) }))
    .max(20)
    .default([]),
  /** Laminas disponiveis, para a IA sugerir a proxima. */
  laminasDisponiveis: z
    .array(
      z.object({
        id: z.string().max(60),
        nome: z.string().max(120),
        tagsIndicacao: z.array(z.string().max(40)).max(20),
        configurada: z.boolean(),
      }),
    )
    .max(80)
    .default([]),
});
export type PedidoOrquestracao = z.infer<typeof zPedidoOrquestracao>;

// ---------------------------------------------------------------------------
// Resposta do Jev. Estrutura exigida; nada fora dela e aceito.
// ---------------------------------------------------------------------------
export const zDecisaoJev = z.object({
  status: z.enum([
    "rascunho",
    "dados_insuficientes",
    "inconclusivo",
    "precisa_revisao",
  ]),
  /** Hipotese simbolica. Precisa citar IDs nos vinculos abaixo. */
  interpretacaoSimbolica: z.string().max(2500),
  vinculosDeApoio: z
    .array(
      z.object({
        temaDoSimbolo: z.string().max(160),
        respostaId: z.string().max(32),
        trecho: z.string().max(600),
        eventoId: z.string().max(32),
      }),
    )
    .max(40)
    .default([]),
  contradicoesELacunas: z.array(z.string().max(600)).max(30).default([]),
  perguntasDeConfirmacao: z.array(z.string().max(400)).max(20).default([]),
  acoesSugeridas: z
    .array(
      z.object({
        prazo: z.enum(["agora", "curto", "medio", "longo"]),
        texto: z.string().max(500),
        apoio: z.array(z.string().max(32)).max(10).default([]),
      }),
    )
    .max(24)
    .default([]),
  /** Proxima lamina a investigar, por ID do catalogo. */
  proximaLaminaId: z.string().max(60).nullable().default(null),
  proximaLaminaMotivo: z.string().max(500).default(""),
  limites: z.array(z.string().max(400)).max(20).default([]),
});
export type DecisaoJev = z.infer<typeof zDecisaoJev>;

// ---------------------------------------------------------------------------
// Redacao final pelo Gemini: texto na voz do terapeuta, para o PDF.
// ---------------------------------------------------------------------------
export const zPedidoRedacao = z.object({
  nomePessoa: z.string().min(1).max(120),
  nomeTerapeuta: z.string().min(1).max(120),
  tema: z.string().max(200),
  preferenciaLinguagem: z.enum(["espiritual", "simbolica", "neutra"]),
  assuntosEvitados: z.array(z.string().max(120)).max(20).default([]),
  decisao: zDecisaoJev,
  resultadoObservado: z.array(z.string().max(600)).max(60),
  encaminhamentos: z.array(z.string().max(400)).max(20).default([]),
  bandeiras: z
    .array(z.object({ tipo: z.string().max(60), trecho: z.string().max(400) }))
    .max(20)
    .default([]),
});
export type PedidoRedacao = z.infer<typeof zPedidoRedacao>;

export const zRedacao = z.object({
  /** Abertura curta, falando com a pessoa. */
  abertura: z.string().max(1200),
  /** O que foi observado, em linguagem simples. */
  oQueObservamos: z.string().max(2500),
  /** Relacao com o que a pessoa contou. */
  oQueVoceContou: z.string().max(2500),
  /** Hipotese de conversa, marcada como simbolica. */
  comoIssoSeConversa: z.string().max(2500),
  /** O que ficou sem resposta. */
  oQueFicouEmAberto: z.string().max(1500),
  /** Perguntas para a pessoa pensar. */
  perguntasParaVoce: z.array(z.string().max(300)).max(12).default([]),
  passos: z.object({
    agora: z.array(z.string().max(300)).max(8).default([]),
    curto: z.array(z.string().max(300)).max(8).default([]),
    medio: z.array(z.string().max(300)).max(8).default([]),
    longo: z.array(z.string().max(300)).max(8).default([]),
  }),
  /** Encaminhamento, quando houver. Linguagem acolhedora, sem alarme. */
  encaminhamento: z.string().max(1200).default(""),
  /** Fechamento curto. */
  fechamento: z.string().max(800),
});
export type Redacao = z.infer<typeof zRedacao>;

// ---------------------------------------------------------------------------
// Visao: identificar qual lamina esta na mesa
// ---------------------------------------------------------------------------
export const zPedidoVisao = z.object({
  /** Imagem em base64, sem o prefixo data:. Limite de ~2 MB. */
  imagemBase64: z.string().min(100).max(2_800_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  candidatas: z
    .array(
      z.object({
        id: z.string().max(60),
        nome: z.string().max(120),
        descricaoVisual: z.string().max(400),
      }),
    )
    .min(1)
    .max(60),
});

export const zRespostaVisao = z.object({
  /** null quando o modelo nao reconhece com seguranca. */
  laminaId: z.string().max(60).nullable(),
  confiancaDeclarada: z.enum(["alta", "media", "baixa", "nenhuma"]),
  justificativa: z.string().max(600),
  /** O que impediu o reconhecimento, se for o caso. */
  impedimentos: z.array(z.string().max(200)).max(10).default([]),
});
export type RespostaVisao = z.infer<typeof zRespostaVisao>;
