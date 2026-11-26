"use client";

/**
 * Desenha qualquer lamina a partir da geometria cadastrada.
 *
 * Um renderizador para todos os formatos, em vez de um arquivo de imagem por
 * prancha: assim o desenho e a geometria de leitura sao a MESMA fonte. Se o
 * desenho e o mapeamento de zonas divergissem, o app poderia mostrar um setor
 * e registrar outro.
 *
 * Tambem serve como superficie de toque para o registro manual, que e o
 * caminho principal do dossie (p. 35) e o fallback obrigatorio da camera.
 */
import type { Lamina, ZonaLamina } from "@/lib/tipos";

interface Props {
  lamina: Lamina;
  /** Zona em destaque, por id. */
  selecionada?: string;
  /** Zonas candidatas, quando o eixo aponta para dois setores. */
  candidatas?: string[];
  /** Eixo de oscilação medido, em graus, para desenhar sobre a lâmina. */
  eixoGraus?: number | null;
  onSelecionar?: (zona: ZonaLamina) => void;
  className?: string;
}

const COR_BORDA = "#31343f";
const COR_ZONA = "#23262f";
const COR_ZONA_ALT = "#1b1d25";
const COR_TEXTO = "#c9cbd4";
const COR_SEL = "#c2a36a";
const COR_CAND = "#6fa98a";

