/**
 * Catalogo de laminas.
 *
 * Desenhos ORIGINAIS, gerados a partir da geometria declarada aqui. Nenhuma
 * prancha autoral de terceiros foi reproduzida: o dossie (p. 27) adverte que
 * "acesso publico e download gratuito nao significam licenca para incorporar
 * o desenho em app comercial".
 *
 * A taxonomia L01..L16 vem do dossie, p. 24-25. Os graficos radionicos
 * (p. 26) NAO sao lidos pelo app: tem modoLeitura "trabalho" e so registram
 * uso, versao e intencao declarada.
 *
 * Convencao de angulo: graus, 0 = leste (direita), crescendo no sentido
 * anti-horario. Um leque de 180 graus ocupa 0..180 (metade de cima).
 */
import type { Lamina, ZonaLamina } from "@/lib/tipos";

const LIC = "Desenho original deste aplicativo. Livre para uso do terapeuta.";

/** Monta setores de tamanho igual num leque. */
function setoresIguais(
  itens: { id: string; rotulo: string; significado: string; tags: string[]; destino?: string }[],
  abertura: number,
  inicio = 0,
  usoPermitido = "reflexão; sem diagnóstico",
): ZonaLamina[] {
  const passo = abertura / itens.length;
  return itens.map((it, i) => ({
    id: it.id,
    rotulo: it.rotulo,
    anguloInicio: inicio + i * passo,
    anguloFim: inicio + (i + 1) * passo,
    significadoSimbolico: it.significado,
    usoPermitido,
    tags: it.tags,
    destinoLaminaId: it.destino,
  }));
}

/** Monta faixas de uma escala linear. */
function faixas(
  min: number,
  max: number,
  quantidade: number,
  rotulo: (a: number, b: number) => string,
  significado: (a: number, b: number) => string,
  tags: string[],
  usoPermitido = "reflexão; sem diagnóstico",
): ZonaLamina[] {
  const passo = (max - min) / quantidade;
  return Array.from({ length: quantidade }, (_, i) => {
    const a = min + i * passo;
    const b = min + (i + 1) * passo;
    return {
      id: `Z-${Math.round(a)}-${Math.round(b)}`,
      rotulo: rotulo(a, b),
      valorMin: a,
      valorMax: b,
      significadoSimbolico: significado(a, b),
      usoPermitido,
      tags,
    };
  });
}

// ===========================================================================
// L01 - Sim / nao / indefinido
// ===========================================================================
const L01: Lamina = {
  id: "LAM-SIM-NAO",
  versao: 1,
  tipo: "L01",
  nome: "Sim, não e indefinido",
  modoLeitura: "setor_angular",
  autorELicenca: LIC,
  manual:
    "Leque de três setores. O terapeuta registra a convenção da sessão antes " +
    "de pendular. O eixo de oscilação aponta para um setor; se cruzar a " +
    "fronteira entre dois, o resultado é inconclusivo e não deve ser " +
    "escolhido por conveniência. A ausência de resposta nunca é convertida " +
    "em 'não'.",
  manualVersao: 1,
  configurada: true,
  geometria: { aberturaGraus: 180, rotacaoGraus: 0 },
  zonas: setoresIguais(
    [
      { id: "Z-SIM", rotulo: "Sim", significado: "Resposta afirmativa segundo a convenção registrada nesta sessão.", tags: ["confirmacao"] },
      { id: "Z-INCERTO", rotulo: "Incerto", significado: "Nem afirmativo nem negativo. Pede reformulação da pergunta.", tags: ["incerteza"] },
      { id: "Z-NAO", rotulo: "Não", significado: "Resposta negativa segundo a convenção registrada nesta sessão.", tags: ["negacao"] },
    ],
    180,
    0,
    "resposta categórica; não é probabilidade de verdade",
  ),
  tagsIndicacao: ["confirmacao", "fechamento"],
  modulosRelacionados: ["BASE"],
  ativa: true,
};

// ===========================================================================
// L02 - Escala percentual
// ===========================================================================
const L02: Lamina = {
  id: "LAM-PERCENTUAL",
  versao: 1,
  tipo: "L02",
  nome: "Escala percentual",
  modoLeitura: "escala_linear",
  autorELicenca: LIC,
  manual:
    "Escala simbólica de 0 a 100 em dez faixas. O número é o rótulo que o " +
    "operador registrou. Não representa probabilidade de um evento, " +
    "comprometimento de um órgão nem eficácia da sessão (dossiê, p. 24).",
  manualVersao: 1,
  configurada: true,
  unidade: "%",
  geometria: { orientacao: "horizontal" },
  zonas: faixas(
    0,
    100,
    10,
    (a, b) => `${Math.round(a)} a ${Math.round(b)}%`,
    (a, b) =>
      `Faixa simbólica de ${Math.round(a)} a ${Math.round(b)} por cento, conforme o rótulo da régua. Sem unidade física.`,
    ["intensidade"],
    "rótulo de escala; não é probabilidade nem medida clínica",
  ),
  tagsIndicacao: ["intensidade", "prioridade"],
  modulosRelacionados: ["BASE", "M01", "M09"],
  ativa: true,
};

