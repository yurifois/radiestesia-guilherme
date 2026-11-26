/**
 * Captura e analise do movimento do pendulo pela camera.
 *
 * Tudo roda no proprio aparelho: a imagem nao e enviada a servidor nenhum.
 * O que sai daqui e um punhado de numeros (eixo, linearidade, giro, energia).
 *
 * O que este modulo NAO faz, por decisao do dossie (p. 35):
 *  - nao escolhe setor por adivinhacao quando a captura e ambigua;
 *  - nao usa a anamnese para influenciar a escolha visual do setor;
 *  - nao confunde sombra do peso com posicao do peso (so mede movimento);
 *  - nao afirma que leitura visual correta mede energia.
 *
 * "Os limites numericos devem ser definidos com videos reais e testes, nao
 *  apresentados como valores universais" (dossie, p. 35). Por isso todos os
 *  limiares estao em LIMIARES, editaveis, e aparecem na tela de ajustes.
 */
import type {
  Lamina,
  MetricasCaptura,
  MotivoAbstencao,
  MovimentoPendulo,
  ZonaLamina,
} from "./tipos";

// ---------------------------------------------------------------------------
// Limiares. Provisorios: precisam ser calibrados com videos reais.
// ---------------------------------------------------------------------------
export interface Limiares {
  /** Energia minima de movimento para considerar que houve pendulação. */
  energiaMinima: number;
  /** Acima disto a nuvem de pontos conta como oscilação em eixo. */
  linearidadeMinima: number;
  /** Abaixo disto, com baixa linearidade, conta como giro. */
  giroMinimo: number;
  /** Desvio máximo do eixo dentro da janela, em graus. */
  instabilidadeMaximaGraus: number;
  /** Nitidez mínima estimada do quadro. */
  nitidezMinima: number;
  /** Distância mínima da fronteira de setor, em graus. */
  toleranciaFronteiraGraus: number;
  /** Distância mínima da fronteira em escalas/grades, em fração da faixa. */
  toleranciaFronteiraFracao: number;
  /** Quadros mínimos na janela de análise. */
  quadrosMinimos: number;
}

export const LIMIARES: Limiares = {
  energiaMinima: 0.012,
  linearidadeMinima: 0.55,
  giroMinimo: 0.05,
  instabilidadeMaximaGraus: 14,
  nitidezMinima: 0.08,
  toleranciaFronteiraGraus: 6,
  toleranciaFronteiraFracao: 0.08,
  quadrosMinimos: 24,
};

// ---------------------------------------------------------------------------
// Calibracao: onde a lamina esta no quadro da camera
// ---------------------------------------------------------------------------
/** Retangulo que enquadra a lamina, em coordenadas normalizadas 0..1. */
export interface Calibracao {
  x: number;
  y: number;
  largura: number;
  altura: number;
  /** Rotação da lâmina na mesa, em graus, anti-horário. */
  rotacaoGraus: number;
}

export const CALIBRACAO_PADRAO: Calibracao = {
  x: 0.1,
  y: 0.18,
  largura: 0.8,
  altura: 0.64,
  rotacaoGraus: 0,
};

// ---------------------------------------------------------------------------
// Amostragem
// ---------------------------------------------------------------------------
interface Amostra {
  /** Centroide do movimento, em coordenadas normalizadas do quadro. */
  x: number;
  y: number;
  /** Magnitude do movimento neste quadro, 0..1. */
  energia: number;
  nitidez: number;
  t: number;
}

const LARGURA_ANALISE = 160;
const ALTURA_ANALISE = 120;
const JANELA_MS = 2500;

/**
 * Le quadros do video, calcula o centroide do movimento por diferenca entre
 * quadros e mantem uma janela deslizante de amostras.
 */