function polar(cx: number, cy: number, r: number, graus: number) {
  const rad = (graus * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function caminhoSetor(
  cx: number,
  cy: number,
  rInt: number,
  rExt: number,
  a0: number,
  a1: number,
): string {
  const p1 = polar(cx, cy, rExt, a0);
  const p2 = polar(cx, cy, rExt, a1);
  const p3 = polar(cx, cy, rInt, a1);
  const p4 = polar(cx, cy, rInt, a0);
  const grande = a1 - a0 > 180 ? 1 : 0;
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rExt} ${rExt} 0 ${grande} 0 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rInt} ${rInt} 0 ${grande} 1 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export default function LaminaSvg({
  lamina,
  selecionada,
  candidatas = [],
  eixoGraus,
  onSelecionar,
  className,
}: Props) {
  const corDe = (z: ZonaLamina, i: number) =>
    z.id === selecionada
      ? COR_SEL
      : candidatas.includes(z.id)
        ? COR_CAND
        : i % 2 === 0
          ? COR_ZONA
          : COR_ZONA_ALT;

  const textoDe = (z: ZonaLamina) =>
    z.id === selecionada ? "#1a1611" : COR_TEXTO;

  const clicavel = Boolean(onSelecionar);
  const comum = {
    className: className ?? "w-full h-auto",
    xmlns: "http://www.w3.org/2000/svg",
    role: "img" as const,
    "aria-label": lamina.nome,
  };

  // -- Graficos radionicos: forma fixa, sem zonas de leitura ---------------
  if (lamina.modoLeitura === "trabalho") {
    return (
      <svg {...comum} viewBox="0 0 320 320">
        <rect width="320" height="320" fill="none" />
        {lamina.formaSvg === "decagono" && (
          <>
            <Poligono cx={160} cy={160} r={120} lados={10} />
            <circle cx={160} cy={160} r={4} fill={COR_SEL} />
          </>
        )}
        {lamina.formaSvg === "decagonos_concentricos" && (
          <>
            {[120, 88, 56].map((r) => (
              <Poligono key={r} cx={160} cy={160} r={r} lados={10} />
            ))}
            <circle cx={160} cy={160} r={4} fill={COR_SEL} />
          </>
        )}
        {lamina.formaSvg === "nove_circulos" &&
          Array.from({ length: 9 }, (_, i) => (
            <circle
              key={i}
              cx={160}
              cy={160}
              r={16 + i * 13}
              fill="none"
              stroke={COR_BORDA}
              strokeWidth={1.6}
            />
          ))}
        {lamina.formaSvg === "espiral" && <Espiral cx={160} cy={160} />}
        <text
          x={160}
          y={308}
          textAnchor="middle"
          fontSize={12}
          fill={COR_TEXTO}
        >
          Gráfico de trabalho — não é superfície de leitura
        </text>
      </svg>
    );
  }

  // -- Leque / circulo -----------------------------------------------------
  if (lamina.modoLeitura === "setor_angular" || lamina.modoLeitura === "indice") {
    const abertura = lamina.geometria.aberturaGraus ?? 180;
    const circulo = abertura > 180;
    const cx = 200;
    const cy = circulo ? 200 : 232;
    const rExt = circulo ? 170 : 196;
    const rInt = circulo ? 54 : 44;
    const altura = circulo ? 400 : 250;

    return (
      <svg {...comum} viewBox={`0 0 400 ${altura}`}>
        {lamina.zonas.map((z, i) => {
          if (z.anguloInicio === undefined || z.anguloFim === undefined) {
            return null;
          }
          const meio = (z.anguloInicio + z.anguloFim) / 2;
          const pt = polar(cx, cy, (rInt + rExt) / 2, meio);
          return (
            <g
              key={z.id}
              onClick={clicavel ? () => onSelecionar?.(z) : undefined}
              style={clicavel ? { cursor: "pointer" } : undefined}
            >
              <path
                d={caminhoSetor(cx, cy, rInt, rExt, z.anguloInicio, z.anguloFim)}
                fill={corDe(z, i)}
                stroke={COR_BORDA}
                strokeWidth={1.4}
              />
              <text
                x={pt.x}
                y={pt.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={14}
                fontWeight={600}
                fill={textoDe(z)}
                transform={`rotate(${-(meio - 90) * 0} ${pt.x} ${pt.y})`}
              >
                {z.rotulo}
              </text>
            </g>
          );
        })}
        {typeof eixoGraus === "number" && (
          <EixoMedido
            cx={cx}
            cy={cy}
            r={rExt}
            graus={eixoGraus}
            duplo={circulo}
          />
        )}
        <circle cx={cx} cy={cy} r={5} fill={COR_BORDA} />
      </svg>
    );
  }

  // -- Regua ---------------------------------------------------------------
  if (lamina.modoLeitura === "escala_linear") {
    const vertical = lamina.geometria.orientacao === "vertical";
    const zonas = lamina.zonas.filter(
      (z) => z.valorMin !== undefined && z.valorMax !== undefined,
    );
    const min = Math.min(...zonas.map((z) => z.valorMin!));
    const max = Math.max(...zonas.map((z) => z.valorMax!));
    const amplitude = max - min || 1;

    if (vertical) {
      const alturaTotal = 420;
      const topo = 20;
      const alturaUtil = alturaTotal - topo * 2;
      return (
        <svg {...comum} viewBox="0 0 300 420">
          {zonas.map((z, i) => {
            const h = ((z.valorMax! - z.valorMin!) / amplitude) * alturaUtil;
            const y =
              topo + alturaUtil - ((z.valorMax! - min) / amplitude) * alturaUtil;
            return (
              <g
                key={z.id}
                onClick={clicavel ? () => onSelecionar?.(z) : undefined}
                style={clicavel ? { cursor: "pointer" } : undefined}
              >
                <rect
                  x={60}
                  y={y}
                  width={180}
                  height={h}
                  fill={corDe(z, i)}
                  stroke={COR_BORDA}
                  strokeWidth={1.3}
                />
                <text
                  x={150}
                  y={y + h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={14}
                  fontWeight={600}
                  fill={textoDe(z)}
                >
                  {z.rotulo}
                </text>
              </g>
            );
          })}
        </svg>
      );
    }

    const largura = 400;
    const esquerda = 14;
    const larguraUtil = largura - esquerda * 2;
    return (
      <svg {...comum} viewBox="0 0 400 150">
        {zonas.map((z, i) => {
          const w = ((z.valorMax! - z.valorMin!) / amplitude) * larguraUtil;
          const x = esquerda + ((z.valorMin! - min) / amplitude) * larguraUtil;
          return (
            <g
              key={z.id}
              onClick={clicavel ? () => onSelecionar?.(z) : undefined}
              style={clicavel ? { cursor: "pointer" } : undefined}
            >
              <rect
                x={x}
                y={44}
                width={w}
                height={56}
                fill={corDe(z, i)}
                stroke={COR_BORDA}
                strokeWidth={1.3}
              />
              <text
                x={x + w / 2}
                y={74}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fontWeight={600}
                fill={textoDe(z)}
              >
                {Math.round(z.valorMin!)}
              </text>
            </g>
          );
        })}
        <text x={esquerda} y={126} fontSize={12} fill={COR_TEXTO}>
          {Math.round(min)}
        </text>
        <text
          x={largura - esquerda}
          y={126}
          textAnchor="end"
          fontSize={12}
          fill={COR_TEXTO}
        >
          {Math.round(max)} {lamina.unidade ?? ""}
        </text>
        <text x={200} y={30} textAnchor="middle" fontSize={12} fill={COR_TEXTO}>
          {lamina.unidade ?? "sem unidade declarada"}
        </text>
      </svg>
    );
  }

  // -- Grade ---------------------------------------------------------------
  if (lamina.modoLeitura === "grade") {
    const colunas = lamina.geometria.colunas ?? [];
    const linhas = lamina.geometria.linhas ?? [];
    const lado = 360;
    const w = lado / colunas.length;
    const h = lado / linhas.length;
    return (
      <svg {...comum} viewBox="0 0 380 380">
        {linhas.map((l, il) =>
          colunas.map((c, ic) => {
            const celula = `${l}${c}`;
            const z = lamina.zonas.find((x) => x.celula === celula);
            if (!z) return null;
            return (
              <g
                key={celula}
                onClick={clicavel ? () => onSelecionar?.(z) : undefined}
                style={clicavel ? { cursor: "pointer" } : undefined}
              >
                <rect
                  x={10 + ic * w}
                  y={10 + il * h}
                  width={w}
                  height={h}
                  fill={corDe(z, il + ic)}
                  stroke={COR_BORDA}
                  strokeWidth={1.3}
                />
                <text
                  x={10 + ic * w + w / 2}
                  y={10 + il * h + h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={15}
                  fontWeight={600}
                  fill={textoDe(z)}
                >
                  {celula}
                </text>
              </g>
            );
          }),
        )}
      </svg>
    );
  }

  // -- Regioes (silhueta) --------------------------------------------------
  if (lamina.modoLeitura === "regiao") {
    const L = 280;
    const A = 420;
    return (
      <svg {...comum} viewBox="0 0 280 420">
        {lamina.zonas.map((z, i) => {
          if (!z.poligono) return null;
          const pontos = z.poligono
            .map(([px, py]) => `${(px * L).toFixed(1)},${(py * A).toFixed(1)}`)
            .join(" ");
          // O rótulo vai no alto da região, não no centróide: num polígono
          // côncavo (as pernas, por exemplo) o centróide cai fora da figura.
          const ys = z.poligono.map((p) => p[1]);
          const xs = z.poligono.map((p) => p[0]);
          const topo = Math.min(...ys);
          const base = Math.max(...ys);
          const cx = ((Math.min(...xs) + Math.max(...xs)) / 2) * L;
          const cy = (topo + (base - topo) * 0.25) * A;
          return (
            <g
              key={z.id}
              onClick={clicavel ? () => onSelecionar?.(z) : undefined}
              style={clicavel ? { cursor: "pointer" } : undefined}
            >
              <polygon
                points={pontos}
                fill={corDe(z, i)}
                stroke={COR_BORDA}
                strokeWidth={1.4}
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={14}
                fontWeight={600}
                fill={textoDe(z)}
              >
                {z.rotulo}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  return null;
}

function Poligono({
  cx,
  cy,
  r,
  lados,
}: {
  cx: number;
  cy: number;
  r: number;
  lados: number;
}) {
  const pontos = Array.from({ length: lados }, (_, i) => {
    const a = 90 + (360 / lados) * i;
    const p = polar(cx, cy, r, a);
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(" ");
  return (
    <polygon
      points={pontos}
      fill="none"
      stroke={COR_BORDA}
      strokeWidth={1.8}
    />
  );
}

function Espiral({ cx, cy }: { cx: number; cy: number }) {
  const passos = 320;
  const d = Array.from({ length: passos }, (_, i) => {
    const a = (i / passos) * 1440;
    const r = 6 + (i / passos) * 124;
    const p = polar(cx, cy, r, a);
    return `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }).join(" ");
  return <path d={d} fill="none" stroke={COR_BORDA} strokeWidth={1.8} />;
}

/** Eixo de oscilacao medido. Em circulo de 360 desenha os dois sentidos. */
function EixoMedido({
  cx,
  cy,
  r,
  graus,
  duplo,
}: {
  cx: number;
  cy: number;
  r: number;
  graus: number;
  duplo: boolean;
}) {
  const a = polar(cx, cy, r - 6, graus);
  const b = duplo ? polar(cx, cy, r - 6, graus + 180) : { x: cx, y: cy };
  return (
    <g>
      <line
        x1={b.x}
        y1={b.y}
        x2={a.x}
        y2={a.y}
        stroke="#e4705f"
        strokeWidth={2.4}
        strokeDasharray="7 5"
      />
      <circle cx={a.x} cy={a.y} r={4} fill="#e4705f" />
      {duplo && <circle cx={b.x} cy={b.y} r={4} fill="#e4705f" />}
    </g>
  );
}