// ===========================================================================
// L03 - Numerica generica
// ===========================================================================
const L03: Lamina = {
  id: "LAM-NUMERICA",
  versao: 1,
  tipo: "L03",
  nome: "Régua numérica genérica",
  modoLeitura: "escala_linear",
  autorELicenca: LIC,
  manual:
    "Régua de 0 a 100, incremento de 10. Mínimo, máximo, incremento e " +
    "unidade devem ser declarados a cada uso. Sem unidade declarada, o " +
    "número não deve ser interpretado.",
  manualVersao: 1,
  configurada: true,
  unidade: "unidades declaradas na sessão",
  geometria: { orientacao: "horizontal" },
  zonas: faixas(
    0,
    100,
    10,
    (a, b) => `${Math.round(a)}-${Math.round(b)}`,
    (a, b) => `Valor entre ${Math.round(a)} e ${Math.round(b)} na unidade declarada nesta sessão.`,
    ["quantidade"],
    "quantidade declarada; sem significado fora da unidade informada",
  ),
  tagsIndicacao: ["quantidade"],
  modulosRelacionados: ["M07", "M08", "M09"],
  ativa: true,
};

// ===========================================================================
// L04 - Tempo em leque
// ===========================================================================
const L04: Lamina = {
  id: "LAM-TEMPO",
  versao: 1,
  tipo: "L04",
  nome: "Tempo em leque (dias)",
  modoLeitura: "setor_angular",
  autorELicenca: LIC,
  manual:
    "Seis setores em dias: 1, 3, 7, 14, 30 e 60. A unidade é explícita e " +
    "sempre 'dias'. Serve para marcar prazo de revisão combinado com a " +
    "pessoa, não para prever acontecimentos (dossiê, p. 24).",
  manualVersao: 1,
  configurada: true,
  unidade: "dias",
  geometria: { aberturaGraus: 180, rotacaoGraus: 0 },
  zonas: setoresIguais(
    [
      { id: "Z-60D", rotulo: "60 dias", significado: "Prazo de revisão de sessenta dias.", tags: ["prazo", "longo"] },
      { id: "Z-30D", rotulo: "30 dias", significado: "Prazo de revisão de trinta dias.", tags: ["prazo", "medio"] },
      { id: "Z-14D", rotulo: "14 dias", significado: "Prazo de revisão de duas semanas.", tags: ["prazo", "medio"] },
      { id: "Z-7D", rotulo: "7 dias", significado: "Prazo de revisão de uma semana.", tags: ["prazo", "curto"] },
      { id: "Z-3D", rotulo: "3 dias", significado: "Prazo de revisão de três dias.", tags: ["prazo", "curto"] },
      { id: "Z-1D", rotulo: "1 dia", significado: "Prazo de revisão de um dia.", tags: ["prazo", "agora"] },
    ],
    180,
    0,
    "marcação de prazo combinado; não prevê acontecimentos",
  ),
  tagsIndicacao: ["prazo", "retorno"],
  modulosRelacionados: ["BASE", "RETORNO"],
  ativa: true,
};

// ===========================================================================
// L05 - Grupos alfanumericos (indice -> sublamina)
// ===========================================================================
const L05: Lamina = {
  id: "LAM-ALFANUMERICO",
  versao: 1,
  tipo: "L05",
  nome: "Grupos alfanuméricos",
  modoLeitura: "indice",
  autorELicenca: LIC,
  manual:
    "Primeiro seleciona-se o grupo; depois o caractere, numa sublâmina. " +
    "Registrar sequência, acentuação, espaço e comando de encerramento. " +
    "O app não completa palavras por conta própria.",
  manualVersao: 1,
  configurada: true,
  geometria: { aberturaGraus: 180, rotacaoGraus: 0 },
  zonas: setoresIguais(
    [
      { id: "Z-OUTRO", rotulo: "Outro", significado: "Fora da lista: encerrar ou registrar manualmente.", tags: ["outro"] },
      { id: "Z-0-9", rotulo: "0-9", significado: "Grupo de dígitos.", tags: ["numero"] },
      { id: "Z-U-Z", rotulo: "U-Z", significado: "Grupo de letras U a Z.", tags: ["letra"] },
      { id: "Z-Q-T", rotulo: "Q-T", significado: "Grupo de letras Q a T.", tags: ["letra"] },
      { id: "Z-M-P", rotulo: "M-P", significado: "Grupo de letras M a P.", tags: ["letra"] },
      { id: "Z-I-L", rotulo: "I-L", significado: "Grupo de letras I a L.", tags: ["letra"] },
      { id: "Z-E-H", rotulo: "E-H", significado: "Grupo de letras E a H.", tags: ["letra"] },
      { id: "Z-A-D", rotulo: "A-D", significado: "Grupo de letras A a D.", tags: ["letra"] },
    ],
    180,
    0,
    "navegação em etapas; sem completar palavras automaticamente",
  ),
  tagsIndicacao: ["soletracao"],
  modulosRelacionados: [],
  ativa: true,
};

// ===========================================================================
// L06 - Regua Bovis
// ===========================================================================
const L06: Lamina = {
  id: "LAM-BOVIS",
  versao: 1,
  tipo: "L06",
  nome: "Régua Bovis",
  modoLeitura: "escala_linear",
  autorELicenca: LIC,
  manual:
    "Escala tradicional em unidades Bovis, 0 a 10000, encontrada em réguas " +
    "radiestésicas. Este app NÃO adota faixas de normalidade, gravidade ou " +
    "perigo, e não converte o valor em estado de saúde (dossiê, p. 24). " +
    "A amplitude varia entre materiais: registrar a versão da régua usada.",
  manualVersao: 1,
  configurada: true,
  unidade: "UB",
  geometria: { orientacao: "horizontal" },
  zonas: faixas(
    0,
    10000,
    5,
    (a, b) => `${Math.round(a)} a ${Math.round(b)} UB`,
    (a, b) =>
      `Leitura registrada entre ${Math.round(a)} e ${Math.round(b)} unidades Bovis nesta versão da régua. Não é resultado laboratorial nem indicador de saúde.`,
    ["escala_tradicional"],
    "registro de leitura tradicional; sem validade clínica",
  ),
  tagsIndicacao: ["escala_tradicional"],
  modulosRelacionados: ["M01"],
  ativa: true,
};