export class TrackerPendulo {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private anterior: Uint8ClampedArray | null = null;
  private amostras: Amostra[] = [];

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = LARGURA_ANALISE;
    this.canvas.height = ALTURA_ANALISE;
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D indisponível neste navegador.");
    this.ctx = ctx;
  }

  limpar(): void {
    this.anterior = null;
    this.amostras = [];
  }

  /** Processa um quadro. Chamar dentro de requestAnimationFrame. */
  processarQuadro(video: HTMLVideoElement, agoraMs: number): void {
    if (video.readyState < 2 || video.videoWidth === 0) return;

    this.ctx.drawImage(video, 0, 0, LARGURA_ANALISE, ALTURA_ANALISE);
    const dados = this.ctx.getImageData(0, 0, LARGURA_ANALISE, ALTURA_ANALISE)
      .data;

    // Luminancia em escala de cinza.
    const cinza = new Uint8ClampedArray(LARGURA_ANALISE * ALTURA_ANALISE);
    for (let i = 0, p = 0; i < cinza.length; i++, p += 4) {
      cinza[i] = (dados[p] * 299 + dados[p + 1] * 587 + dados[p + 2] * 114) / 1000;
    }

    const nitidez = estimarNitidez(cinza);

    if (this.anterior) {
      let soma = 0;
      let somaX = 0;
      let somaY = 0;
      for (let y = 0; y < ALTURA_ANALISE; y++) {
        for (let x = 0; x < LARGURA_ANALISE; x++) {
          const i = y * LARGURA_ANALISE + x;
          const d = Math.abs(cinza[i] - this.anterior[i]);
          // Ignora ruido de sensor.
          if (d > 18) {
            soma += d;
            somaX += x * d;
            somaY += y * d;
          }
        }
      }
      if (soma > 0) {
        this.amostras.push({
          x: somaX / soma / LARGURA_ANALISE,
          y: somaY / soma / ALTURA_ANALISE,
          energia: Math.min(1, soma / (LARGURA_ANALISE * ALTURA_ANALISE * 255)),
          nitidez,
          t: agoraMs,
        });
      }
    }

    this.anterior = cinza;
    const corte = agoraMs - JANELA_MS;
    while (this.amostras.length > 0 && this.amostras[0].t < corte) {
      this.amostras.shift();
    }
  }

  /** Metricas da janela atual, ou null se ainda nao ha amostras suficientes. */
  metricas(): MetricasCaptura | null {
    return analisarJanela(this.amostras);
  }

  /** Centroide medio da janela, em coordenadas normalizadas do quadro. */
  centroide(): { x: number; y: number } | null {
    if (this.amostras.length === 0) return null;
    const n = this.amostras.length;
    return {
      x: this.amostras.reduce((s, a) => s + a.x, 0) / n,
      y: this.amostras.reduce((s, a) => s + a.y, 0) / n,
    };
  }

  quantidadeAmostras(): number {
    return this.amostras.length;
  }
}

/** Variancia do laplaciano, normalizada. Proxy simples de foco. */
function estimarNitidez(cinza: Uint8ClampedArray): number {
  let soma = 0;
  let soma2 = 0;
  let n = 0;
  for (let y = 1; y < ALTURA_ANALISE - 1; y++) {
    for (let x = 1; x < LARGURA_ANALISE - 1; x++) {
      const i = y * LARGURA_ANALISE + x;
      const l =
        4 * cinza[i] -
        cinza[i - 1] -
        cinza[i + 1] -
        cinza[i - LARGURA_ANALISE] -
        cinza[i + LARGURA_ANALISE];
      soma += l;
      soma2 += l * l;
      n++;
    }
  }
  if (n === 0) return 0;
  const media = soma / n;
  const variancia = soma2 / n - media * media;
  return Math.min(1, Math.sqrt(Math.max(0, variancia)) / 40);
}

// ---------------------------------------------------------------------------
// Analise da janela
// ---------------------------------------------------------------------------
function analisarJanela(amostras: Amostra[]): MetricasCaptura | null {
  const n = amostras.length;
  if (n < 6) return null;

  const cx = amostras.reduce((s, a) => s + a.x, 0) / n;
  const cy = amostras.reduce((s, a) => s + a.y, 0) / n;

  // Covariancia 2x2 da nuvem de centroides.
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const a of amostras) {
    const dx = a.x - cx;
    const dy = a.y - cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  sxx /= n;
  syy /= n;
  sxy /= n;

  const { angulo, lambda1, lambda2 } = eigen2x2(sxx, sxy, syy);
  const linearidade = lambda1 > 1e-12 ? 1 - lambda2 / lambda1 : 0;

  // Soma do produto vetorial: sentido do giro.
  // Em tela, y cresce para baixo; o sinal e invertido para que
  // positivo = anti-horario do ponto de vista de quem olha a lamina.
  let cruz = 0;
  for (let i = 0; i < n - 1; i++) {
    const ax = amostras[i].x - cx;
    const ay = amostras[i].y - cy;
    const bx = amostras[i + 1].x - cx;
    const by = amostras[i + 1].y - cy;
    cruz += ax * by - ay * bx;
  }
  const escala = Math.max(lambda1, 1e-12);
  const somaRotacional = -cruz / (escala * Math.max(1, n - 1)) / 2;

  // Instabilidade: compara o eixo de cada terco da janela.
  const instabilidadeGraus = instabilidadeDoEixo(amostras, cx, cy);

  const energia = amostras.reduce((s, a) => s + a.energia, 0) / n;
  const nitidez = amostras.reduce((s, a) => s + a.nitidez, 0) / n;

  return {
    eixoGraus: grausNormalizados(angulo),
    linearidade,
    instabilidadeGraus,
    somaRotacional,
    energia,
    quadros: n,
    nitidez,
  };
}

