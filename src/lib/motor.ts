/**
 * Motor deterministico. Roda ANTES e INDEPENDENTE da IA.
 *
 * Implementa as seis camadas de "Como cruzar anamnese e leitura"
 * (dossie, p. 32) e as "Regras de decisao propostas" da mesma pagina:
 *
 *  - Sem pergunta, versao ou convencao: nao interpretar.
 *  - Captura ambigua: nao selecionar setor por adivinhacao.
 *  - Simbolo sem vinculo com a ficha: apresentar lacuna, nao criar historia.
 *  - Divergencia: preservar o relato e perguntar; nao corrigir a pessoa pelo pendulo.
 *  - Tema de saude ou financas: nao converter associacao em diagnostico ou previsao.
 *
 * E a nota de rodape: "Nao calcular 'probabilidade de verdade energetica'."
 * Por isso aqui nao existe score de confianca na interpretacao.
 */
import { acharLamina, acharZona, LAMINAS_LEITURA } from "@/data/laminas";
import { acharFormulario, acharPergunta, MOTIVO_PARA_MODULOS } from "@/data/formularios";
import type {
  AcaoAcordada,
  AnamneseRespondida,
  BandeiraAcionada,
  BandeiraTipo,
  EventoLeitura,
  Formulario,
  IdFormulario,
  Lamina,
  Pessoa,
  Resposta,
  Sintese,
  VinculoApoio,
} from "./tipos";

export const VERSAO_REGRAS = "regras-1.0.0";

// ===========================================================================
// Camada 1: integridade
// ===========================================================================
export interface Pendencia {
  campo: string;
  mensagem: string;
}

/**
 * Valida se um evento pode ser interpretado. Dossie, p. 32:
 * "Sem pergunta, versao ou convencao: nao interpretar."
 */
export function validarIntegridade(
  evento: EventoLeitura,
  temConvencao: boolean,
): Pendencia[] {
  const p: Pendencia[] = [];
  if (!evento.perguntaTexto.trim()) {
    p.push({ campo: "perguntaTexto", mensagem: "A pergunta exata não foi registrada." });
  }
  const lamina = acharLamina(evento.laminaId);
  if (!lamina) {
    p.push({ campo: "laminaId", mensagem: "Lâmina não encontrada no catálogo." });
  } else {
    if (evento.laminaVersao !== lamina.versao) {
      p.push({ campo: "laminaVersao", mensagem: "A versão da lâmina não corresponde ao cadastro." });
    }
    if (!lamina.configurada) {
      p.push({ campo: "lamina", mensagem: "Lâmina sem manual, geometria ou significado cadastrados." });
    }
    if (evento.zonaId && !acharZona(lamina.id, evento.zonaId)) {
      p.push({ campo: "zonaId", mensagem: "Zona fora da lâmina informada." });
    }
  }
  if (!temConvencao) {
    p.push({ campo: "convencao", mensagem: "A convenção desta sessão não foi registrada." });
  }
  if (evento.statusResultado === "confirmado_pelo_terapeuta") {
    if (!evento.confirmadoPor || !evento.confirmadoEm) {
      p.push({ campo: "confirmacao", mensagem: "Falta autor e horário da confirmação." });
    }
    if (!evento.zonaId && !evento.valor && !evento.movimento) {
      p.push({ campo: "resultado", mensagem: "Evento confirmado sem zona, valor ou movimento." });
    }
  }
  return p;
}