// ===========================================================================
// L07 - Mapa de chakras
// ===========================================================================
const L07: Lamina = {
  id: "LAM-CHAKRAS",
  versao: 1,
  tipo: "L07",
  nome: "Mapa de chakras",
  modoLeitura: "escala_linear",
  autorELicenca: LIC,
  manual:
    "Sete referências simbólicas em eixo vertical, de baixo para cima. " +
    "A nomenclatura e as associações dependem da escola: aqui está " +
    "registrada uma versão de sete centros. O centro selecionado é um tema " +
    "de conversa segundo o protocolo cadastrado, e só deve ser conectado a " +
    "experiências que a própria pessoa reconheça (dossiê, p. 15).",
  manualVersao: 1,
  configurada: true,
  geometria: { orientacao: "vertical" },
  zonas: [
    { id: "Z-BASICO", rotulo: "Básico", valorMin: 0, valorMax: 1, significadoSimbolico: "Tema de segurança material e sustento, segundo o protocolo cadastrado.", usoPermitido: "tema de conversa; sem diagnóstico", tags: ["seguranca", "material", "financas"] },
    { id: "Z-SACRAL", rotulo: "Sacral", valorMin: 1, valorMax: 2, significadoSimbolico: "Tema de prazer, criação e vínculo, segundo o protocolo cadastrado.", usoPermitido: "tema de conversa; sem diagnóstico", tags: ["prazer", "criacao", "vinculos"] },
    { id: "Z-PLEXO", rotulo: "Plexo solar", valorMin: 2, valorMax: 3, significadoSimbolico: "Tema de autonomia e decisão, segundo o protocolo cadastrado.", usoPermitido: "tema de conversa; sem diagnóstico", tags: ["autonomia", "decisao", "limites"] },
    { id: "Z-CARDIACO", rotulo: "Cardíaco", valorMin: 3, valorMax: 4, significadoSimbolico: "Tema de afeto e relações, segundo o protocolo cadastrado.", usoPermitido: "tema de conversa; sem diagnóstico", tags: ["afeto", "relacionamentos", "luto"] },
    { id: "Z-LARINGEO", rotulo: "Laríngeo", valorMin: 4, valorMax: 5, significadoSimbolico: "Tema de expressão e comunicação, segundo o protocolo cadastrado.", usoPermitido: "tema de conversa; sem diagnóstico", tags: ["comunicacao", "expressao", "carreira"] },
    { id: "Z-FRONTAL", rotulo: "Frontal", valorMin: 5, valorMax: 6, significadoSimbolico: "Tema de clareza e percepção, segundo o protocolo cadastrado.", usoPermitido: "tema de conversa; sem diagnóstico", tags: ["clareza", "foco", "objetivos"] },
    { id: "Z-CORONARIO", rotulo: "Coronário", valorMin: 6, valorMax: 7, significadoSimbolico: "Tema de sentido e pertencimento, segundo o protocolo cadastrado.", usoPermitido: "tema de conversa; sem diagnóstico", tags: ["sentido", "espiritualidade"] },
  ],
  tagsIndicacao: ["sentido", "espiritualidade", "autoconhecimento"],
  modulosRelacionados: ["M05", "M02"],
  ativa: true,
};

// ===========================================================================
// L08 - Figura corporal
// ===========================================================================
const L08: Lamina = {
  id: "LAM-FIGURA-CORPORAL",
  versao: 1,
  tipo: "L08",
  nome: "Regiões do corpo (silhueta didática)",
  modoLeitura: "regiao",
  autorELicenca: LIC,
  manual:
    "Silhueta com quatro regiões amplas, vista frontal. A seleção registra " +
    "APENAS o rótulo da região no desenho. Não informa função de órgão, " +
    "não explica desconforto e não substitui avaliação profissional " +
    "(dossiê, p. 24 e caso D, p. 34). Se a pessoa estiver em " +
    "acompanhamento de saúde, o cuidado informado permanece.",
  manualVersao: 1,
  configurada: true,
  geometria: {},
  zonas: [
    {
      id: "Z-CABECA",
      rotulo: "Cabeça",
      poligono: [
        [0.44, 0.02], [0.56, 0.02], [0.59, 0.07], [0.57, 0.13],
        [0.54, 0.16], [0.46, 0.16], [0.43, 0.13], [0.41, 0.07],
      ],
      significadoSimbolico: "Região rotulada 'cabeça' no desenho didático.",
      usoPermitido: "registro do rótulo; sem inferência de lesão ou doença",
      tags: ["corpo"],
    },
    {
      id: "Z-TRONCO",
      rotulo: "Tronco",
      // Inclui os bracos, para que o toque na lateral caia no tronco.
      poligono: [
        [0.44, 0.165], [0.56, 0.165], [0.68, 0.22], [0.76, 0.44],
        [0.70, 0.465], [0.645, 0.30], [0.645, 0.46], [0.355, 0.46],
        [0.355, 0.30], [0.30, 0.465], [0.24, 0.44], [0.32, 0.22],
      ],
      significadoSimbolico: "Região rotulada 'tronco' no desenho didático.",
      usoPermitido: "registro do rótulo; sem inferência de lesão ou doença",
      tags: ["corpo"],
    },
    {
      id: "Z-ABDOME",
      rotulo: "Abdome",
      poligono: [
        [0.355, 0.46], [0.645, 0.46], [0.655, 0.56], [0.64, 0.63],
        [0.36, 0.63], [0.345, 0.56],
      ],
      significadoSimbolico: "Região rotulada 'abdome' no desenho didático.",
      usoPermitido: "registro do rótulo; sem inferência de lesão ou doença",
      tags: ["corpo"],
    },
    {
      id: "Z-MEMBROS",
      rotulo: "Membros",
      poligono: [
        [0.36, 0.63], [0.64, 0.63], [0.625, 0.80], [0.60, 0.98],
        [0.525, 0.98], [0.515, 0.80], [0.50, 0.72], [0.485, 0.80],
        [0.475, 0.98], [0.40, 0.98], [0.375, 0.80],
      ],
      significadoSimbolico: "Região rotulada 'membros' no desenho didático.",
      usoPermitido: "registro do rótulo; sem inferência de lesão ou doença",
      tags: ["corpo"],
    },
  ],
  tagsIndicacao: ["corpo", "saude_apoio"],
  modulosRelacionados: ["M04"],
  ativa: true,
};