/** Autovetor principal de [[a,b],[b,c]]. Angulo em radianos, eixo maior. */
function eigen2x2(
  a: number,
  b: number,
  c: number,
): { angulo: number; lambda1: number; lambda2: number } {
  const tr = a + c;
  const det = a * c - b * b;
  const raiz = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const lambda1 = tr / 2 + raiz;
  const lambda2 = tr / 2 - raiz;
  // Autovetor de lambda1.
  let vx: number;
  let vy: number;
  if (Math.abs(b) > 1e-14) {
    vx = lambda1 - c;
    vy = b;
  } else {
    // Matriz diagonal: o eixo e um dos eixos coordenados.
    if (a >= c) {
      vx = 1;
      vy = 0;
    } else {
      vx = 0;
      vy = 1;
    }
  }
  // y da tela cresce para baixo: inverte para o referencial da lamina.
  return { angulo: Math.atan2(-vy, vx), lambda1, lambda2: Math.max(0, lambda2) };
}

function instabilidadeDoEixo(
  amostras: Amostra[],
  cx: number,
  cy: number,
): number {
  const terco = Math.floor(amostras.length / 3);
  if (terco < 4) return 0;
  const angulos: number[] = [];
  for (let k = 0; k < 3; k++) {
    const fatia = amostras.slice(k * terco, (k + 1) * terco);
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (const a of fatia) {
      const dx = a.x - cx;
      const dy = a.y - cy;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    }
    const m = fatia.length;
    const { angulo } = eigen2x2(sxx / m, sxy / m, syy / m);
    angulos.push(grausNormalizados(angulo));
  }
  // Eixo e modulo 180: compara pela menor diferenca circular.
  let maior = 0;
  for (let i = 0; i < angulos.length; i++) {
    for (let j = i + 1; j < angulos.length; j++) {
      maior = Math.max(maior, difAngularModulo180(angulos[i], angulos[j]));
    }
  }
  return maior;
}

/** Radianos -> graus em [0, 180). Um eixo nao distingue os dois sentidos. */
function grausNormalizados(rad: number): number {
  let g = (rad * 180) / Math.PI;
  g = ((g % 180) + 180) % 180;
  return g;
}

function difAngularModulo180(a: number, b: number): number {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
}

// ---------------------------------------------------------------------------
// Classificacao do movimento
// ---------------------------------------------------------------------------
export function classificarMovimento(
  m: MetricasCaptura,
  lim: Limiares = LIMIARES,
): { movimento: MovimentoPendulo; motivos: MotivoAbstencao[] } {
  const motivos: MotivoAbstencao[] = [];

  if (m.quadros < lim.quadrosMinimos) motivos.push("fora_do_enquadramento");
  if (m.nitidez < lim.nitidezMinima) motivos.push("baixa_nitidez");
  if (m.energia < lim.energiaMinima) {
    motivos.push("energia_insuficiente");
    return { movimento: "imovel", motivos };
  }

  if (m.linearidade >= lim.linearidadeMinima) {
    if (m.instabilidadeGraus > lim.instabilidadeMaximaGraus) {
      motivos.push("movimento_sem_estabilidade");
    }
    return { movimento: "oscilacao", motivos };
  }

  if (Math.abs(m.somaRotacional) >= lim.giroMinimo) {
    return {
      movimento: m.somaRotacional > 0 ? "giro_antihorario" : "giro_horario",
      motivos,
    };
  }

  motivos.push("movimento_sem_estabilidade");
  return { movimento: "indefinido", motivos };
}

