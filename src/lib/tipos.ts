/**
 * Modelo de dados do app, derivado de "Papeis, dados e historico" e
 * "Contrato de dados: exemplos minimos" do dossie (p. 36-37).
 *
 * Tres niveis que nunca se fundem (dossie, p. 2):
 *   1. Observacao  -> EventoLeitura  (pergunta, lamina, movimento/zona)
 *   2. Contexto    -> AnamneseRespondida (o que a pessoa informou)
 *   3. Interpretacao -> Sintese (hipotese simbolica, sempre rascunho)
 */

import type { Redacao } from "./schemas";


// ---------------------------------------------------------------------------
// Tipos de resposta da anamnese. Dicionario do dossie, p. 9.
// T = texto livre | U = escolha unica | M = multipla escolha
// E = escala de autorrelato | D = data ou periodo | N = numero com unidade
// ---------------------------------------------------------------------------
export type TipoResposta = "T" | "U" | "M" | "E" | "D" | "N" | "ANEXO";

/**
 * Ausencia de resposta. O dossie e explicito: "Ausencia de resposta nao
 * equivale a ausencia de problema" (p. 9) e, nos criterios de aceite,
 * "E preservada como ausente/recusada; nunca convertida em 'nao'" (p. 40).
 */
export type AusenciaResposta = "nao_se_aplica" | "nao_sei" | "prefiro_nao_responder";

export const AUSENCIAS: { valor: AusenciaResposta; rotulo: string }[] = [
  { valor: "nao_se_aplica", rotulo: "Não se aplica" },
  { valor: "nao_sei", rotulo: "Não sei" },
  { valor: "prefiro_nao_responder", rotulo: "Prefiro não responder" },
];

/** Origem da resposta. Dossie, p. 9: distinguir quem preencheu. */
export type OrigemResposta =
  | "pessoa"
  | "ditado_ao_terapeuta"
  | "observacao_do_terapeuta"
  | "documento_anexado";

export const ORIGENS: { valor: OrigemResposta; rotulo: string }[] = [
  { valor: "pessoa", rotulo: "Preenchido pela pessoa" },
  { valor: "ditado_ao_terapeuta", rotulo: "Ditado ao terapeuta" },
  { valor: "observacao_do_terapeuta", rotulo: "Observação do terapeuta" },
  { valor: "documento_anexado", rotulo: "Documento anexado" },
];

// ---------------------------------------------------------------------------
// Formularios: ficha-base, 12 modulos e retorno
// ---------------------------------------------------------------------------
export interface OpcaoPergunta {
  valor: string;
  rotulo: string;
  /** Marca a opcao como sinal que exige encaminhamento profissional. */
  bandeira?: BandeiraTipo;
}

export interface Pergunta {
  /** ID estavel e citavel na sintese. Ex.: "B01", "M02.08". */
  id: string;
  texto: string;
  tipo: TipoResposta;
  /** Opcoes para U e M. */
  opcoes?: OpcaoPergunta[];
  /** Ancoras escritas para escalas 0-10 (dossie, p. 9: nunca converter em Bovis). */
  ancoras?: { min: string; max: string };
  unidade?: string;
  /** Temas usados pelo motor de cruzamento e pelo ranking de laminas. */
  tags?: string[];
  opcional?: boolean;
  /** Texto de apoio exibido abaixo da pergunta. */
  ajuda?: string;
}

export interface BlocoPerguntas {
  titulo: string;
  perguntas: Pergunta[];
}

export type IdFormulario =
  | "BASE"
  | "RETORNO"
  | "M01" | "M02" | "M03" | "M04" | "M05" | "M06"
  | "M07" | "M08" | "M09" | "M10" | "M11" | "M12"
  | "EXT_ANIMAL_PLANTA";

export interface Formulario {
  id: IdFormulario;
  versao: number;
  titulo: string;
  /** Uma linha descrevendo para quem o modulo serve. */
  resumo: string;
  /** "O que o aplicativo organiza" (dossie, cada pagina de modulo). */
  organiza: string;
  /** "Exemplo de cruzamento" do dossie. Mostrado ao terapeuta como referencia. */
  exemploCruzamento?: string;
  /** "Limite de interpretacao". Entra no prompt da IA e na tela. */
  limiteInterpretacao: string;
  /** Temas do modulo, usados para rankear laminas. */
  tags: string[];
  blocos: BlocoPerguntas[];
}

export interface Resposta {
  /** ID da pergunta, ex.: "M02.03". */
  perguntaId: string;
  /** Preenchido OU ausencia, nunca os dois. */
  valor?: string | string[] | number;
  ausencia?: AusenciaResposta;
  origem: OrigemResposta;
  unidade?: string;
  atualizadoEm: string;
}