// ===========================================================================
// L09 - Palavras emocionais
// ===========================================================================
const L09: Lamina = {
  id: "LAM-EMOCOES",
  versao: 1,
  tipo: "L09",
  nome: "Palavras emocionais",
  modoLeitura: "setor_angular",
  autorELicenca: LIC,
  manual:
    "Vocabulário curto para abrir conversa, com opção 'outra'. A palavra " +
    "selecionada é um convite a perguntar, não uma descoberta de sentimento " +
    "oculto. Se a ficha não trouxer contexto para a palavra, registrar como " +
    "tema não confirmado (dossiê, caso E, p. 34).",
  manualVersao: 1,
  configurada: true,
  geometria: { aberturaGraus: 180, rotacaoGraus: 0 },
  zonas: setoresIguais(
    [
      { id: "Z-OUTRA", rotulo: "Outra", significado: "Fora do vocabulário da prancha: pedir a palavra da própria pessoa.", tags: ["outro"] },
      { id: "Z-CALMA", rotulo: "Calma", significado: "Tema calma, para exploração em conversa.", tags: ["calma", "emocoes"] },
      { id: "Z-MEDO", rotulo: "Medo", significado: "Tema medo, para exploração em conversa.", tags: ["medo", "emocoes"] },
      { id: "Z-ALEGRIA", rotulo: "Alegria", significado: "Tema alegria, para exploração em conversa.", tags: ["alegria", "emocoes"] },
      { id: "Z-TRISTEZA", rotulo: "Tristeza", significado: "Tema tristeza, para exploração em conversa.", tags: ["tristeza", "emocoes", "luto"] },
      { id: "Z-RAIVA", rotulo: "Raiva", significado: "Tema raiva, para exploração em conversa.", tags: ["raiva", "emocoes", "limites"] },
    ],
    180,
    0,
    "tema de conversa; não revela memória oculta",
  ),
  tagsIndicacao: ["emocoes", "estresse"],
  modulosRelacionados: ["M02", "M10", "M11"],
  ativa: true,
};

// ===========================================================================
// L10 - Areas da vida
// ===========================================================================
const L10: Lamina = {
  id: "LAM-AREAS-VIDA",
  versao: 1,
  tipo: "L10",
  nome: "Áreas da vida",
  modoLeitura: "setor_angular",
  autorELicenca: LIC,
  manual:
    "Círculo completo com seis categorias para organizar assuntos do " +
    "atendimento. Cada categoria tem vínculo opcional a um módulo da " +
    "ficha. Em círculo de 360 graus, a oscilação define um eixo com dois " +
    "sentidos: o terapeuta declara na convenção qual sentido vale.",
  manualVersao: 1,
  configurada: true,
  geometria: { aberturaGraus: 360, rotacaoGraus: 0 },
  zonas: setoresIguais(
    [
      { id: "Z-CARREIRA", rotulo: "Carreira", significado: "Assunto trabalho e trajetória profissional.", tags: ["carreira", "trabalho"] },
      { id: "Z-FINANCAS", rotulo: "Finanças", significado: "Assunto dinheiro e organização material.", tags: ["financas", "material"] },
      { id: "Z-ROTINA", rotulo: "Rotina", significado: "Assunto hábitos, horários e descanso.", tags: ["rotina", "descanso", "sono"] },
      { id: "Z-SENTIDO", rotulo: "Sentido", significado: "Assunto valores, propósito e pertencimento.", tags: ["sentido", "espiritualidade"] },
      { id: "Z-SAUDE", rotulo: "Saúde", significado: "Assunto bem-estar e cuidado, como contexto de apoio.", tags: ["saude_apoio", "bem_estar"] },
      { id: "Z-VINCULOS", rotulo: "Vínculos", significado: "Assunto relações e convivência.", tags: ["relacionamentos", "vinculos"] },
    ],
    360,
    0,
    "organização de assunto; sem diagnóstico",
  ),
  tagsIndicacao: ["triagem", "multiplos_temas"],
  modulosRelacionados: ["BASE"],
  ativa: true,
};