// ---------------------------------------------------------------------------
// Do movimento para a zona da lamina
// ---------------------------------------------------------------------------
export interface Leitura {
  movimento: MovimentoPendulo;
  /** Zona unica, quando a geometria resolve a ambiguidade. */
  zona?: ZonaLamina;
  /**
   * Candidatas, quando o eixo aponta para dois setores opostos num circulo
   * de 360 graus. Dossie, p. 35: "A escolha depende da geometria e da
   * convencao, nao de uma suposicao do algoritmo."
   */
  candidatas?: ZonaLamina[];
  valor?: { numero: number; unidade: string; min: number; max: number };
  motivos: MotivoAbstencao[];
  metricas: MetricasCaptura;
}

/**
 * Traduz as metricas e o centroide em zona da lamina.
 * Devolve motivos de abstencao em vez de forcar uma resposta.
 */
export function mapearParaZona(
  lamina: Lamina,
  metricas: MetricasCaptura,
  centroide: { x: number; y: number } | null,
  calibracao: Calibracao,
  temConvencao: boolean,
  sentidoDeLeitura: "lado_da_prancha" | "ambos_os_lados" | "definido_pelo_terapeuta",
  lim: Limiares = LIMIARES,
): Leitura {
  const { movimento, motivos } = classificarMovimento(metricas, lim);
  const base: Leitura = { movimento, motivos: [...motivos], metricas };

  if (!temConvencao) {
    base.motivos.push("sem_convencao");
    return base;
  }
  if (!lamina.configurada) {
    base.motivos.push("lamina_nao_configurada");
    return base;
  }
  if (lamina.modoLeitura === "trabalho") {
    // Grafico radionico: nao se le nada nele.
    base.motivos.push("lamina_nao_configurada");
    return base;
  }
  if (base.motivos.length > 0) return base;

  switch (lamina.modoLeitura) {
    case "setor_angular":
    case "indice":
      return mapearAngular(lamina, base, calibracao, sentidoDeLeitura, lim);
    case "escala_linear":
      return mapearLinear(lamina, base, centroide, calibracao, lim);
    case "grade":
      return mapearGrade(lamina, base, centroide, calibracao, lim);
    case "regiao":
      return mapearRegiao(lamina, base, centroide, calibracao);
    default:
      base.motivos.push("lamina_nao_configurada");
      return base;
  }
}

function mapearAngular(
  lamina: Lamina,
  base: Leitura,
  calibracao: Calibracao,
  sentidoDeLeitura: "lado_da_prancha" | "ambos_os_lados" | "definido_pelo_terapeuta",
  lim: Limiares,
): Leitura {
  if (base.movimento !== "oscilacao") {
    // Giro ou imovel nao aponta setor: so a convencao da sessao diz o que
    // significa, e isso e registro manual.
    base.motivos.push("movimento_sem_estabilidade");
    return base;
  }
  if (base.metricas.eixoGraus === null) {
    base.motivos.push("sem_referencia_geometrica");
    return base;
  }

  const abertura = lamina.geometria.aberturaGraus ?? 180;
  const rotacaoLamina =
    (lamina.geometria.rotacaoGraus ?? 0) + calibracao.rotacaoGraus;

  // Eixo em [0,180). Ja resolve a ambiguidade num leque de 180 graus:
  // so um dos dois sentidos do eixo cai sobre a prancha.
  const eixo = base.metricas.eixoGraus;

  if (abertura <= 180) {
    const a = normalizar(eixo - rotacaoLamina, 180);
    const zona = zonaNoAngulo(lamina.zonas, a, lim.toleranciaFronteiraGraus);
    if (!zona) {
      base.motivos.push("fronteira_de_zonas");
      return base;
    }
    base.zona = zona;
    return base;
  }

  // Circulo de 360: o eixo tem dois sentidos possiveis.
  const a1 = normalizar(eixo - rotacaoLamina, 360);
  const a2 = normalizar(a1 + 180, 360);
  const z1 = zonaNoAngulo(lamina.zonas, a1, lim.toleranciaFronteiraGraus);
  const z2 = zonaNoAngulo(lamina.zonas, a2, lim.toleranciaFronteiraGraus);

  if (!z1 || !z2) {
    base.motivos.push("fronteira_de_zonas");
    return base;
  }
  if (z1.id === z2.id) {
    base.zona = z1;
    return base;
  }
  if (sentidoDeLeitura === "ambos_os_lados") {
    base.candidatas = [z1, z2];
    return base;
  }
  // "lado_da_prancha" nao se aplica a 360 graus; "definido_pelo_terapeuta"
  // exige escolha humana. Nos dois casos: nao decidir no algoritmo.
  base.candidatas = [z1, z2];
  base.motivos.push("fronteira_de_zonas");
  return base;
}