export interface AnamneseRespondida {
  id: string;
  pessoaId: string;
  formularioId: IdFormulario;
  formularioVersao: number;
  respostas: Record<string, Resposta>;
  criadoEm: string;
  atualizadoEm: string;
  /** Historico de alteracoes. Dossie, p. 9: "Preservar o historico original". */
  revisoes: { em: string; nota: string }[];
}

// ---------------------------------------------------------------------------
// Pessoa atendida
// ---------------------------------------------------------------------------
export type PreferenciaLinguagem = "espiritual" | "simbolica" | "neutra";

export interface Pessoa {
  id: string;
  /** B01. Nome de preferencia, nao nome civil completo. */
  nomePreferencia: string;
  /** Contato "somente se necessario" (dossie, p. 9). Opcional por padrao. */
  contato?: string;
  temaPrincipal?: string;
  temasSecundarios?: string[];
  preferenciaLinguagem?: PreferenciaLinguagem;
  /** B15: assuntos que a pessoa nao deseja abordar. Respeitado pela IA. */
  assuntosEvitados?: string[];
  /** B19/B20 e as permissoes separadas por finalidade. */
  consentimentos: Consentimento[];
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * Permissoes distintas por finalidade. Dossie, p. 39:
 * "Separar servico, coleta de midia, envio a fornecedor de IA e uso secundario.
 *  Um 'sim' generico nao autoriza todo uso de dados."
 */
export type FinalidadeConsentimento =
  | "registro_da_sessao"
  | "captura_de_video"
  | "envio_a_fornecedor_de_ia"
  | "entrega_de_relatorio";

export interface Consentimento {
  finalidade: FinalidadeConsentimento;
  aceito: boolean;
  /** Texto exato apresentado no momento da decisao. */
  textoApresentado: string;
  decididoEm: string;
  revogadoEm?: string;
}

export const FINALIDADES: {
  valor: FinalidadeConsentimento;
  rotulo: string;
  texto: string;
}[] = [
  {
    valor: "registro_da_sessao",
    rotulo: "Registro da sessão",
    texto:
      "Autorizo registrar neste aparelho as informações que eu fornecer e as observações desta sessão.",
  },
  {
    valor: "captura_de_video",
    rotulo: "Captura por câmera",
    texto:
      "Autorizo usar a câmera para acompanhar o movimento do pêndulo durante a sessão. As imagens são processadas no próprio aparelho.",
  },
  {
    valor: "envio_a_fornecedor_de_ia",
    rotulo: "Envio a fornecedor de IA",
    texto:
      "Autorizo enviar trechos das minhas respostas, sem meu nome e sem meu contato, a um serviço de inteligência artificial que ajuda a organizar o texto da síntese.",
  },
  {
    valor: "entrega_de_relatorio",
    rotulo: "Entrega do relatório",
    texto: "Autorizo receber o relatório da sessão em PDF.",
  },
];

// ---------------------------------------------------------------------------
// Laminas
// ---------------------------------------------------------------------------
/**
 * Como a zona e determinada a partir do movimento.
 *  - setor_angular: leque/circulo dividido em setores (sim/nao, emocoes, areas da vida)
 *  - escala_linear: regua (Bovis, numerica, percentual linear)
 *  - grade:         matriz de celulas (mapa de ambiente A1..D4)
 *  - regiao:        poligonos nomeados (figura corporal)
 *  - indice:        setor que aponta para outra lamina (indice, mesa composta, grupos)
 *  - trabalho:      grafico radionico: NAO e lido. So registra uso, versao e intencao.
 */
export type ModoLeitura =
  | "setor_angular"
  | "escala_linear"
  | "grade"
  | "regiao"
  | "indice"
  | "trabalho";

/** Tipos L01..L16 da taxonomia do dossie (p. 24-25). */
export type TipoLamina =
  | "L01" | "L02" | "L03" | "L04" | "L05" | "L06" | "L07" | "L08"
  | "L09" | "L10" | "L11" | "L12" | "L13" | "L14" | "L15" | "L16"
  | "RADIONICO";

export interface ZonaLamina {
  /** Ex.: "Z-MEDO". */
  id: string;
  rotulo: string;
  /** Faixa angular em graus, para setor_angular e indice. 0 = leste, cresce anti-horario. */
  anguloInicio?: number;
  anguloFim?: number;
  /** Faixa de valores, para escala_linear. */
  valorMin?: number;
  valorMax?: number;
  /** Celula da grade, para grade. */
  celula?: string;
  /** Poligono em coordenadas normalizadas 0..1, para regiao. */
  poligono?: [number, number][];
  /** Significado cadastrado. Nunca inventado pela IA. */
  significadoSimbolico: string;
  /** Uso permitido. Ex.: "reflexao; sem diagnostico". */
  usoPermitido: string;
  /** Temas para o cruzamento com a anamnese. */
  tags: string[];
  /** Para indice e mesa composta: lamina de destino. */
  destinoLaminaId?: string;
}

export interface Lamina {
  id: string;
  versao: number;
  tipo: TipoLamina;
  nome: string;
  modoLeitura: ModoLeitura;
  /**
   * Autor e licenca. Dossie, p. 27: "acesso publico e download gratuito nao
   * significam licenca para incorporar o desenho em app comercial".
   */
  autorELicenca: string;
  /** Regra de leitura e navegacao, obrigatoria para interpretar. */
  manual: string;
  manualVersao: number;
  /**
   * Uma lamina sem manual, convenção ou geometria fica "nao configurada"
   * e o app se abstem de interpretar (dossie, p. 25).
   */
  configurada: boolean;
  /** Unidade declarada, para escalas. Ex.: "UB", "%", "dias". */
  unidade?: string;
  /** Geometria do desenho. */
  geometria: {
    /** Para setor_angular/indice: abertura total do leque em graus (180 ou 360). */
    aberturaGraus?: number;
    /** Angulo em que o leque comeca, em graus. */
    rotacaoGraus?: number;
    /** Para escala_linear: orientacao do eixo. */
    orientacao?: "horizontal" | "vertical";
    /** Para grade. */
    colunas?: string[];
    linhas?: string[];
  };
  zonas: ZonaLamina[];
  /** Forma fixa, para graficos radionicos que nao sao gerados por geometria. */
  formaSvg?: "decagono" | "decagonos_concentricos" | "nove_circulos" | "espiral";
  /** Temas que esta lamina ajuda a investigar. Alimenta o ranking. */
  tagsIndicacao: string[];
  /** Modulos de anamnese aos quais a lamina se liga. */
  modulosRelacionados: IdFormulario[];
  ativa: boolean;
}

// ---------------------------------------------------------------------------
// Convencao de resposta: registrada POR SESSAO (dossie, p. 4)
// ---------------------------------------------------------------------------
export type MovimentoPendulo =
  | "oscilacao"
  | "giro_horario"
  | "giro_antihorario"
  | "imovel"
  | "indefinido";

export interface Convencao {
  id: string;
  sessaoId: string;
  /** Qual movimento significa o que, nesta sessao. */
  mapa: { movimento: MovimentoPendulo; significado: string }[];
  /**
   * Uma oscilacao define um eixo com DOIS sentidos possiveis (dossie, p. 35).
   * Em leque de 180 graus, so um lado tem prancha: este campo diz qual.
   * O algoritmo nao escolhe por suposicao.
   */
  sentidoDeLeitura: "lado_da_prancha" | "ambos_os_lados" | "definido_pelo_terapeuta";
  registradoEm: string;
}

// ---------------------------------------------------------------------------
// Sessao e eventos de leitura
// ---------------------------------------------------------------------------
export type StatusSessao = "aberta" | "em_sintese" | "encerrada";

export interface Sessao {
  id: string;
  pessoaId: string;
  tema: string;
  /** IDs das anamneses usadas nesta sessao. */
  anamneseIds: string[];
  convencao?: Convencao;
  status: StatusSessao;
  iniciadaEm: string;
  encerradaEm?: string;
  /** Nome que o terapeuta usa para assinar o PDF. */
  terapeuta: string;
}

export type ModoEntrada = "manual" | "camera";

/**
 * Resultado de um evento. "Aceitar inconclusivo" e requisito do dossie (p. 41):
 * um relatorio util tambem pode concluir "nao ha informacao suficiente".
 */
export type StatusResultado =
  | "confirmado_pelo_terapeuta"
  | "inconclusivo"
  | "pendente"
  | "lamina_nao_configurada";

/** Metricas tecnicas da camera. Dossie, p. 37: nao misturar com confianca na interpretacao. */
export interface MetricasCaptura {
  /** Angulo do eixo principal de oscilacao, em graus. */
  eixoGraus: number | null;
  /** Quao alongada e a nuvem de movimento. 1 = linha, 0 = circulo. */
  linearidade: number;
  /** Desvio do eixo ao longo da janela, em graus. Alto = instavel. */
  instabilidadeGraus: number;
  /** Soma do produto vetorial: positivo = anti-horario, negativo = horario. */
  somaRotacional: number;
  /** Energia de movimento detectada, 0..1. */
  energia: number;
  /** Quadros usados na janela de analise. */
  quadros: number;
  /** Nitidez estimada do quadro, 0..1. */
  nitidez: number;
}

/** Motivos de abstencao listados no dossie, p. 35. */
export type MotivoAbstencao =
  | "lamina_desconhecida"
  | "lamina_nao_configurada"
  | "sem_convencao"
  | "baixa_nitidez"
  | "movimento_sem_estabilidade"
  | "fronteira_de_zonas"
  | "sem_referencia_geometrica"
  | "energia_insuficiente"
  | "fora_do_enquadramento";

export interface EventoLeitura {
  id: string;
  sessaoId: string;
  /** Texto EXATO da pergunta. Preservado sem reescrita (dossie, p. 37). */
  perguntaTexto: string;
  /** Ordem do evento na sessao. Se a pergunta muda, cria-se novo evento. */
  sequencia: number;
  laminaId: string;
  laminaVersao: number;
  convencaoId?: string;
  modoEntrada: ModoEntrada;
  movimento?: MovimentoPendulo;
  /** Zona confirmada. Ausente quando inconclusivo. */
  zonaId?: string;
  /** Valor lido, para escalas. Guardado com unidade e limites. */
  valor?: { numero: number; unidade: string; min: number; max: number };
  metricas?: MetricasCaptura;
  motivosAbstencao?: MotivoAbstencao[];
  statusResultado: StatusResultado;
  confirmadoPor?: string;
  confirmadoEm?: string;
  /** Observacao livre do terapeuta sobre este evento. */
  nota?: string;
}

// ---------------------------------------------------------------------------
// Sintese. Estrutura de "IA: papel, saida e instrucoes" (dossie, p. 38)
// ---------------------------------------------------------------------------
export type StatusSintese =
  | "rascunho"
  | "dados_insuficientes"
  | "inconclusivo"
  | "precisa_revisao";

export interface VinculoApoio {
  /** Tema do simbolo lido. */
  temaDoSimbolo: string;
  /** ID da resposta que sustenta o vinculo. Ex.: "M07.06". */
  respostaId: string;
  /** Trecho literal usado. */
  trecho: string;
  eventoId: string;
}

export type PrazoAcao = "agora" | "curto" | "medio" | "longo";

export interface AcaoAcordada {
  prazo: PrazoAcao;
  texto: string;
  /** IDs que sustentam a acao. Vazio = acao sem apoio, sinalizada na tela. */
  apoio: string[];
}

export interface BandeiraAcionada {
  tipo: BandeiraTipo;
  /** Resposta que acionou. */
  respostaId: string;
  trecho: string;
}

export type BandeiraTipo =
  | "risco_imediato"
  | "violencia_ou_controle"
  | "saude_em_acompanhamento"
  | "saude_sem_acompanhamento"
  | "sofrimento_psiquico"
  | "animal_sem_veterinario"
  | "risco_material_do_ambiente";

export interface Sintese {
  /**
   * Texto humano escrito pelo Gemini. Guardado junto da sintese para que o
   * PDF possa ser gerado de novo depois, sem repetir a chamada de IA.
   */
  redacao?: Redacao;
  id: string;
  sessaoId: string;
  status: StatusSintese;
  /** Texto literal dos eventos confirmados. */
  resultadoObservado: string[];
  /** Trechos da ficha, com IDs. */
  contextoRelatado: { respostaId: string; trecho: string }[];
  /** Hipotese explicitamente simbolica. */
  interpretacaoSimbolica: string;
  vinculosDeApoio: VinculoApoio[];
  /** Lacunas e divergencias, sempre explicitas. */
  contradicoesELacunas: string[];
  /** Perguntas neutras para confirmar, rejeitar ou reformular. */
  perguntasDeConfirmacao: string[];
  /** Apenas acoes ja escolhidas e confirmadas. */
  acoesAcordadas: AcaoAcordada[];
  bandeiras: BandeiraAcionada[];
  /** Encaminhamentos sugeridos por regra deterministica. */
  encaminhamentos: string[];
  limites: string[];
  /** Quem gerou: regras, Jev, Gemini. E a versao de cada um. */
  procedencia: {
    motor: "deterministico" | "deterministico+ia";
    jevModelo?: string;
    geminiModelo?: string;
    regrasVersao: string;
    geradoEm: string;
  };
  /** Revisao humana. Toda sintese e rascunho ate aqui. */
  revisao?: {
    autor: string;
    decisao: "aprovada" | "corrigida" | "descartada";
    alteracoes: string;
    em: string;
    versao: number;
  };
  /** Texto final, na voz do terapeuta, para o PDF entregue a pessoa. */
  textoParaPessoa?: string;
}