// ===========================================================================
// L11 - Mapa de ambiente (grade)
// ===========================================================================
const L11: Lamina = {
  id: "LAM-AMBIENTE",
  versao: 1,
  tipo: "L11",
  nome: "Mapa de ambiente (grade 4x4)",
  modoLeitura: "grade",
  autorELicenca: LIC,
  manual:
    "Grade de coordenadas para registrar uma zona de um espaço. Exige planta " +
    "ou croqui do local, orientação declarada e autorização de quem responde " +
    "pelo ambiente. A seleção NÃO atesta potabilidade, segurança elétrica, " +
    "estrutura, gás, radiação ou exposição ambiental (dossiê, p. 22 e 25).",
  manualVersao: 1,
  configurada: true,
  geometria: { colunas: ["1", "2", "3", "4"], linhas: ["A", "B", "C", "D"] },
  zonas: ["A", "B", "C", "D"].flatMap((linha) =>
    ["1", "2", "3", "4"].map((col) => ({
      id: `Z-${linha}${col}`,
      rotulo: `${linha}${col}`,
      celula: `${linha}${col}`,
      significadoSimbolico: `Coordenada ${linha}${col} da planta cadastrada nesta sessão.`,
      usoPermitido: "registro de coordenada; sem certificar risco ambiental",
      tags: ["ambiente"],
    })),
  ),
  tagsIndicacao: ["ambiente", "casa", "trabalho_fisico"],
  modulosRelacionados: ["M12"],
  ativa: true,
};

// ===========================================================================
// L12 - Cores
// ===========================================================================
const L12: Lamina = {
  id: "LAM-CORES",
  versao: 1,
  tipo: "L12",
  nome: "Relógio das cores",
  modoLeitura: "setor_angular",
  autorELicenca: LIC,
  manual:
    "Oito cores em círculo. Os significados são autorais e devem ser " +
    "cadastrados pelo terapeuta conforme sua escola. A cor escolhida não é " +
    "prescrição terapêutica (dossiê, p. 25).",
  manualVersao: 1,
  configurada: true,
  geometria: { aberturaGraus: 360, rotacaoGraus: 0 },
  zonas: setoresIguais(
    [
      { id: "Z-VERMELHO", rotulo: "Vermelho", significado: "Cor vermelha, significado conforme protocolo cadastrado.", tags: ["cor"] },
      { id: "Z-LARANJA", rotulo: "Laranja", significado: "Cor laranja, significado conforme protocolo cadastrado.", tags: ["cor"] },
      { id: "Z-AMARELO", rotulo: "Amarelo", significado: "Cor amarela, significado conforme protocolo cadastrado.", tags: ["cor"] },
      { id: "Z-VERDE", rotulo: "Verde", significado: "Cor verde, significado conforme protocolo cadastrado.", tags: ["cor"] },
      { id: "Z-AZUL", rotulo: "Azul", significado: "Cor azul, significado conforme protocolo cadastrado.", tags: ["cor"] },
      { id: "Z-INDIGO", rotulo: "Índigo", significado: "Cor índigo, significado conforme protocolo cadastrado.", tags: ["cor"] },
      { id: "Z-VIOLETA", rotulo: "Violeta", significado: "Cor violeta, significado conforme protocolo cadastrado.", tags: ["cor"] },
      { id: "Z-BRANCO", rotulo: "Branco", significado: "Cor branca, significado conforme protocolo cadastrado.", tags: ["cor"] },
    ],
    360,
    0,
    "escolha de cor; não é prescrição terapêutica",
  ),
  tagsIndicacao: ["cor", "preferencia"],
  modulosRelacionados: ["M05"],
  ativa: true,
};

// ===========================================================================
// L13 - Recursos simbolicos
// ===========================================================================
const L13: Lamina = {
  id: "LAM-RECURSOS",
  versao: 1,
  tipo: "L13",
  nome: "Recursos de apoio",
  modoLeitura: "setor_angular",
  autorELicenca: LIC,
  manual:
    "Lista fechada de recursos cotidianos. Deliberadamente SEM substâncias, " +
    "cristais para ingestão, dose ou produto: o dossiê (p. 25) proíbe " +
    "automatizar ingestão, dose ou substância. Cada item é uma possibilidade " +
    "a conversar, só registrada se a pessoa concordar.",
  manualVersao: 1,
  configurada: true,
  geometria: { aberturaGraus: 180, rotacaoGraus: 0 },
  zonas: setoresIguais(
    [
      { id: "Z-OUTRO-REC", rotulo: "Outro", significado: "Fora da lista: perguntar o que a própria pessoa considera apoio.", tags: ["outro"] },
      { id: "Z-APOIO-PESSOA", rotulo: "Apoio de alguém", significado: "Possibilidade de pedir ajuda a uma pessoa da rede de apoio.", tags: ["apoio", "rede"] },
      { id: "Z-NATUREZA", rotulo: "Contato com a natureza", significado: "Possibilidade de tempo ao ar livre.", tags: ["natureza", "rotina"] },
      { id: "Z-CORPO", rotulo: "Movimento do corpo", significado: "Possibilidade de atividade física compatível com as condições da pessoa.", tags: ["corpo", "rotina"] },
      { id: "Z-REGISTRO", rotulo: "Registro escrito", significado: "Possibilidade de anotar o que acontece entre as sessões.", tags: ["registro", "organizacao"] },
      { id: "Z-CONVERSA", rotulo: "Conversa", significado: "Possibilidade de conversar sobre o assunto com alguém de confiança.", tags: ["conversa", "apoio"] },
      { id: "Z-PAUSA", rotulo: "Pausa", significado: "Possibilidade de inserir pausas na rotina.", tags: ["pausa", "descanso", "rotina"] },
    ],
    180,
    0,
    "possibilidade a conversar; sem indicar substância, dose ou produto",
  ),
  tagsIndicacao: ["acoes", "proximos_passos"],
  modulosRelacionados: ["M01", "M03", "M09"],
  ativa: true,
};

