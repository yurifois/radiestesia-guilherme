"use client";

/**
 * Camera aberta sobre a lamina, com overlay calibravel e tracker local.
 *
 * O processamento todo acontece aqui, no aparelho. Nenhum quadro de video sai
 * do celular. A unica coisa que pode ser enviada e UMA foto, sob demanda, para
 * identificar qual prancha esta na mesa, e so se houver consentimento.
 *
 * A camera e um auxilio, nao a autoridade: toda leitura passa por confirmacao
 * do terapeuta, e a selecao manual sobre o desenho esta sempre disponivel
 * (dossie, p. 35: "Solicitar revisao e confirmacao do terapeuta").
 */
import { useCallback, useEffect, useRef, useState } from "react";
import LaminaSvg from "./LaminaSvg";
import {
  CALIBRACAO_PADRAO,
  type Calibracao,
  type Leitura,
  mapearParaZona,
  TEXTO_ABSTENCAO,
  TEXTO_MOVIMENTO,
  TrackerPendulo,
} from "@/lib/pendulo";
import type { Lamina, MetricasCaptura, ZonaLamina } from "@/lib/tipos";
import { CATALOGO, DESCRICAO_VISUAL } from "@/data/laminas";

interface Props {
  lamina: Lamina;
  temConvencao: boolean;
  sentidoDeLeitura:
    | "lado_da_prancha"
    | "ambos_os_lados"
    | "definido_pelo_terapeuta";
  /** Autorização de captura de vídeo (consentimento próprio). */
  podeUsarCamera: boolean;
  /** Autorização de envio a fornecedor de IA. */
  podeEnviarAIa: boolean;
  onRegistrar: (leitura: Leitura, modo: "camera" | "manual") => void;
  onTrocarLamina?: (laminaId: string) => void;
}

const CHAVE_CALIBRACAO = "radiestesia:calibracao";