// ===========================================================================
// Camada 2: resultado observado (texto literal, sem inventar)
// ===========================================================================
export function descreverEvento(evento: EventoLeitura): string {
  const lamina = acharLamina(evento.laminaId);
  const nomeLamina = lamina?.nome ?? evento.laminaId;
  const origem = evento.modoEntrada === "camera" ? "câmera" : "registro manual";

  if (evento.statusResultado === "inconclusivo") {
    return `Pergunta ${evento.sequencia}: "${evento.perguntaTexto}" — ${nomeLamina}, resultado inconclusivo (${origem}).`;
  }
  if (evento.statusResultado === "lamina_nao_configurada") {
    return `Pergunta ${evento.sequencia}: "${evento.perguntaTexto}" — ${nomeLamina} não está configurada; nada foi interpretado.`;
  }
  if (evento.statusResultado === "pendente") {
    return `Pergunta ${evento.sequencia}: "${evento.perguntaTexto}" — ${nomeLamina}, registro pendente de confirmação.`;
  }

  const zona = evento.zonaId ? acharZona(evento.laminaId, evento.zonaId) : undefined;
  const partes: string[] = [`Pergunta ${evento.sequencia}: "${evento.perguntaTexto}"`, nomeLamina];
  if (evento.movimento) partes.push(`movimento: ${evento.movimento.replace(/_/g, " ")}`);
  if (zona) partes.push(`zona: ${zona.rotulo}`);
  if (evento.valor) {
    partes.push(`valor: ${evento.valor.numero} ${evento.valor.unidade} (faixa ${evento.valor.min} a ${evento.valor.max})`);
  }
  partes.push(`origem: ${origem}`);
  return partes.join(" — ") + ".";
}

// ===========================================================================
// Camada 3: contexto relatado
// ===========================================================================
export interface TrechoFicha {
  respostaId: string;
  perguntaTexto: string;
  trecho: string;
  tags: string[];
  origem: string;
  formularioId: IdFormulario;
}

/** Converte respostas em trechos citaveis, descartando ausencias. */
export function extrairTrechos(anamneses: AnamneseRespondida[]): TrechoFicha[] {
  const out: TrechoFicha[] = [];
  for (const a of anamneses) {
    for (const r of Object.values(a.respostas)) {
      if (r.ausencia) continue;
      const texto = formatarValor(r, a.formularioId);
      if (!texto.trim()) continue;
      const pergunta = acharPergunta(r.perguntaId);
      out.push({
        respostaId: r.perguntaId,
        perguntaTexto: pergunta?.texto ?? r.perguntaId,
        trecho: texto,
        tags: pergunta?.tags ?? [],
        origem: r.origem,
        formularioId: a.formularioId,
      });
    }
  }
  return out;
}

function formatarValor(r: Resposta, formularioId: IdFormulario): string {
  const pergunta = acharPergunta(r.perguntaId);
  const rotuloDe = (v: string) =>
    pergunta?.opcoes?.find((o) => o.valor === v)?.rotulo ?? v;

  if (r.valor === undefined || r.valor === null) return "";
  if (Array.isArray(r.valor)) return r.valor.map(rotuloDe).join("; ");
  if (typeof r.valor === "number") {
    const u = r.unidade ?? pergunta?.unidade ?? "";
    if (pergunta?.tipo === "E") {
      const a = pergunta.ancoras;
      return a ? `${r.valor} (${a.min} / ${a.max})` : String(r.valor);
    }
    return u ? `${r.valor} ${u}` : String(r.valor);
  }
  const s = String(r.valor);
  // Para U, troca o valor interno pelo rotulo legivel.
  if (pergunta?.tipo === "U") return rotuloDe(s);
  void formularioId;
  return s;
}

// ===========================================================================
// Bandeiras e encaminhamentos. Regra deterministica, nunca decisao da IA.
// ===========================================================================
export const TEXTO_BANDEIRA: Record<BandeiraTipo, string> = {
  risco_imediato: "Relato de vontade de se machucar",
  violencia_ou_controle: "Relato de insegurança, controle, ameaça ou violência",
  saude_em_acompanhamento: "Há cuidado de saúde em andamento",
  saude_sem_acompanhamento: "Preocupação de saúde sem acompanhamento profissional",
  sofrimento_psiquico: "Sofrimento emocional sem rede de apoio, ou efeito indesejado da sessão",
  animal_sem_veterinario: "Animal ou cultivo sem acompanhamento técnico",
  risco_material_do_ambiente: "Fator material do ambiente que exige verificação técnica",
};

