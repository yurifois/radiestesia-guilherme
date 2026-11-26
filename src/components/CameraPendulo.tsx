"use client";

/**
 * Camera aberta sobre a lamina, em tela cheia, com overlay calibravel e
 * tracker local.
 *
 * Quando a camera abre, ela toma a tela: o visor vai para uma camada fixa
 * sobre tudo, pede tela cheia ao navegador e segura o aparelho acordado. Quem
 * abre e quem fecha e o terapeuta - ha botao de fechar sempre visivel, a tecla
 * Esc fecha, e sair da tela cheia pelo gesto do sistema nao perde a sessao.
 *
 * O processamento todo acontece aqui, no aparelho. Nenhum quadro de video sai
 * do celular de forma continua. O que pode sair, e so com a autorizacao de
 * envio a fornecedor de IA registrada, e UMA foto por vez, quando o vigia de
 * cena percebe que a prancha sobre a mesa mudou.
 *
 * A camera e um auxilio, nao a autoridade: toda leitura passa por confirmacao
 * do terapeuta, e a selecao manual sobre o desenho esta sempre disponivel
 * (dossie, p. 35: "Solicitar revisao e confirmacao do terapeuta"). O mesmo
 * vale para a lamina: a troca automatica e anunciada e pode ser desfeita.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import LaminaSvg from "./LaminaSvg";
import {
  CALIBRACAO_PADRAO,
  CENA,
  type Calibracao,
  type EstadoCena,
  type Leitura,
  mapearParaZona,
  TEXTO_ABSTENCAO,
  TEXTO_MOVIMENTO,
  TrackerPendulo,
  VigiaDeCena,
} from "@/lib/pendulo";
import type { Lamina, MetricasCaptura, ZonaLamina } from "@/lib/tipos";
import { acharLamina, CATALOGO, DESCRICAO_VISUAL } from "@/data/laminas";

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
  /** Pergunta desta leitura. Sem ela nenhum evento pode ser registrado. */
  pergunta: string;
  onPergunta: (texto: string) => void;
  /** Quantas leituras já foram registradas nesta sessão. */
  totalLeituras: number;
}

const CHAVE_CALIBRACAO = "radiestesia:calibracao";
const CHAVE_AUTO = "radiestesia:identificar-sozinho";

/** Uma linha do histórico de identificações desta sessão de câmera. */
interface MarcoLamina {
  em: number;
  texto: string;
  automatico: boolean;
}

/** Painel aberto na gaveta de baixo. Um de cada vez, para sobrar visor. */
type Gaveta = "nenhuma" | "calibracao" | "dados" | "prancha";

interface Tamanho {
  largura: number;
  altura: number;
}