function zonaNoAngulo(
  zonas: ZonaLamina[],
  angulo: number,
  tolerancia: number,
): ZonaLamina | undefined {
  for (const z of zonas) {
    if (z.anguloInicio === undefined || z.anguloFim === undefined) continue;
    if (angulo >= z.anguloInicio && angulo < z.anguloFim) {
      const distInicio = angulo - z.anguloInicio;
      const distFim = z.anguloFim - angulo;
      if (Math.min(distInicio, distFim) < tolerancia) return undefined;
      return z;
    }
  }
  return undefined;
}

function mapearLinear(
  lamina: Lamina,
  base: Leitura,
  centroide: { x: number; y: number } | null,
  calibracao: Calibracao,
  lim: Limiares,
): Leitura {
  if (!centroide) {
    base.motivos.push("sem_referencia_geometrica");
    return base;
  }
  // Em regua, le-se POSICAO. A oscilacao deve ser transversal ao eixo da
  // regua; se estiver ao longo dela, a posicao fica indefinida.
  const vertical = lamina.geometria.orientacao === "vertical";
  const eixo = base.metricas.eixoGraus;
  if (eixo !== null) {
    const anguloDaRegua = vertical ? 90 : 0;
    const desvio = difAngularModulo180(
      normalizar(eixo - calibracao.rotacaoGraus, 180),
      anguloDaRegua,
    );
    // Oscilacao paralela a regua: nao da para localizar a posicao.
    if (desvio < 25) {
      base.motivos.push("movimento_sem_estabilidade");
      return base;
    }
  }

  const fracao = vertical
    ? 1 - (centroide.y - calibracao.y) / calibracao.altura
    : (centroide.x - calibracao.x) / calibracao.largura;

  if (fracao < 0 || fracao > 1) {
    base.motivos.push("fora_do_enquadramento");
    return base;
  }

  const zonas = lamina.zonas.filter(
    (z) => z.valorMin !== undefined && z.valorMax !== undefined,
  );
  if (zonas.length === 0) {
    base.motivos.push("lamina_nao_configurada");
    return base;
  }
  const min = Math.min(...zonas.map((z) => z.valorMin!));
  const max = Math.max(...zonas.map((z) => z.valorMax!));
  const numero = min + fracao * (max - min);

  const zona = zonas.find((z) => numero >= z.valorMin! && numero < z.valorMax!)
    ?? zonas[zonas.length - 1];

  const faixa = zona.valorMax! - zona.valorMin!;
  const margem = faixa * lim.toleranciaFronteiraFracao;
  if (
    numero - zona.valorMin! < margem ||
    zona.valorMax! - numero < margem
  ) {
    base.motivos.push("fronteira_de_zonas");
    return base;
  }

  base.zona = zona;
  base.valor = {
    numero: Math.round(numero * 100) / 100,
    unidade: lamina.unidade ?? "sem unidade declarada",
    min,
    max,
  };
  return base;
}

function mapearGrade(
  lamina: Lamina,
  base: Leitura,
  centroide: { x: number; y: number } | null,
  calibracao: Calibracao,
  lim: Limiares,
): Leitura {
  if (!centroide) {
    base.motivos.push("sem_referencia_geometrica");
    return base;
  }
  const colunas = lamina.geometria.colunas ?? [];
  const linhas = lamina.geometria.linhas ?? [];
  if (colunas.length === 0 || linhas.length === 0) {
    base.motivos.push("lamina_nao_configurada");
    return base;
  }

  const fx = (centroide.x - calibracao.x) / calibracao.largura;
  const fy = (centroide.y - calibracao.y) / calibracao.altura;
  if (fx < 0 || fx > 1 || fy < 0 || fy > 1) {
    base.motivos.push("fora_do_enquadramento");
    return base;
  }

  const larguraCelula = 1 / colunas.length;
  const alturaCelula = 1 / linhas.length;
  const ic = Math.min(colunas.length - 1, Math.floor(fx / larguraCelula));
  const il = Math.min(linhas.length - 1, Math.floor(fy / alturaCelula));

  // Fronteira entre celulas: abster.
  const dentroX = (fx % larguraCelula) / larguraCelula;
  const dentroY = (fy % alturaCelula) / alturaCelula;
  const tol = lim.toleranciaFronteiraFracao;
  if (
    dentroX < tol || dentroX > 1 - tol ||
    dentroY < tol || dentroY > 1 - tol
  ) {
    base.motivos.push("fronteira_de_zonas");
    return base;
  }

  const celula = `${linhas[il]}${colunas[ic]}`;
  const zona = lamina.zonas.find((z) => z.celula === celula);
  if (!zona) {
    base.motivos.push("lamina_nao_configurada");
    return base;
  }
  base.zona = zona;
  return base;
}