// ===========================================================================
// L14 - Indice de graficos
// ===========================================================================
const L14: Lamina = {
  id: "LAM-INDICE",
  versao: 1,
  tipo: "L14",
  nome: "Índice de gráficos",
  modoLeitura: "indice",
  autorELicenca: LIC,
  manual:
    "Cada setor aponta para outra lâmina do catálogo, por ID e versão. " +
    "Permite navegação em etapas. O destino é aberto como novo evento de " +
    "leitura, com a pergunta registrada de novo.",
  manualVersao: 1,
  configurada: true,
  geometria: { aberturaGraus: 180, rotacaoGraus: 0 },
  zonas: setoresIguais(
    [
      { id: "Z-IDX-TEMPO", rotulo: "Tempo", significado: "Abrir a lâmina de tempo em leque.", tags: ["prazo"], destino: "LAM-TEMPO" },
      { id: "Z-IDX-AMBIENTE", rotulo: "Ambiente", significado: "Abrir o mapa de ambiente.", tags: ["ambiente"], destino: "LAM-AMBIENTE" },
      { id: "Z-IDX-CORPO", rotulo: "Corpo", significado: "Abrir a silhueta de regiões do corpo.", tags: ["corpo"], destino: "LAM-FIGURA-CORPORAL" },
      { id: "Z-IDX-EMOCOES", rotulo: "Emoções", significado: "Abrir a prancha de palavras emocionais.", tags: ["emocoes"], destino: "LAM-EMOCOES" },
      { id: "Z-IDX-AREAS", rotulo: "Áreas da vida", significado: "Abrir o círculo de áreas da vida.", tags: ["triagem"], destino: "LAM-AREAS-VIDA" },
      { id: "Z-IDX-ESCALA", rotulo: "Escala", significado: "Abrir a escala percentual.", tags: ["intensidade"], destino: "LAM-PERCENTUAL" },
      { id: "Z-IDX-SIMNAO", rotulo: "Sim/Não", significado: "Abrir a lâmina de sim, não e indefinido.", tags: ["confirmacao"], destino: "LAM-SIM-NAO" },
    ],
    180,
    0,
    "navegação entre lâminas; o destino exige novo evento",
  ),
  tagsIndicacao: ["navegacao"],
  modulosRelacionados: [],
  ativa: true,
};

// ===========================================================================
// L15 - Modalidades tematicas
// ===========================================================================
function laminaTematica(
  id: string,
  nome: string,
  itens: { id: string; rotulo: string; significado: string; tags: string[] }[],
  tagsIndicacao: string[],
  modulos: Lamina["modulosRelacionados"],
  perguntasAutorizadas: string,
): Lamina {
  return {
    id,
    versao: 1,
    tipo: "L15",
    nome,
    modoLeitura: "setor_angular",
    autorELicenca: LIC,
    manual:
      `Prancha temática. Perguntas autorizadas: ${perguntasAutorizadas} ` +
      "Cada setor é um tema de conversa sobre a experiência da própria " +
      "pessoa atendida. A prancha não lê intenção de terceiros nem prevê " +
      "resultados.",
    manualVersao: 1,
    configurada: true,
    geometria: { aberturaGraus: 180, rotacaoGraus: 0 },
    zonas: setoresIguais(itens, 180, 0, "tema de conversa; sem previsão nem leitura de terceiros"),
    tagsIndicacao,
    modulosRelacionados: modulos,
    ativa: true,
  };
}

const L15_RELACIONAMENTO = laminaTematica(
  "LAM-TEMA-RELACIONAMENTO",
  "Temática: relacionamentos",
  [
    { id: "Z-REL-OUTRO", rotulo: "Outro", significado: "Fora da lista: pedir a palavra da pessoa.", tags: ["outro"] },
    { id: "Z-REL-SEGURANCA", rotulo: "Segurança", significado: "Tema sentir-se segura ou segura o bastante para abordar o assunto.", tags: ["seguranca", "relacionamentos"] },
    { id: "Z-REL-APOIO", rotulo: "Rede de apoio", significado: "Tema quem está por perto e com quem se pode contar.", tags: ["apoio", "rede"] },
    { id: "Z-REL-LIMITES", rotulo: "Limites", significado: "Tema limites próprios: nomear, comunicar, sustentar.", tags: ["limites", "relacionamentos"] },
    { id: "Z-REL-COMUNICACAO", rotulo: "Comunicação", significado: "Tema como a conversa acontece entre as pessoas envolvidas.", tags: ["comunicacao", "relacionamentos"] },
    { id: "Z-REL-EXPECTATIVA", rotulo: "Expectativa", significado: "Tema o que se espera da relação e o que foi combinado.", tags: ["expectativa", "relacionamentos"] },
  ],
  ["relacionamentos", "vinculos", "convivencia"],
  ["M10"],
  "apenas sobre a vivência de quem está sendo atendido.",
);

const L15_CARREIRA = laminaTematica(
  "LAM-TEMA-CARREIRA",
  "Temática: carreira",
  [
    { id: "Z-CAR-OUTRO", rotulo: "Outro", significado: "Fora da lista: pedir a palavra da pessoa.", tags: ["outro"] },
    { id: "Z-CAR-RESTRICAO", rotulo: "Restrição real", significado: "Tema limites concretos de renda, tempo ou responsabilidade.", tags: ["restricao", "carreira"] },
    { id: "Z-CAR-OPORTUNIDADE", rotulo: "Oportunidade", significado: "Tema alternativas já identificadas pela pessoa.", tags: ["oportunidade", "carreira"] },
    { id: "Z-CAR-COMPETENCIA", rotulo: "Competência", significado: "Tema o que a pessoa já sabe fazer.", tags: ["competencia", "carreira"] },
    { id: "Z-CAR-COMUNICACAO", rotulo: "Comunicação", significado: "Tema como a pessoa apresenta o próprio trabalho.", tags: ["comunicacao", "carreira"] },
    { id: "Z-CAR-DECISAO", rotulo: "Decisão", significado: "Tema qual próximo passo depende dela.", tags: ["decisao", "carreira"] },
  ],
  ["carreira", "trabalho", "transicao"],
  ["M06"],
  "apenas sobre objetivo, contexto e ações possíveis da própria pessoa.",
);