export default function CameraPendulo({
  lamina,
  temConvencao,
  sentidoDeLeitura,
  podeUsarCamera,
  podeEnviarAIa,
  onRegistrar,
  onTrocarLamina,
  pergunta,
  onPergunta,
  totalLeituras,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const palcoRef = useRef<HTMLDivElement>(null);
  // Quem abriu a camera recebe o foco de volta quando ela fecha.
  const abridorRef = useRef<HTMLButtonElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const estavaLigada = useRef(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const trackerRef = useRef<TrackerPendulo | null>(null);
  const vigiaRef = useRef<VigiaDeCena | null>(null);
  const loopRef = useRef<number | null>(null);
  const fluxoRef = useRef<MediaStream | null>(null);
  const travaRef = useRef<WakeLockSentinel | null>(null);

  const [ligada, setLigada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [gaveta, setGaveta] = useState<Gaveta>("nenhuma");
  const [calibracao, setCalibracao] = useState<Calibracao>(CALIBRACAO_PADRAO);
  const [metricas, setMetricas] = useState<MetricasCaptura | null>(null);
  const [previa, setPrevia] = useState<Leitura | null>(null);
  const [identificando, setIdentificando] = useState(false);
  const [avisoVisao, setAvisoVisao] = useState<string | null>(null);
  const [zonaManual, setZonaManual] = useState<ZonaLamina | null>(null);
  const [autoIdentificar, setAutoIdentificar] = useState(true);
  const [cena, setCena] = useState<EstadoCena | null>(null);
  const [marcos, setMarcos] = useState<MarcoLamina[]>([]);
  /** Proporção real do quadro da câmera, medida quando o vídeo carrega. */
  const [proporcao, setProporcao] = useState(4 / 3);
  /** Tamanho do visor em pixels, calculado para caber inteiro na tela. */
  const [visor, setVisor] = useState<Tamanho | null>(null);
  /** Recado curto que some sozinho: "leitura registrada". */
  const [recado, setRecado] = useState<string | null>(null);

  const calibrando = gaveta === "calibracao";
  const semPergunta = !pergunta.trim();

  // O laço de animação lê props e estado por referência: assim uma troca de
  // lâmina no meio da sessão vale já no próximo quadro, sem reabrir a câmera.
  const laminaRef = useRef(lamina);
  const calibracaoRef = useRef(calibracao);
  const convencaoRef = useRef(temConvencao);
  const sentidoRef = useRef(sentidoDeLeitura);
  const podeIaRef = useRef(podeEnviarAIa);
  const autoRef = useRef(autoIdentificar);
  const identificandoRef = useRef(false);
  const ultimaIdentRef = useRef(0);
  const abriuEmRef = useRef(0);
  const mudouDesdeRef = useRef<number | null>(null);
  const identificarRef = useRef<(auto: boolean) => void>(() => {});

  laminaRef.current = lamina;
  calibracaoRef.current = calibracao;
  convencaoRef.current = temConvencao;
  sentidoRef.current = sentidoDeLeitura;
  podeIaRef.current = podeEnviarAIa;
  autoRef.current = autoIdentificar;

  // Calibracao e preferencia do terapeuta, nao dado de pessoa atendida.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_CALIBRACAO);
      if (salvo) setCalibracao({ ...CALIBRACAO_PADRAO, ...JSON.parse(salvo) });
      const auto = localStorage.getItem(CHAVE_AUTO);
      if (auto !== null) setAutoIdentificar(auto === "1");
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

  const trocarAuto = useCallback((v: boolean) => {
    setAutoIdentificar(v);
    try {
      localStorage.setItem(CHAVE_AUTO, v ? "1" : "0");
    } catch {
      /* sem persistência: vale para esta sessão */
    }
  }, []);

  // -------------------------------------------------------------------------
  // Ligar e desligar
  // -------------------------------------------------------------------------
  const desligar = useCallback(() => {
    if (loopRef.current !== null) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    fluxoRef.current?.getTracks().forEach((t) => t.stop());
    fluxoRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    trackerRef.current?.limpar();
    vigiaRef.current?.limpar();
    travaRef.current?.release().catch(() => {});
    travaRef.current = null;
    if (typeof document !== "undefined" && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    ultimaIdentRef.current = 0;
    mudouDesdeRef.current = null;
    setLigada(false);
    setMetricas(null);
    setPrevia(null);
    setCena(null);
    setVisor(null);
    setGaveta("nenhuma");
    setZonaManual(null);
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
      trackerRef.current = new TrackerPendulo();
      vigiaRef.current = new VigiaDeCena();
      abriuEmRef.current = performance.now();
      mudouDesdeRef.current = null;
      setMarcos([]);
      setLigada(true);

      const passo = (t: number) => {
        const v = videoRef.current;
        const tr = trackerRef.current;
        const vg = vigiaRef.current;
        if (v && tr) {
          tr.processarQuadro(v, t);
          const m = tr.metricas();
          setMetricas(m);
          if (m) {
            setPrevia(
              mapearParaZona(
                laminaRef.current,
                m,
                tr.centroide(),
                calibracaoRef.current,
                convencaoRef.current,
                sentidoRef.current,
              ),
            );
          }
        }
        if (v && vg) {
          const estado = vg.processar(v, t);
          if (estado) {
            setCena(estado);
            if (estado.mudou) {
              if (mudouDesdeRef.current === null) mudouDesdeRef.current = t;
            } else {
              mudouDesdeRef.current = null;
            }
            // Na mao, a imagem pode nunca ficar de todo parada. Entao: ou a
            // cena descansou, ou ja faz tempo demais esperando por isso.
            const descansou = estado.paradaHaMs >= CENA.msParaEstabilizar;
            const cansouDeEsperar =
              (estado.semReferencia &&
                t - abriuEmRef.current >= CENA.msSemEsperarParada) ||
              (mudouDesdeRef.current !== null &&
                t - mudouDesdeRef.current >= CENA.msSemEsperarParada);
            const esperou =
              t - ultimaIdentRef.current >= CENA.msEntreIdentificacoes ||
              ultimaIdentRef.current === 0;
            const vale = estado.semReferencia || estado.mudou;
            if (
              autoRef.current &&
              podeIaRef.current &&
              !identificandoRef.current &&
              (descansou || cansouDeEsperar) &&
              esperou &&
              vale
            ) {
              mudouDesdeRef.current = null;
              ultimaIdentRef.current = t;
              identificarRef.current(true);
            }
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
  }, []);

  // O <video> só existe no DOM depois que a camada em tela cheia monta, então
  // a ligação do fluxo acontece aqui, e não dentro de ligar().
  useEffect(() => {
    if (!ligada) return;
    const v = videoRef.current;
    const fluxo = fluxoRef.current;
    if (!v || !fluxo) return;
    v.srcObject = fluxo;
    v.play().catch(() => {
      setErro("O navegador bloqueou a reprodução do vídeo. Toque na tela.");
    });
    // A camada e um dialogo: o foco entra nela, no botao de sair.
    fecharRef.current?.focus();
  }, [ligada]);

  /*
   * Enquanto a camada esta aberta ela e a tela inteira, entao o Tab nao pode
   * sair dela para controles que ninguem ve. Em vez de marcar o resto da
   * pagina como inerte, o ciclo e fechado aqui mesmo.
   */
  function prenderFoco(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const palco = palcoRef.current;
    if (!palco) return;
    const alvos = Array.from(
      palco.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    if (alvos.length === 0) return;
    const primeiro = alvos[0];
    const ultimo = alvos[alvos.length - 1];
    const atual = document.activeElement;
    if (e.shiftKey && (atual === primeiro || !palco.contains(atual))) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && atual === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  // Ao fechar, o foco volta ao botao que abriu, e nao ao topo da pagina.
  useEffect(() => {
    if (ligada) {
      estavaLigada.current = true;
      return;
    }
    if (estavaLigada.current) {
      estavaLigada.current = false;
      abridorRef.current?.focus();
    }
  }, [ligada]);

  // Tela cheia de verdade, aparelho acordado, página travada por baixo.
  useEffect(() => {
    if (!ligada) return;
    palcoRef.current?.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {
      /* sem tela cheia nativa: a camada fixa já cobre a tela */
    });
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let vivo = true;
    const segurar = async () => {
      try {
        const trava = await navigator.wakeLock?.request("screen");
        if (!vivo) {
          trava?.release().catch(() => {});
          return;
        }
        travaRef.current = trava ?? null;
      } catch {
        /* sem wake lock: o aparelho pode apagar a tela sozinho */
      }
    };
    segurar();
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && !travaRef.current) segurar();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", aoVoltar);
      document.body.style.overflow = anterior;
    };
  }, [ligada]);

  useEffect(() => {
    if (!recado) return;
    const id = setTimeout(() => setRecado(null), 3000);
    return () => clearTimeout(id);
  }, [recado]);

  // Esc fecha a câmera, mesmo quando o navegador já saiu da tela cheia.
  useEffect(() => {
    if (!ligada) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") desligar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [ligada, desligar]);

  // O visor ocupa o maior retângulo com a proporção do quadro que cabe na
  // tela. Assim a câmera enche a tela sem cortar imagem: cortar deslocaria a
  // geometria entre o que o terapeuta calibra e o que o tracker mede.
  useEffect(() => {
    if (!ligada) return;
    const medir = () => {
      const area = areaRef.current;
      if (!area) return;
      const { width, height } = area.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const largura = Math.min(width, height * proporcao);
      setVisor({ largura, altura: largura / proporcao });
    };
    medir();
    const obs = new ResizeObserver(medir);
    if (areaRef.current) obs.observe(areaRef.current);
    window.addEventListener("orientationchange", medir);
    return () => {
      obs.disconnect();
      window.removeEventListener("orientationchange", medir);
    };
  }, [ligada, proporcao, gaveta]);

  // -------------------------------------------------------------------------
  // Identificação da prancha
  // -------------------------------------------------------------------------
  const registrarMarco = useCallback((texto: string, automatico: boolean) => {
    setMarcos((m) => [{ em: Date.now(), texto, automatico }, ...m].slice(0, 8));
  }, []);

  const identificarLamina = useCallback(
    async (automatico: boolean) => {
      const v = videoRef.current;
      if (!v || !podeIaRef.current || identificandoRef.current) return;
      identificandoRef.current = true;
      setIdentificando(true);
      if (!automatico) setAvisoVisao(null);
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

        // A cena vista agora passa a ser a cena de referência, reconhecida ou
        // não: sem isso o vigia dispararia a mesma foto a cada oito segundos.
        vigiaRef.current?.marcarIdentificada();

        if (!resp.laminaId) {
          setAvisoVisao(
            `Não reconheci a prancha com segurança (${resp.confiancaDeclarada}). ` +
              (resp.impedimentos.join(" ") || resp.justificativa) +
              " Escolha a lâmina na lista.",
          );
          registrarMarco("prancha não reconhecida", automatico);
          return;
        }
        const atual = laminaRef.current;
        if (resp.laminaId === atual.id) {
          setAvisoVisao(
            `Confere: a prancha na mesa é "${atual.nome}" (confiança ${resp.confiancaDeclarada}).`,
          );
          if (!automatico) registrarMarco(`confirmou ${atual.nome}`, false);
          return;
        }
        const nova = acharLamina(resp.laminaId);
        onTrocarLamina?.(resp.laminaId);
        setZonaManual(null);
        setAvisoVisao(
          `A prancha na mesa mudou: agora é "${nova?.nome ?? resp.laminaId}" ` +
            `(confiança ${resp.confiancaDeclarada}). ${resp.justificativa} ` +
            "As leituras já registradas continuam com a lâmina delas.",
        );
        registrarMarco(`trocou para ${nova?.nome ?? resp.laminaId}`, automatico);
      } catch {
        setAvisoVisao("Não foi possível falar com o serviço de identificação.");
      } finally {
        identificandoRef.current = false;
        setIdentificando(false);
      }
    },
    [onTrocarLamina, registrarMarco],
  );

  identificarRef.current = identificarLamina;

  const abstem = !previa || previa.motivos.length > 0 || !previa.zona;

  const registrarManual = useCallback(
    (z: ZonaLamina) => {
      onRegistrar(
        {
          movimento: "indefinido",
          zona: z,
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
      setRecado(`Registrado: ${z.rotulo}.`);
    },
    [onRegistrar],
  );

  const registrarDaCamera = useCallback(
    (l: Leitura, inconclusivo: boolean) => {
      onRegistrar(
        inconclusivo ? { ...l, zona: undefined, candidatas: undefined } : l,
        "camera",
      );
      setRecado(
        inconclusivo
          ? "Registrado como inconclusivo."
          : `Registrado: ${l.zona?.rotulo ?? "leitura"}.`,
      );
    },
    [onRegistrar],
  );

  const sobreposicao = (
    <div
      className="absolute"
      style={{
        left: `${calibracao.x * 100}%`,
        top: `${calibracao.y * 100}%`,
        width: `${calibracao.largura * 100}%`,
        height: `${calibracao.altura * 100}%`,
        transform: `rotate(${-calibracao.rotacaoGraus}deg)`,
        opacity: 0.58,
        outline: calibrando ? "2px dashed #bfa67c" : "1px solid #ffffff22",
      }}
    >
      <LaminaSvg
        lamina={lamina}
        selecionada={previa?.zona?.id ?? zonaManual?.id}
        candidatas={previa?.candidatas?.map((z) => z.id)}
        eixoGraus={metricas?.eixoGraus ?? null}
        onSelecionar={calibrando ? undefined : setZonaManual}
        className="h-full w-full"
      />
    </div>
  );

  // =========================================================================
  // Câmera aberta: camada em tela cheia
  // =========================================================================
  if (ligada) {
    return (
      <div
        ref={palcoRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Câmera do pêndulo sobre ${lamina.nome}`}
        onKeyDown={prenderFoco}
        className="fixed inset-0 z-50 flex flex-col bg-black text-[var(--color-texto)]"
      >
        {/* ---- Barra de cima ---- */}
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--color-acento-forte)]">
              {lamina.nome}
            </p>
            <p className="truncate text-xs text-[var(--color-texto-2)]">
              {identificando
                ? "olhando a prancha…"
                : temConvencao
                  ? `${totalLeituras} leitura${totalLeituras === 1 ? "" : "s"} nesta sessão`
                  : "sem convenção: o app não interpreta"}
            </p>
          </div>
          <button
            ref={fecharRef}
            className="btn btn-pequeno shrink-0"
            onClick={desligar}
            aria-label="Fechar câmera"
          >
            ✕ Fechar
          </button>
        </div>

        {/* ---- Visor ---- */}
        <div
          ref={areaRef}
          className="relative flex min-h-0 flex-1 items-center justify-center"
        >
          <div
            className="relative"
            style={{
              width: visor ? `${visor.largura}px` : "100%",
              height: visor ? `${visor.altura}px` : "100%",
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 h-full w-full"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.videoWidth && v.videoHeight) {
                  setProporcao(v.videoWidth / v.videoHeight);
                }
              }}
            />
            {sobreposicao}
          </div>
        </div>

        {/* ---- Gaveta ---- */}
        {gaveta !== "nenhuma" && (
          <div className="max-h-[42vh] overflow-y-auto border-t border-[var(--color-borda)] bg-[var(--color-fundo)] px-3 py-3">
            {gaveta === "calibracao" && (
              <Calibracao2
                calibracao={calibracao}
                onMudar={salvarCalibracao}
              />
            )}
            {gaveta === "dados" && <Dados metricas={metricas} previa={previa} />}
            {gaveta === "prancha" && (
              <Prancha
                lamina={lamina}
                podeEnviarAIa={podeEnviarAIa}
                autoIdentificar={autoIdentificar}
                onTrocarAuto={trocarAuto}
                cena={cena}
                identificando={identificando}
                marcos={marcos}
                aviso={avisoVisao}
                onDispensarAviso={() => setAvisoVisao(null)}
              />
            )}
          </div>
        )}

        {/* ---- Barra de baixo ---- */}
        <div className="space-y-2 border-t border-[var(--color-borda)] bg-[var(--color-fundo)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          {avisoVisao && (
            <button
              className="block w-full rounded-lg border border-[var(--color-cuidado)]/40 bg-[var(--color-cuidado)]/10 p-2 text-left text-xs leading-relaxed"
              onClick={() => setGaveta("prancha")}
              title="Ver o recado inteiro"
            >
              <span className="line-clamp-2">{avisoVisao}</span>
            </button>
          )}

          {/* Troca de prancha e confirmacao sao anunciadas, nao so pintadas. */}
          <div aria-live="polite">
            {recado && (
              <p className="rounded-lg border border-[var(--color-ok)]/40 bg-[var(--color-ok)]/10 p-2 text-xs">
                {recado}
              </p>
            )}
          </div>

          <input
            className="campo text-sm"
            aria-label="Pergunta desta leitura"
            placeholder="Pergunta desta leitura, com tema e período"
            value={pergunta}
            onChange={(e) => onPergunta(e.target.value)}
          />

          <p className="text-sm">
            {zonaManual ? (
              <>
                Você tocou em{" "}
                <strong className="text-[var(--color-acento-forte)]">
                  {zonaManual.rotulo}
                </strong>
                .
              </>
            ) : previa?.zona ? (
              <>
                Zona apontada:{" "}
                <strong className="text-[var(--color-acento-forte)]">
                  {previa.zona.rotulo}
                </strong>
                {previa.valor && (
                  <>
                    {" "}
                    — {previa.valor.numero} {previa.valor.unidade}
                  </>
                )}
              </>
            ) : previa?.candidatas?.length ? (
              <>
                Dois setores opostos:{" "}
                <strong>
                  {previa.candidatas.map((z) => z.rotulo).join(" e ")}
                </strong>
                . A geometria não resolve: escolha pela convenção.
              </>
            ) : (
              <span className="text-[var(--color-texto-2)]">
                {previa
                  ? TEXTO_MOVIMENTO[previa.movimento]
                  : "Lendo o movimento…"}
              </span>
            )}
          </p>

          {!zonaManual && previa && previa.motivos.length > 0 && (
            <p className="text-xs text-[var(--color-cuidado)]">
              {TEXTO_ABSTENCAO[previa.motivos[0]]}
              {previa.motivos.length > 1 &&
                ` (+${previa.motivos.length - 1} motivo${
                  previa.motivos.length > 2 ? "s" : ""
                })`}
            </p>
          )}

          <div className="flex gap-2">
            {zonaManual ? (
              <>
                <button
                  className="btn btn-principal flex-1"
                  disabled={semPergunta}
                  onClick={() => registrarManual(zonaManual)}
                >
                  Registrar {zonaManual.rotulo}
                </button>
                <button className="btn" onClick={() => setZonaManual(null)}>
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-principal flex-1"
                  disabled={abstem || semPergunta}
                  onClick={() => previa && registrarDaCamera(previa, false)}
                >
                  Confirmar leitura
                </button>
                <button
                  className="btn"
                  disabled={!previa || semPergunta}
                  onClick={() => previa && registrarDaCamera(previa, true)}
                >
                  Inconclusivo
                </button>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <BotaoGaveta
              atual={gaveta}
              valor="prancha"
              onMudar={setGaveta}
              rotulo="Prancha"
            />
            <BotaoGaveta
              atual={gaveta}
              valor="calibracao"
              onMudar={setGaveta}
              rotulo="Calibrar"
            />
            <BotaoGaveta
              atual={gaveta}
              valor="dados"
              onMudar={setGaveta}
              rotulo="Dados"
            />
            <button
              className="btn btn-pequeno"
              onClick={() => identificarLamina(false)}
              disabled={identificando || !podeEnviarAIa}
            >
              {identificando ? "Olhando…" : "Olhar agora"}
            </button>
          </div>

          <p className="text-[11px] text-[var(--color-texto-2)]">
            {semPergunta
              ? "Escreva a pergunta acima: sem ela nada é registrado."
              : "Toque no desenho para registrar a zona você mesmo."}
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Câmera fechada
  // =========================================================================
  return (
    <div className="space-y-3">
      <div className="cartao space-y-3">
        <p className="text-sm leading-relaxed text-[var(--color-texto-2)]">
          {podeUsarCamera
            ? "A câmera abre em tela cheia, reconhece sozinha qual prancha está na mesa e acompanha o pêndulo. Você fecha quando quiser, no botão ou no Esc. Sem câmera, o registro manual logo abaixo faz o mesmo trabalho."
            : "A autorização de captura por câmera não foi registrada para esta pessoa. Use o registro manual abaixo."}
        </p>
        <button
          ref={abridorRef}
          className="btn btn-principal w-full"
          onClick={ligar}
          disabled={!podeUsarCamera}
        >
          Abrir câmera em tela cheia
        </button>
        {erro && (
          <p className="rounded-lg border border-[var(--color-alerta)]/40 bg-[var(--color-alerta)]/10 p-3 text-sm">
            {erro}
          </p>
        )}
        {avisoVisao && (
          <p className="rounded-lg border border-[var(--color-cuidado)]/40 bg-[var(--color-cuidado)]/10 p-3 text-sm">
            {avisoVisao}
          </p>
        )}
        {marcos.length > 0 && (
          <ul className="space-y-1 text-xs text-[var(--color-texto-2)]">
            {marcos.map((m) => (
              <li key={m.em}>
                {new Date(m.em).toLocaleTimeString("pt-BR")} —{" "}
                {m.automatico ? "sozinho" : "a pedido"}: {m.texto}
              </li>
            ))}
          </ul>
        )}
      </div>

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
              onClick={() => registrarManual(zonaManual)}
            >
              Confirmar registro manual
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
function BotaoGaveta({
  atual,
  valor,
  onMudar,
  rotulo,
}: {
  atual: Gaveta;
  valor: Gaveta;
  onMudar: (g: Gaveta) => void;
  rotulo: string;
}) {
  const aberta = atual === valor;
  return (
    <button
      className={`btn btn-pequeno${aberta ? " btn-principal" : ""}`}
      onClick={() => onMudar(aberta ? "nenhuma" : valor)}
    >
      {rotulo}
    </button>
  );
}

function Calibracao2({
  calibracao,
  onMudar,
}: {
  calibracao: Calibracao;
  onMudar: (c: Calibracao) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--color-texto-2)]">
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
              onMudar({ ...calibracao, [campo]: Number(e.target.value) })
            }
            className="w-full accent-[var(--color-acento)]"
          />
        </label>
      ))}
      <button
        className="btn btn-pequeno"
        onClick={() => onMudar(CALIBRACAO_PADRAO)}
      >
        Voltar ao padrão
      </button>
    </div>
  );
}

function Dados({
  metricas,
  previa,
}: {
  metricas: MetricasCaptura | null;
  previa: Leitura | null;
}) {
  if (!metricas) {
    return (
      <p className="text-sm text-[var(--color-texto-2)]">
        Ainda sem quadros suficientes para medir.
      </p>
    );
  }
  return (
    <div className="space-y-2">
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
        <Linha rotulo="Linearidade" valor={metricas.linearidade.toFixed(2)} />
        <Linha
          rotulo="Instabilidade"
          valor={`${metricas.instabilidadeGraus.toFixed(0)}°`}
        />
        <Linha rotulo="Energia" valor={metricas.energia.toFixed(3)} />
        <Linha rotulo="Nitidez" valor={metricas.nitidez.toFixed(2)} />
        <Linha rotulo="Quadros" valor={String(metricas.quadros)} />
        <Linha rotulo="Giro" valor={metricas.somaRotacional.toFixed(3)} />
      </div>
      {previa && previa.motivos.length > 0 && (
        <ul className="space-y-1 text-xs text-[var(--color-cuidado)]">
          {previa.motivos.map((m) => (
            <li key={m}>• {TEXTO_ABSTENCAO[m]}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-[var(--color-texto-2)]">
        Estes números descrevem a qualidade da captura, não a confiança na
        interpretação.
      </p>
    </div>
  );
}

function Prancha({
  lamina,
  podeEnviarAIa,
  autoIdentificar,
  onTrocarAuto,
  cena,
  identificando,
  marcos,
  aviso,
  onDispensarAviso,
}: {
  lamina: Lamina;
  podeEnviarAIa: boolean;
  autoIdentificar: boolean;
  onTrocarAuto: (v: boolean) => void;
  cena: EstadoCena | null;
  identificando: boolean;
  marcos: MarcoLamina[];
  aviso?: string | null;
  onDispensarAviso?: () => void;
}) {
  return (
    <div className="space-y-2">
      {aviso && (
        <div className="space-y-2 rounded-lg border border-[var(--color-cuidado)]/40 bg-[var(--color-cuidado)]/10 p-2">
          <p className="text-xs leading-relaxed">{aviso}</p>
          <button className="btn btn-pequeno" onClick={onDispensarAviso}>
            Entendi
          </button>
        </div>
      )}
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="rotulo block">Reconhecer a prancha sozinho</span>
          <span className="text-xs text-[var(--color-texto-2)]">
            {podeEnviarAIa
              ? "Uma foto é enviada quando a imagem muda e volta a ficar parada."
              : "Precisa da autorização de envio a fornecedor de IA."}
          </span>
        </span>
        <input
          type="checkbox"
          className="h-5 w-5 accent-[var(--color-acento)]"
          checked={autoIdentificar && podeEnviarAIa}
          disabled={!podeEnviarAIa}
          onChange={(e) => onTrocarAuto(e.target.checked)}
        />
      </label>

      {autoIdentificar && podeEnviarAIa && cena && (
        <p className="text-xs text-[var(--color-texto-2)]">
          {identificando
            ? "Comparando a prancha da mesa com o catálogo…"
            : cena.semReferencia
              ? "Aguardando a imagem ficar parada para olhar a prancha."
              : cena.mudou
                ? "A imagem mudou. Segure parado um instante que eu olho de novo."
                : `Acompanhando "${lamina.nome}". Mudança desde a última olhada: ${cena.distancia.toFixed(2)}.`}
        </p>
      )}

      {marcos.length > 0 && (
        <ul className="space-y-1 text-xs text-[var(--color-texto-2)]">
          {marcos.map((m) => (
            <li key={m.em}>
              {new Date(m.em).toLocaleTimeString("pt-BR")} —{" "}
              {m.automatico ? "sozinho" : "a pedido"}: {m.texto}
            </li>
          ))}
        </ul>
      )}
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