export default function CameraPendulo({
  lamina,
  temConvencao,
  sentidoDeLeitura,
  podeUsarCamera,
  podeEnviarAIa,
  onRegistrar,
  onTrocarLamina,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackerRef = useRef<TrackerPendulo | null>(null);
  const loopRef = useRef<number | null>(null);
  const fluxoRef = useRef<MediaStream | null>(null);

  const [ligada, setLigada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [calibrando, setCalibrando] = useState(false);
  const [calibracao, setCalibracao] = useState<Calibracao>(CALIBRACAO_PADRAO);
  const [metricas, setMetricas] = useState<MetricasCaptura | null>(null);
  const [previa, setPrevia] = useState<Leitura | null>(null);
  const [identificando, setIdentificando] = useState(false);
  const [avisoVisao, setAvisoVisao] = useState<string | null>(null);
  const [zonaManual, setZonaManual] = useState<ZonaLamina | null>(null);

  // Calibracao e preferencia do terapeuta, nao dado de pessoa atendida.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_CALIBRACAO);
      if (salvo) setCalibracao({ ...CALIBRACAO_PADRAO, ...JSON.parse(salvo) });
    } catch {
      /* calibração padrão */
    }
  }, []);

  const salvarCalibracao = useCallback((c: Calibracao) => {
    setCalibracao(c);
    try {
      localStorage.setItem(CHAVE_CALIBRACAO, JSON.stringify(c));
    } catch {
      /* sem persistência: segue com a calibração da sessão */
    }
  }, []);

  const desligar = useCallback(() => {
    if (loopRef.current !== null) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    fluxoRef.current?.getTracks().forEach((t) => t.stop());
    fluxoRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    trackerRef.current?.limpar();
    setLigada(false);
    setMetricas(null);
    setPrevia(null);
  }, []);

  useEffect(() => desligar, [desligar]);

  const ligar = useCallback(async () => {
    setErro(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro(
        "Este navegador não dá acesso à câmera. Em celular, a câmera só funciona em HTTPS.",
      );
      return;
    }
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      fluxoRef.current = fluxo;
      if (videoRef.current) {
        videoRef.current.srcObject = fluxo;
        await videoRef.current.play();
      }
      trackerRef.current = new TrackerPendulo();
      setLigada(true);

      const passo = (t: number) => {
        const v = videoRef.current;
        const tr = trackerRef.current;
        if (v && tr) {
          tr.processarQuadro(v, t);
          const m = tr.metricas();
          setMetricas(m);
          if (m) {
            setPrevia(
              mapearParaZona(
                lamina,
                m,
                tr.centroide(),
                calibracao,
                temConvencao,
                sentidoDeLeitura,
              ),
            );
          }
        }
        loopRef.current = requestAnimationFrame(passo);
      };
      loopRef.current = requestAnimationFrame(passo);
    } catch (e) {
      const nome = e instanceof DOMException ? e.name : "";
      setErro(
        nome === "NotAllowedError"
          ? "Permissão de câmera negada. Libere o acesso nas configurações do navegador."
          : nome === "NotFoundError"
            ? "Nenhuma câmera encontrada neste aparelho."
            : "Não foi possível abrir a câmera.",
      );
    }
    // lamina/calibracao sao lidos dentro do loop a cada quadro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lamina, calibracao, temConvencao, sentidoDeLeitura]);

  async function identificarLamina() {
    const v = videoRef.current;
    if (!v || !podeEnviarAIa) return;
    setIdentificando(true);
    setAvisoVisao(null);
    try {
      const c = document.createElement("canvas");
      c.width = 960;
      c.height = Math.round((960 * v.videoHeight) / v.videoWidth) || 540;
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/jpeg", 0.82);
      const base64 = dataUrl.split(",")[1] ?? "";

      const r = await fetch("/api/gemini/visao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagemBase64: base64,
          mimeType: "image/jpeg",
          candidatas: CATALOGO.filter((l) => l.configurada).map((l) => ({
            id: l.id,
            nome: l.nome,
            descricaoVisual: DESCRICAO_VISUAL[l.id] ?? l.nome,
          })),
        }),
      });
      const corpo = await r.json();
      if (!r.ok) {
        setAvisoVisao(corpo?.erro ?? "Falha ao identificar a lâmina.");
        return;
      }
      const resp = corpo.resposta as {
        laminaId: string | null;
        confiancaDeclarada: string;
        justificativa: string;
        impedimentos: string[];
      };
      if (!resp.laminaId) {
        setAvisoVisao(
          `Não reconheci a prancha com segurança (${resp.confiancaDeclarada}). ` +
            (resp.impedimentos.join(" ") || resp.justificativa) +
            " Selecione a lâmina na lista.",
        );
        return;
      }
      if (resp.laminaId === lamina.id) {
        setAvisoVisao(
          `Confere: a prancha na mesa parece ser "${lamina.nome}" (confiança ${resp.confiancaDeclarada}). Confirme você mesmo antes de pendular.`,
        );
        return;
      }
      onTrocarLamina?.(resp.laminaId);
      setAvisoVisao(
        `Sugestão: a prancha na mesa parece ser outra (confiança ${resp.confiancaDeclarada}). ${resp.justificativa} Confirme antes de seguir.`,
      );
    } catch {
      setAvisoVisao("Não foi possível falar com o serviço de identificação.");
    } finally {
      setIdentificando(false);
    }
  }

  const abstem = !previa || previa.motivos.length > 0 || !previa.zona;

  return (
    <div className="space-y-3">
      {/* ---- Visor ---- */}
      <div className="relative overflow-hidden rounded-xl border border-[var(--color-borda)] bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="block h-auto w-full"
          style={{ aspectRatio: "4 / 3" }}
        />
        {/* Overlay da lâmina na área calibrada */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${calibracao.x * 100}%`,
            top: `${calibracao.y * 100}%`,
            width: `${calibracao.largura * 100}%`,
            height: `${calibracao.altura * 100}%`,
            transform: `rotate(${-calibracao.rotacaoGraus}deg)`,
            opacity: ligada ? 0.52 : 0.8,
            outline: calibrando ? "2px dashed #c2a36a" : "1px solid #ffffff22",
          }}
        >
          <LaminaSvg
            lamina={lamina}
            selecionada={previa?.zona?.id}
            candidatas={previa?.candidatas?.map((z) => z.id)}
            eixoGraus={metricas?.eixoGraus ?? null}
            className="h-full w-full"
          />
        </div>

        {!ligada && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-6 text-center text-sm text-[var(--color-texto-2)]">
            {podeUsarCamera
              ? "A câmera acompanha o movimento do pêndulo sobre a lâmina. Nada é enviado para fora do aparelho."
              : "A autorização de captura por câmera não foi registrada para esta pessoa. Use o registro manual."}
          </div>
        )}
      </div>

      {erro && (
        <p className="rounded-lg border border-[var(--color-alerta)]/40 bg-[var(--color-alerta)]/10 p-3 text-sm">
          {erro}
        </p>
      )}

      {/* ---- Controles ---- */}
      <div className="flex flex-wrap gap-2">
        {!ligada ? (
          <button
            className="btn btn-principal flex-1"
            onClick={ligar}
            disabled={!podeUsarCamera}
          >
            Abrir câmera
          </button>
        ) : (
          <>
            <button className="btn flex-1" onClick={desligar}>
              Fechar câmera
            </button>
            <button
              className="btn"
              onClick={() => setCalibrando((v) => !v)}
            >
              {calibrando ? "Pronto" : "Calibrar"}
            </button>
            <button
              className="btn"
              onClick={identificarLamina}
              disabled={identificando || !podeEnviarAIa}
              title={
                podeEnviarAIa
                  ? "Envia uma foto para identificar a prancha"
                  : "Sem autorização de envio a fornecedor de IA"
              }
            >
              {identificando ? "Identificando…" : "Identificar lâmina"}
            </button>
          </>
        )}
      </div>

      {avisoVisao && (
        <p className="rounded-lg border border-[var(--color-cuidado)]/40 bg-[var(--color-cuidado)]/10 p-3 text-sm">
          {avisoVisao}
        </p>
      )}

      {/* ---- Calibração ---- */}
      {calibrando && (
        <div className="cartao space-y-3">
          <p className="text-sm text-[var(--color-texto-2)]">
            Encaixe o desenho sobre a prancha de verdade na mesa. Sem essa
            referência geométrica, o app se abstém de ler.
          </p>
          {(
            [
              ["x", "Esquerda", 0, 0.9, 0.01],
              ["y", "Topo", 0, 0.9, 0.01],
              ["largura", "Largura", 0.1, 1, 0.01],
              ["altura", "Altura", 0.1, 1, 0.01],
              ["rotacaoGraus", "Rotação", -180, 180, 1],
            ] as const
          ).map(([campo, rotulo, min, max, passo]) => (
            <label key={campo} className="block">
              <span className="rotulo">
                {rotulo}: {calibracao[campo]}
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={passo}
                value={calibracao[campo]}
                onChange={(e) =>
                  salvarCalibracao({
                    ...calibracao,
                    [campo]: Number(e.target.value),
                  })
                }
                className="w-full accent-[var(--color-acento)]"
              />
            </label>
          ))}
          <button
            className="btn btn-pequeno"
            onClick={() => salvarCalibracao(CALIBRACAO_PADRAO)}
          >
            Voltar ao padrão
          </button>
        </div>
      )}

      {/* ---- Métricas ao vivo ---- */}
      {ligada && metricas && (
        <div className="cartao space-y-2">
          <p className="rotulo">Movimento medido agora</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Linha
              rotulo="Movimento"
              valor={previa ? TEXTO_MOVIMENTO[previa.movimento] : "—"}
            />
            <Linha
              rotulo="Eixo"
              valor={
                metricas.eixoGraus === null
                  ? "—"
                  : `${metricas.eixoGraus.toFixed(0)}°`
              }
            />
            <Linha
              rotulo="Linearidade"
              valor={metricas.linearidade.toFixed(2)}
            />
            <Linha
              rotulo="Instabilidade"
              valor={`${metricas.instabilidadeGraus.toFixed(0)}°`}
            />
            <Linha rotulo="Energia" valor={metricas.energia.toFixed(3)} />
            <Linha rotulo="Nitidez" valor={metricas.nitidez.toFixed(2)} />
            <Linha rotulo="Quadros" valor={String(metricas.quadros)} />
            <Linha
              rotulo="Giro"
              valor={metricas.somaRotacional.toFixed(3)}
            />
          </div>
          <p className="text-xs text-[var(--color-texto-2)]">
            Estes números descrevem a qualidade da captura, não a confiança na
            interpretação.
          </p>
        </div>
      )}

      {/* ---- Prévia da leitura ---- */}
      {ligada && previa && (
        <div className="cartao space-y-3">
          {previa.zona ? (
            <p className="text-sm">
              Zona apontada:{" "}
              <strong className="text-[var(--color-acento-forte)]">
                {previa.zona.rotulo}
              </strong>
              {previa.valor && (
                <>
                  {" "}
                  — valor {previa.valor.numero} {previa.valor.unidade}
                </>
              )}
            </p>
          ) : previa.candidatas?.length ? (
            <p className="text-sm">
              O eixo aponta para dois setores opostos:{" "}
              <strong>
                {previa.candidatas.map((z) => z.rotulo).join(" e ")}
              </strong>
              . A geometria não resolve isso: escolha você, pela convenção da
              sessão.
            </p>
          ) : (
            <p className="text-sm text-[var(--color-texto-2)]">
              Sem zona definida.
            </p>
          )}

          {previa.motivos.length > 0 && (
            <ul className="space-y-1 text-sm text-[var(--color-cuidado)]">
              {previa.motivos.map((m) => (
                <li key={m}>• {TEXTO_ABSTENCAO[m]}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-principal flex-1"
              disabled={abstem}
              onClick={() => previa && onRegistrar(previa, "camera")}
            >
              Confirmar esta leitura
            </button>
            <button
              className="btn"
              onClick={() =>
                previa &&
                onRegistrar(
                  { ...previa, zona: undefined, candidatas: undefined },
                  "camera",
                )
              }
            >
              Registrar como inconclusivo
            </button>
          </div>
          {abstem && (
            <p className="text-xs text-[var(--color-texto-2)]">
              A confirmação está bloqueada enquanto houver motivo de abstenção.
              Ajuste o enquadramento, espere o movimento estabilizar, ou use o
              registro manual abaixo.
            </p>
          )}
        </div>
      )}

      {/* ---- Registro manual: sempre disponível ---- */}
      <div className="cartao space-y-3">
        <p className="rotulo">Registro manual</p>
        <p className="text-sm text-[var(--color-texto-2)]">
          Toque na zona que você observou. Este é o caminho principal: a câmera
          é um apoio.
        </p>
        <LaminaSvg
          lamina={lamina}
          selecionada={zonaManual?.id}
          onSelecionar={setZonaManual}
        />
        {zonaManual && (
          <div className="space-y-2">
            <p className="text-sm">
              Selecionado:{" "}
              <strong className="text-[var(--color-acento-forte)]">
                {zonaManual.rotulo}
              </strong>
            </p>
            <p className="text-xs text-[var(--color-texto-2)]">
              {zonaManual.significadoSimbolico} — {zonaManual.usoPermitido}.
            </p>
            <button
              className="btn btn-principal w-full"
              onClick={() => {
                onRegistrar(
                  {
                    movimento: "indefinido",
                    zona: zonaManual,
                    motivos: [],
                    metricas: {
                      eixoGraus: null,
                      linearidade: 0,
                      instabilidadeGraus: 0,
                      somaRotacional: 0,
                      energia: 0,
                      quadros: 0,
                      nitidez: 0,
                    },
                  },
                  "manual",
                );
                setZonaManual(null);
              }}
            >
              Confirmar registro manual
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-[var(--color-borda)]/60 py-1">
      <span className="text-[var(--color-texto-2)]">{rotulo}</span>
      <span className="font-mono">{valor}</span>
    </div>
  );
}