const L15_NEGOCIO = laminaTematica(
  "LAM-TEMA-NEGOCIO",
  "Temática: negócio",
  [
    { id: "Z-NEG-OUTRO", rotulo: "Outro", significado: "Fora da lista: pedir a palavra do responsável.", tags: ["outro"] },
    { id: "Z-NEG-CAPACIDADE", rotulo: "Capacidade", significado: "Tema equipe, orçamento e limites de operação.", tags: ["capacidade", "negocio"] },
    { id: "Z-NEG-PRECO", rotulo: "Precificação", significado: "Tema como o preço é formado, segundo os dados informados.", tags: ["preco", "negocio"] },
    { id: "Z-NEG-OPERACAO", rotulo: "Operação", significado: "Tema como o trabalho é executado no dia a dia.", tags: ["operacao", "negocio"] },
    { id: "Z-NEG-VISIBILIDADE", rotulo: "Visibilidade", significado: "Tema como o público conhece o negócio.", tags: ["visibilidade", "negocio", "comunicacao"] },
    { id: "Z-NEG-ORGANIZACAO", rotulo: "Organização", significado: "Tema registros, separação de contas e controle.", tags: ["organizacao", "negocio", "financas"] },
  ],
  ["negocio", "vendas", "lucro"],
  ["M08"],
  "apenas sobre decisões que estão sob autoridade de quem responde.",
);

// ===========================================================================
// L16 - Mesa composta (indice para sublaminas)
// ===========================================================================
const L16: Lamina = {
  id: "LAM-MESA-COMPOSTA",
  versao: 1,
  tipo: "L16",
  nome: "Mesa composta genérica",
  modoLeitura: "indice",
  autorELicenca: LIC,
  manual:
    "Quatro zonas independentes, cada uma com regras e IDs próprios. " +
    "Zonas sobrepostas, ordem de navegação e licença do autor devem ser " +
    "cadastradas por mesa. Esta é uma mesa genérica didática: uma mesa " +
    "autoral exige o manual completo do autor.",
  manualVersao: 1,
  configurada: true,
  geometria: { aberturaGraus: 360, rotacaoGraus: 0 },
  zonas: setoresIguais(
    [
      { id: "Z-MESA-SIMNAO", rotulo: "Sim / Não", significado: "Abrir a zona de resposta categórica.", tags: ["confirmacao"], destino: "LAM-SIM-NAO" },
      { id: "Z-MESA-ESCALA", rotulo: "Escala", significado: "Abrir a zona de escala percentual.", tags: ["intensidade"], destino: "LAM-PERCENTUAL" },
      { id: "Z-MESA-TEMAS", rotulo: "Temas", significado: "Abrir a zona de áreas da vida.", tags: ["triagem"], destino: "LAM-AREAS-VIDA" },
      { id: "Z-MESA-TEMPO", rotulo: "Tempo", significado: "Abrir a zona de tempo.", tags: ["prazo"], destino: "LAM-TEMPO" },
    ],
    360,
    0,
    "navegação entre zonas; cada zona tem regra própria",
  ),
  tagsIndicacao: ["navegacao", "mesa"],
  modulosRelacionados: [],
  ativa: true,
};

// ===========================================================================
// Graficos radionicos: NAO sao lidos (dossie, p. 26)
// ===========================================================================
function grafico(
  id: string,
  nome: string,
  funcaoAtribuida: string,
  formaSvg: NonNullable<Lamina["formaSvg"]>,
): Lamina {
  return {
    id,
    versao: 1,
    tipo: "RADIONICO",
    nome,
    modoLeitura: "trabalho",
    autorELicenca: LIC,
    manual:
      `Função atribuída nas fontes: ${funcaoAtribuida} ` +
      "Este gráfico NÃO é uma superfície de leitura: o app não seleciona " +
      "palavra nem mede resultado nele. Registra-se apenas o uso, a versão " +
      "e a intenção declarada pelo terapeuta. Não se presume emissão física " +
      "nem se promete solução (dossiê, p. 26).",
    manualVersao: 1,
    configurada: true,
    geometria: {},
    zonas: [],
    formaSvg,
    tagsIndicacao: ["trabalho_simbolico"],
    modulosRelacionados: [],
    ativa: true,
  };
}

export const GRAFICOS_RADIONICOS: Lamina[] = [
  grafico("GRA-DECAGONO", "Decágono", "preparação e potencialização de testemunhos.", "decagono"),
  grafico("GRA-DECAGONOS", "Decágonos concêntricos", "variante geométrica do decágono.", "decagonos_concentricos"),
  grafico("GRA-NOVE-CIRCULOS", "Nove círculos", "família de círculos concêntricos, sem função comprovada.", "nove_circulos"),
  grafico("GRA-ESPIRAL", "Espiral geométrica", "aceleração e organização de processos, na linguagem da prática.", "espiral"),
];

/**
 * Nomes encontrados em catalogos (dossie, p. 27). Ficam disponiveis para
 * cadastro COMO TITULOS, sem significado preenchido: "O sistema deve permitir
 * 'descricao aguardando validacao do terapeuta', sem completar o significado
 * por imaginacao."
 */