/** Texto de encaminhamento por bandeira. Acolhedor, sem alarme. */
export const ENCAMINHAMENTO: Record<BandeiraTipo, string> = {
  risco_imediato:
    "Antes de qualquer leitura simbólica: procure agora ajuda profissional. No Brasil, o CVV atende 24 horas no 188, e o CAPS da sua região faz acolhimento sem agendamento. Se houver risco imediato, o SAMU é 192.",
  violencia_ou_controle:
    "Há relato de insegurança na relação. O apoio adequado aqui é especializado: Central de Atendimento à Mulher 180, Direitos Humanos 100, ou a delegacia de referência da sua cidade. Posso seguir com a sessão se você quiser, mas esse encaminhamento vem primeiro.",
  saude_em_acompanhamento:
    "Você já tem acompanhamento de saúde em curso. Nada aqui substitui ou altera esse cuidado: as orientações do profissional que acompanha você continuam valendo integralmente.",
  saude_sem_acompanhamento:
    "Há uma preocupação de saúde sem avaliação profissional. Esta sessão não avalia, não investiga e não descarta nada nesse campo. Vale marcar uma consulta: a UBS mais próxima é a porta de entrada.",
  sofrimento_psiquico:
    "O relato aponta sofrimento emocional com pouca rede de apoio. Um acompanhamento psicológico daria o suporte que uma sessão de radiestesia não dá. O CAPS e as clínicas-escola de psicologia atendem gratuitamente.",
  animal_sem_veterinario:
    "Para animal ou cultivo, a avaliação veterinária ou agronômica é insubstituível. A leitura simbólica não diagnostica doença nem orienta tratamento.",
  risco_material_do_ambiente:
    "Você citou um fator material do ambiente (umidade, cheiro, elétrica, estrutura ou água). Isso se verifica com profissional técnico, não com pêndulo. Vale chamar quem possa medir e atestar.",
};

/** Bandeiras que exigem que o encaminhamento venha ANTES da interpretacao. */
const BANDEIRAS_PRIORITARIAS: BandeiraTipo[] = [
  "risco_imediato",
  "violencia_ou_controle",
];