function mapearRegiao(
  lamina: Lamina,
  base: Leitura,
  centroide: { x: number; y: number } | null,
  calibracao: Calibracao,
): Leitura {
  if (!centroide) {
    base.motivos.push("sem_referencia_geometrica");
    return base;
  }
  const fx = (centroide.x - calibracao.x) / calibracao.largura;
  const fy = (centroide.y - calibracao.y) / calibracao.altura;
  if (fx < 0 || fx > 1 || fy < 0 || fy > 1) {
    base.motivos.push("fora_do_enquadramento");
    return base;
  }
  const zona = lamina.zonas.find(
    (z) => z.poligono && pontoEmPoligono(fx, fy, z.poligono),
  );
  if (!zona) {
    base.motivos.push("fronteira_de_zonas");
    return base;
  }
  base.zona = zona;
  return base;
}

function pontoEmPoligono(
  x: number,
  y: number,
  poligono: [number, number][],
): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i];
    const [xj, yj] = poligono[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

function normalizar(valor: number, modulo: number): number {
  return ((valor % modulo) + modulo) % modulo;
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------
export const TEXTO_ABSTENCAO: Record<MotivoAbstencao, string> = {
  lamina_desconhecida: "A lâmina na mesa não foi identificada.",
  lamina_nao_configurada:
    "Esta lâmina não tem manual, geometria ou significado cadastrados.",
  sem_convencao: "A convenção desta sessão ainda não foi registrada.",
  baixa_nitidez: "A imagem está pouco nítida para medir o movimento.",
  movimento_sem_estabilidade:
    "O movimento não se estabilizou num eixo nem num giro.",
  fronteira_de_zonas:
    "O movimento ficou na fronteira entre zonas. Não há setor definido.",
  sem_referencia_geometrica:
    "Falta a referência geométrica da lâmina no enquadramento.",
  energia_insuficiente: "Quase não houve movimento detectável.",
  fora_do_enquadramento: "O movimento saiu da área calibrada da lâmina.",
};

export const TEXTO_MOVIMENTO: Record<MovimentoPendulo, string> = {
  oscilacao: "Oscilação em eixo",
  giro_horario: "Giro horário",
  giro_antihorario: "Giro anti-horário",
  imovel: "Praticamente imóvel",
  indefinido: "Indefinido",
};

// ===========================================================================
// Vigia de cena: percebe que a prancha sobre a mesa mudou.
//
// A ideia e simples e barata: uma miniatura 32x24 em escala de cinza,
// normalizada (media zero, desvio um) para que mudanca de luz nao conte como
// mudanca de prancha. A miniatura entra numa media movel lenta, para que o
// pendulo balancando - que ocupa um ou dois pontos da grade - nao desloque a
// assinatura. Quando a assinatura suavizada se afasta da assinatura da ultima
// identificacao, e a imagem volta a ficar parada (a mao saiu da frente), e
// hora de olhar de novo quem esta na mesa.
//
// Nenhum quadro sai do aparelho por causa disto. O vigia so decide QUANDO
// vale a pena tirar uma foto; quem envia a foto e o componente da camera, e
// so com a autorizacao de envio a fornecedor de IA registrada.
// ===========================================================================

export const CENA = {
  largura: 32,
  altura: 24,
  /** Intervalo entre amostras da miniatura. Nao precisa de 60 por segundo. */
  msEntreAmostras: 120,
  /** Peso do quadro novo na media movel. Baixo para o pendulo nao pesar. */
  suavizacao: 0.14,
  /** Distancia a partir da qual a cena conta como outra prancha. */
  limiarTroca: 0.3,
  /** Abaixo disto a cena esta parada: ninguem mexendo na mesa. */
  limiarParada: 0.06,
  /** Quanto tempo parada antes de valer uma foto. */
  msParaEstabilizar: 1200,
  /** Tempo minimo entre duas identificacoes. */
  msEntreIdentificacoes: 8000,
};

export interface EstadoCena {
  /** Distancia da cena atual para a cena da ultima identificacao. */
  distancia: number;
  /** A imagem parou de mudar. */
  parada: boolean;
  /** Ha quanto tempo esta parada, em ms. */
  paradaHaMs: number;
  /** Afastou-se o bastante da ultima identificacao. */
  mudou: boolean;
  /** Ainda nao houve nenhuma identificacao nesta sessao de camera. */
  semReferencia: boolean;
}

function assinaturaNormalizada(cinza: Float32Array): Float32Array {
  let soma = 0;
  for (const v of cinza) soma += v;
  const media = soma / cinza.length;
  let variancia = 0;
  for (const v of cinza) variancia += (v - media) * (v - media);
  const desvio = Math.sqrt(variancia / cinza.length) || 1;
  const saida = new Float32Array(cinza.length);
  for (let i = 0; i < cinza.length; i++) saida[i] = (cinza[i] - media) / desvio;
  return saida;
}

function distanciaMedia(a: Float32Array, b: Float32Array): number {
  let soma = 0;
  for (let i = 0; i < a.length; i++) soma += Math.abs(a[i] - b[i]);
  return soma / a.length;
}

export class VigiaDeCena {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private suave: Float32Array | null = null;
  private anterior: Float32Array | null = null;
  private referencia: Float32Array | null = null;
  private paradaDesde: number | null = null;
  private ultimaAmostra = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = CENA.largura;
    this.canvas.height = CENA.altura;
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D indisponível neste navegador.");
    this.ctx = ctx;
  }

  limpar(): void {
    this.suave = null;
    this.anterior = null;
    this.referencia = null;
    this.paradaDesde = null;
    this.ultimaAmostra = 0;
  }

  /** Marca a cena atual como a cena ja identificada. */
  marcarIdentificada(): void {
    if (this.suave) this.referencia = this.suave.slice();
  }

  /**
   * Devolve o estado da cena, ou null quando ainda nao ha o que dizer
   * (quadro cedo demais depois da ultima amostra, video sem imagem).
   */
  processar(video: HTMLVideoElement, agoraMs: number): EstadoCena | null {
    if (video.readyState < 2 || video.videoWidth === 0) return null;
    if (agoraMs - this.ultimaAmostra < CENA.msEntreAmostras) return null;
    this.ultimaAmostra = agoraMs;

    this.ctx.drawImage(video, 0, 0, CENA.largura, CENA.altura);
    const dados = this.ctx.getImageData(0, 0, CENA.largura, CENA.altura).data;
    const cinza = new Float32Array(CENA.largura * CENA.altura);
    for (let i = 0, p = 0; i < cinza.length; i++, p += 4) {
      cinza[i] =
        (dados[p] * 299 + dados[p + 1] * 587 + dados[p + 2] * 114) / 1000;
    }
    const nova = assinaturaNormalizada(cinza);

    if (!this.suave) {
      this.suave = nova.slice();
    } else {
      const k = CENA.suavizacao;
      for (let i = 0; i < nova.length; i++) {
        this.suave[i] = this.suave[i] * (1 - k) + nova[i] * k;
      }
    }

    const movimentoDaCena = this.anterior
      ? distanciaMedia(this.suave, this.anterior)
      : Number.POSITIVE_INFINITY;
    this.anterior = this.suave.slice();

    const parada = movimentoDaCena < CENA.limiarParada;
    if (parada) {
      if (this.paradaDesde === null) this.paradaDesde = agoraMs;
    } else {
      this.paradaDesde = null;
    }

    const distancia = this.referencia
      ? distanciaMedia(this.suave, this.referencia)
      : 0;

    return {
      distancia,
      parada,
      paradaHaMs: this.paradaDesde === null ? 0 : agoraMs - this.paradaDesde,
      mudou: Boolean(this.referencia) && distancia > CENA.limiarTroca,
      semReferencia: this.referencia === null,
    };
  }
}