export const NOMES_PARA_CADASTRO: { grupo: string; nomes: string[] }[] = [
  {
    grupo: "Leitura e mapeamento",
    nomes: [
      "Relógio Radiestésico", "Relógio das Cores", "Régua Floral de Bach",
      "Biômetro de Bovis", "Biômetro do Tempo", "Biômetro da Aura",
      "Biômetro dos Chakras", "Biômetro dos Gráficos",
      "Figura Humana frente e verso",
    ],
  },
  {
    grupo: "Formas e símbolos",
    nomes: [
      "Círculo", "Decágono", "Nove Círculos", "Tri-círculo", "Flor da Vida",
      "Cubo de Metatron", "Sri Yantra", "Vesica Piscis", "Cruz Ansata",
      "Cruz Atlante", "Cruz Cósmica", "Espiral", "Espiral Cósmica",
      "Trisquel", "Triqueta", "Vortex",
    ],
  },
  {
    grupo: "Variantes geométricas",
    nomes: [
      "Decágono Duplo", "Decágono Triplo", "Dodecágono com Diafragma",
      "Diafragma I", "Diafragma II", "Espiral Cósmica II", "Triquetra I",
      "Triquetra II", "Triluxor", "Trígono", "Triturador",
      "Triturador com Turbilhão",
    ],
  },
  {
    grupo: "Repertório de trabalho",
    nomes: [
      "Desimpregnador", "Desembaraçador Material",
      "Desembaraçador de Relacionamentos", "Escudo Protetor", "Escudo Mágico",
      "Equilíbrio", "Energizador", "Alta Vitalidade", "Devadata / Devadatta",
      "SCAP", "Luxor", "Gráfico dos Mestres", "Yoshua",
    ],
  },
  {
    grupo: "Turbilhões",
    nomes: [
      "Turbilhão", "Turbilhão Materializante", "Turbilhão com Prosperador",
      "Turbilhão com Sol", "Turbilhão com Lua", "Turbilhão com Mercúrio",
      "Turbilhão com Vênus", "Turbilhão com Marte", "Turbilhão com Júpiter",
      "Turbilhão com Saturno", "Turbilhão com Urano", "Turbilhão com Netuno",
    ],
  },
  {
    grupo: "Nomes com alegação de saúde (apenas títulos comerciais)",
    nomes: [
      "Anti Dor", "Anti Fadiga", "Anti Gripe", "Dinamizador do Fígado",
      "Relax Sono", "SOS Saúde", "Rejuvenescedor",
    ],
  },
];

// ===========================================================================
export const LAMINAS_LEITURA: Lamina[] = [
  L01, L02, L03, L04, L05, L06, L07, L08,
  L09, L10, L11, L12, L13, L14,
  L15_RELACIONAMENTO, L15_CARREIRA, L15_NEGOCIO,
  L16,
];

export const CATALOGO: Lamina[] = [...LAMINAS_LEITURA, ...GRAFICOS_RADIONICOS];

export function acharLamina(id: string): Lamina | undefined {
  return CATALOGO.find((l) => l.id === id);
}

export function acharZona(
  laminaId: string,
  zonaId: string,
): ZonaLamina | undefined {
  return acharLamina(laminaId)?.zonas.find((z) => z.id === zonaId);
}

/** Descricao visual curta, usada pela rota de visao do Gemini. */
export const DESCRICAO_VISUAL: Record<string, string> = {
  "LAM-SIM-NAO": "leque de meia-lua com três setores grandes rotulados Sim, Incerto e Não",
  "LAM-PERCENTUAL": "régua horizontal numerada de 0 a 100 em dez faixas",
  "LAM-NUMERICA": "régua horizontal numerada de 0 a 100 sem unidade impressa",
  "LAM-TEMPO": "leque de meia-lua com seis setores numéricos 1, 3, 7, 14, 30 e 60",
  "LAM-ALFANUMERICO": "leque com oito setores de grupos de letras A-D até U-Z, mais 0-9 e Outro",
  "LAM-BOVIS": "régua horizontal longa com marcas de milhares até 10000 e a sigla UB",
  "LAM-CHAKRAS": "eixo vertical com sete faixas nomeadas de Básico a Coronário",
  "LAM-FIGURA-CORPORAL": "silhueta humana simplificada dividida em cabeça, tronco, abdome e membros",
  "LAM-EMOCOES": "leque com seis palavras de sentimento: raiva, tristeza, alegria, medo, calma e outra",
  "LAM-AREAS-VIDA": "círculo completo com seis fatias nomeadas finanças, carreira, saúde, sentido, rotina e vínculos",
  "LAM-AMBIENTE": "grade quadriculada 4 por 4 com células A1 a D4",
  "LAM-CORES": "círculo dividido em oito fatias de cores",
  "LAM-RECURSOS": "leque com sete opções de apoio do dia a dia",
  "LAM-INDICE": "leque com sete setores que nomeiam outras lâminas",
  "LAM-TEMA-RELACIONAMENTO": "leque com seis temas de relacionamento",
  "LAM-TEMA-CARREIRA": "leque com seis temas de carreira",
  "LAM-TEMA-NEGOCIO": "leque com seis temas de negócio",
  "LAM-MESA-COMPOSTA": "círculo dividido em quatro quadrantes rotulados Sim/Não, Escala, Temas e Tempo",
  "GRA-DECAGONO": "polígono de dez lados com um ponto central marcado",
  "GRA-DECAGONOS": "decágonos concêntricos com centro marcado",
  "GRA-NOVE-CIRCULOS": "nove círculos concêntricos",
  "GRA-ESPIRAL": "espiral geométrica contínua",
};