export function detectarBandeiras(
  anamneses: AnamneseRespondida[],
): BandeiraAcionada[] {
  const achadas: BandeiraAcionada[] = [];
  const vistos = new Set<string>();

  for (const a of anamneses) {
    for (const r of Object.values(a.respostas)) {
      if (r.ausencia || r.valor === undefined) continue;
      const pergunta = acharPergunta(r.perguntaId);
      if (!pergunta?.opcoes) continue;
      const escolhidos = Array.isArray(r.valor)
        ? r.valor.map(String)
        : [String(r.valor)];
      for (const v of escolhidos) {
        const opcao = pergunta.opcoes.find((o) => o.valor === v);
        if (!opcao?.bandeira) continue;
        const chave = `${opcao.bandeira}:${r.perguntaId}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        achadas.push({
          tipo: opcao.bandeira,
          respostaId: r.perguntaId,
          trecho: `${pergunta.texto} — ${opcao.rotulo}`,
        });
      }
    }
  }

  // Prioritarias primeiro.
  return achadas.sort((x, y) => {
    const px = BANDEIRAS_PRIORITARIAS.indexOf(x.tipo);
    const py = BANDEIRAS_PRIORITARIAS.indexOf(y.tipo);
    return (px === -1 ? 99 : px) - (py === -1 ? 99 : py);
  });
}

export function montarEncaminhamentos(
  bandeiras: BandeiraAcionada[],
): string[] {
  const unicos = new Set(bandeiras.map((b) => b.tipo));
  return [...unicos].map((t) => ENCAMINHAMENTO[t]);
}

export function temBandeiraPrioritaria(bandeiras: BandeiraAcionada[]): boolean {
  return bandeiras.some((b) => BANDEIRAS_PRIORITARIAS.includes(b.tipo));
}

// ===========================================================================
// Ranking de laminas a partir da ficha
// ===========================================================================
export interface LaminaSugerida {
  lamina: Lamina;
  pontos: number;
  /** Por que esta lamina apareceu: tags em comum e modulos usados. */
  porque: string[];
}

/**
 * Ordena laminas por pertinencia aos modulos preenchidos e as tags das
 * respostas. Pertinencia textual, nao probabilidade de nada.
 */
export function rankearLaminas(
  anamneses: AnamneseRespondida[],
  pessoa?: Pessoa,
): LaminaSugerida[] {
  const modulosUsados = new Set<IdFormulario>(
    anamneses.map((a) => a.formularioId),
  );
  const tagsRespondidas = new Map<string, number>();
  for (const trecho of extrairTrechos(anamneses)) {
    for (const tag of trecho.tags) {
      tagsRespondidas.set(tag, (tagsRespondidas.get(tag) ?? 0) + 1);
    }
  }
  // Tags dos modulos usados tambem contam.
  for (const id of modulosUsados) {
    const f = acharFormulario(id);
    for (const tag of f?.tags ?? []) {
      tagsRespondidas.set(tag, (tagsRespondidas.get(tag) ?? 0) + 2);
    }
  }
  // Motivo principal declarado na ficha.
  if (pessoa?.temaPrincipal) {
    for (const id of MOTIVO_PARA_MODULOS[pessoa.temaPrincipal] ?? []) {
      const f = acharFormulario(id);
      for (const tag of f?.tags ?? []) {
        tagsRespondidas.set(tag, (tagsRespondidas.get(tag) ?? 0) + 3);
      }
    }
  }

  const sugeridas = LAMINAS_LEITURA.filter((l) => l.ativa && l.configurada).map(
    (lamina) => {
      let pontos = 0;
      const porque: string[] = [];
      for (const tag of lamina.tagsIndicacao) {
        const peso = tagsRespondidas.get(tag);
        if (peso) {
          pontos += peso;
          porque.push(`tema "${tag}" aparece na ficha`);
        }
      }
      for (const m of lamina.modulosRelacionados) {
        if (modulosUsados.has(m)) {
          pontos += 4;
          const f = acharFormulario(m);
          porque.push(`módulo ${m} preenchido${f ? ` (${f.titulo})` : ""}`);
        }
      }
      // Sim/nao e tempo servem em qualquer sessao, com peso baixo.
      if (lamina.id === "LAM-SIM-NAO" || lamina.id === "LAM-TEMPO") pontos += 1;
      return { lamina, pontos, porque: [...new Set(porque)] };
    },
  );

  return sugeridas
    .filter((s) => s.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || a.lamina.nome.localeCompare(b.lamina.nome));
}

// ===========================================================================
// Camada 4: associacao por vinculo tematico explicito
// ===========================================================================
export interface ResultadoCruzamento {
  vinculos: VinculoApoio[];
  /** Simbolos lidos que nao encontraram apoio na ficha. */
  simbolosSemApoio: { eventoId: string; zonaRotulo: string; tema: string }[];
  /** Respostas com peso que nenhum simbolo tocou. */
  temasDaFichaNaoTocados: string[];
  /** Eventos inconclusivos ou com abstencao. */
  eventosSemResultado: { eventoId: string; motivo: string }[];
}

/**
 * Cruza APENAS depois de definido o setor (dossie, p. 41).
 * O vinculo e textual: tag da zona que coincide com tag da resposta.
 */
export function cruzar(
  eventos: EventoLeitura[],
  trechos: TrechoFicha[],
): ResultadoCruzamento {
  const vinculos: VinculoApoio[] = [];
  const simbolosSemApoio: ResultadoCruzamento["simbolosSemApoio"] = [];
  const eventosSemResultado: ResultadoCruzamento["eventosSemResultado"] = [];
  const tagsTocadas = new Set<string>();

  for (const evento of eventos) {
    if (evento.statusResultado !== "confirmado_pelo_terapeuta") {
      eventosSemResultado.push({
        eventoId: evento.id,
        motivo:
          evento.statusResultado === "inconclusivo"
            ? "resultado inconclusivo"
            : evento.statusResultado === "lamina_nao_configurada"
              ? "lâmina não configurada"
              : "pendente de confirmação",
      });
      continue;
    }
    const zona = evento.zonaId ? acharZona(evento.laminaId, evento.zonaId) : undefined;
    if (!zona) {
      // Confirmado sem zona: por exemplo um sim/nao por movimento, ou um valor.
      continue;
    }

    const achados = trechos.filter((t) =>
      t.tags.some((tag) => zona.tags.includes(tag)),
    );

    if (achados.length === 0) {
      simbolosSemApoio.push({
        eventoId: evento.id,
        zonaRotulo: zona.rotulo,
        tema: zona.tags.join(", ") || zona.rotulo,
      });
      continue;
    }
    for (const t of achados) {
      vinculos.push({
        temaDoSimbolo: zona.rotulo,
        respostaId: t.respostaId,
        trecho: t.trecho,
        eventoId: evento.id,
      });
      for (const tag of t.tags) tagsTocadas.add(tag);
    }
  }

  // Temas da ficha com peso que nenhum simbolo tocou.
  const pesoPorTag = new Map<string, number>();
  for (const t of trechos) {
    for (const tag of t.tags) {
      pesoPorTag.set(tag, (pesoPorTag.get(tag) ?? 0) + 1);
    }
  }
  const temasDaFichaNaoTocados = [...pesoPorTag.entries()]
    .filter(([tag, peso]) => peso >= 2 && !tagsTocadas.has(tag))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);

  return { vinculos, simbolosSemApoio, temasDaFichaNaoTocados, eventosSemResultado };
}

// ===========================================================================
// Camada 5: perguntas neutras de confirmacao
// ===========================================================================
export function montarPerguntasDeConfirmacao(
  c: ResultadoCruzamento,
): string[] {
  const perguntas: string[] = [];

  for (const v of dedupePorTema(c.vinculos)) {
    perguntas.push(
      `O tema "${v.temaDoSimbolo}" faz sentido para você, a partir do que você contou? Pode descartar se não fizer.`,
    );
  }
  for (const s of c.simbolosSemApoio) {
    perguntas.push(
      `A palavra "${s.zonaRotulo}" apareceu na lâmina, mas não há nada na sua ficha que a sustente. Essa palavra diz algo para você ou prefere descartá-la?`,
    );
  }
  for (const tema of c.temasDaFichaNaoTocados.slice(0, 3)) {
    perguntas.push(
      `Você falou bastante sobre "${tema}" e isso não apareceu na leitura. Quer que a gente trate desse assunto de outro jeito?`,
    );
  }
  for (const e of c.eventosSemResultado) {
    perguntas.push(
      `Uma das perguntas ficou sem resultado (${e.motivo}). Quer refazer essa pergunta ou deixá-la registrada como inconclusiva?`,
    );
  }
  return [...new Set(perguntas)].slice(0, 12);
}

function dedupePorTema(v: VinculoApoio[]): VinculoApoio[] {
  const vistos = new Set<string>();
  return v.filter((x) => {
    if (vistos.has(x.temaDoSimbolo)) return false;
    vistos.add(x.temaDoSimbolo);
    return true;
  });
}

// ===========================================================================
// Camada 6: sintese deterministica (base, antes da IA)
// ===========================================================================
export interface EntradaSintese {
  sessaoId: string;
  pessoa: Pessoa;
  anamneses: AnamneseRespondida[];
  eventos: EventoLeitura[];
  temConvencao: boolean;
}

export function sintetizar(entrada: EntradaSintese): Sintese {
  const { sessaoId, pessoa, anamneses, eventos, temConvencao } = entrada;

  const trechos = extrairTrechos(anamneses);
  const bandeiras = detectarBandeiras(anamneses);
  const encaminhamentos = montarEncaminhamentos(bandeiras);

  const pendencias = eventos.flatMap((e) => validarIntegridade(e, temConvencao));
  const confirmados = eventos.filter(
    (e) => e.statusResultado === "confirmado_pelo_terapeuta",
  );
  const cruzamento = cruzar(eventos, trechos);

  let status: Sintese["status"] = "rascunho";
  if (trechos.length === 0) status = "dados_insuficientes";
  else if (confirmados.length === 0) status = "inconclusivo";
  else if (pendencias.length > 0) status = "precisa_revisao";
  else if (cruzamento.vinculos.length === 0) status = "inconclusivo";

  const lacunas: string[] = [];
  for (const p of pendencias) {
    lacunas.push(`Pendência de integridade em ${p.campo}: ${p.mensagem}`);
  }
  for (const s of cruzamento.simbolosSemApoio) {
    lacunas.push(
      `A zona "${s.zonaRotulo}" não encontrou apoio na ficha. Registrada como tema não confirmado.`,
    );
  }
  for (const tema of cruzamento.temasDaFichaNaoTocados) {
    lacunas.push(`O tema "${tema}" aparece na ficha e não foi tocado por nenhuma leitura.`);
  }
  for (const e of cruzamento.eventosSemResultado) {
    lacunas.push(`Evento ${e.eventoId}: ${e.motivo}.`);
  }
  if (!temConvencao) {
    lacunas.push("A convenção da sessão não foi registrada; nada foi interpretado.");
  }

  const interpretacao = montarInterpretacaoBase(cruzamento, status);
  const acoes = montarAcoesBase(trechos, bandeiras);

  return {
    id: `SIN-${sessaoId}-${Date.now().toString(36)}`,
    sessaoId,
    status,
    resultadoObservado: eventos.map(descreverEvento),
    contextoRelatado: trechos.map((t) => ({
      respostaId: t.respostaId,
      trecho: t.trecho,
    })),
    interpretacaoSimbolica: interpretacao,
    vinculosDeApoio: cruzamento.vinculos,
    contradicoesELacunas: lacunas,
    perguntasDeConfirmacao: montarPerguntasDeConfirmacao(cruzamento),
    acoesAcordadas: acoes,
    bandeiras,
    encaminhamentos,
    limites: montarLimites(anamneses, pessoa),
    procedencia: {
      motor: "deterministico",
      regrasVersao: VERSAO_REGRAS,
      geradoEm: new Date().toISOString(),
    },
  };
}

function montarInterpretacaoBase(
  c: ResultadoCruzamento,
  status: Sintese["status"],
): string {
  if (status === "dados_insuficientes") {
    return "Não há informação suficiente na ficha para relacionar com a leitura. Esta é a conclusão da sessão, e ela tem o mesmo valor de uma interpretação completa.";
  }
  if (status === "inconclusivo" && c.vinculos.length === 0) {
    return "Nenhuma leitura confirmada encontrou vínculo temático com o que foi informado na ficha. Não há associação a apresentar: o resultado é inconclusivo.";
  }
  const linhas = dedupePorTema(c.vinculos).map(
    (v) =>
      `O tema "${v.temaDoSimbolo}", lido na lâmina, tem relação textual com o que foi informado em ${v.respostaId}: "${v.trecho}". É uma hipótese de conversa, não a causa do que a pessoa vive.`,
  );
  return linhas.join("\n\n");
}

/**
 * Acoes de base: apenas o que a propria pessoa JA declarou como proximo passo.
 * Dossie, p. 38: "agreed_actions: apenas acoes ja escolhidas/confirmadas".
 */
function montarAcoesBase(
  trechos: TrechoFicha[],
  bandeiras: BandeiraAcionada[],
): AcaoAcordada[] {
  const acoes: AcaoAcordada[] = [];

  // Encaminhamento prioritario vira acao "agora".
  for (const b of bandeiras) {
    if (BANDEIRAS_PRIORITARIAS.includes(b.tipo)) {
      acoes.push({
        prazo: "agora",
        texto: ENCAMINHAMENTO[b.tipo],
        apoio: [b.respostaId],
      });
    }
  }

  const porPrazo: Record<string, AcaoAcordada["prazo"]> = {
    agora: "agora",
    curto: "curto",
    medio: "medio",
    longo: "longo",
  };

  for (const t of trechos) {
    if (!t.tags.includes("acao")) continue;
    const prazoTag = t.tags.find((x) => x in porPrazo);
    const prazo = prazoTag ? porPrazo[prazoTag] : "curto";
    acoes.push({ prazo, texto: t.trecho, apoio: [t.respostaId] });
  }

  // Sinal de melhora e revisao viram acao de medio prazo.
  for (const t of trechos) {
    if (t.tags.includes("retorno") && !t.tags.includes("acao")) {
      acoes.push({ prazo: "medio", texto: t.trecho, apoio: [t.respostaId] });
    }
  }

  return acoes;
}

function montarLimites(
  anamneses: AnamneseRespondida[],
  pessoa: Pessoa,
): string[] {
  const limites = new Set<string>([
    "Esta é uma leitura simbólica revisada por pessoa, não diagnóstico, prescrição ou previsão.",
    "O movimento do pêndulo foi registrado como movimento observado. Isso não mede energia nem comprova o significado atribuído.",
  ]);

  for (const a of anamneses) {
    const f: Formulario | undefined = acharFormulario(a.formularioId);
    if (f?.limiteInterpretacao) limites.add(f.limiteInterpretacao);
  }

  if (pessoa.assuntosEvitados?.length) {
    limites.add(
      `Assuntos que a pessoa pediu para não abordar: ${pessoa.assuntosEvitados.join("; ")}.`,
    );
  }
  return [...limites];
}
