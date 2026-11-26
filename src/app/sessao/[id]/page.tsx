"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CameraPendulo from "@/components/CameraPendulo";
import { acharLamina, CATALOGO, LAMINAS_LEITURA } from "@/data/laminas";
import { acharFormulario, rotuloDoTema } from "@/data/formularios";
import {
  agora,
  apagarEvento,
  lerPessoa,
  lerSessao,
  listarAnamnesesDaPessoa,
  listarEventosDaSessao,
  listarSintesesDaSessao,
  novoId,
  salvarEvento,
  salvarSessao,
  salvarSintese,
} from "@/lib/db";
import {
  descreverEvento,
  extrairTrechos,
  rankearLaminas,
  sintetizar,
  TEXTO_BANDEIRA,
  validarIntegridade,
} from "@/lib/motor";
import { baixarPdf } from "@/lib/pdf";
import { TEXTO_ABSTENCAO, type Leitura } from "@/lib/pendulo";
import type { DecisaoJev, Redacao } from "@/lib/schemas";
import type {
  AnamneseRespondida,
  Convencao,
  EventoLeitura,
  Lamina,
  MovimentoPendulo,
  Pessoa,
  Sessao,
  Sintese,
} from "@/lib/tipos";

/*
 * Quatro fases, nao sete passos. Os sete titulos antigos misturavam preparo,
 * trabalho e entrega numa rolagem unica: o terapeuta tinha de rolar para
 * reencontrar o controle que acabara de usar. Agora cada fase e uma tela, e a
 * proxima acao fica no rodape, ao alcance do polegar.
 */
const FASES = [
  { n: 1, nome: "Preparar", resumo: "convencao e lamina" },
  { n: 2, nome: "Ler", resumo: "pergunta, pendulo e registros" },
  { n: 3, nome: "Cruzar", resumo: "regras, Jev e Gemini" },
  { n: 4, nome: "Entregar", resumo: "revisao e PDF" },
] as const;

const MOVIMENTOS: MovimentoPendulo[] = [
  "oscilacao",
  "giro_horario",
  "giro_antihorario",
  "imovel",
  "indefinido",
];

export default function PaginaSessao() {
  const { id } = useParams<{ id: string }>();

  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [anamneses, setAnamneses] = useState<AnamneseRespondida[]>([]);
  const [eventos, setEventos] = useState<EventoLeitura[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [laminaId, setLaminaId] = useState<string>("LAM-SIM-NAO");
  const [pergunta, setPergunta] = useState("");
  const [sintese, setSintese] = useState<Sintese | null>(null);
  const [redacao, setRedacao] = useState<Redacao | null>(null);
  const [trabalhando, setTrabalhando] = useState<string | null>(null);
  const [avisoIa, setAvisoIa] = useState<string | null>(null);
  const [nomePdf, setNomePdf] = useState<string | null>(null);
  const [fase, setFase] = useState(1);
  const [verEtapas, setVerEtapas] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const campoPergunta = useRef<HTMLTextAreaElement>(null);
  const rodape = useRef<HTMLDivElement>(null);
  const [alturaRodape, setAlturaRodape] = useState(104);

  const carregar = useCallback(async () => {
    const s = await lerSessao(id);
    if (!s) {
      setCarregando(false);
      return;
    }
    setSessao(s);
    // Reabrir a sessao volta ao ponto onde ela parou, nao ao comeco.
    setFase(s.faseAtual ?? 1);
    const p = await lerPessoa(s.pessoaId);
    setPessoa(p ?? null);
    setAnamneses(await listarAnamnesesDaPessoa(s.pessoaId));
    setEventos(await listarEventosDaSessao(s.id));
    // A sintese guardada volta com a sessao: sem isso, reabrir a pagina
    // perderia o texto revisado e o PDF nao poderia ser gerado de novo.
    const [ultima] = await listarSintesesDaSessao(s.id);
    if (ultima) {
      setSintese(ultima);
      setRedacao(ultima.redacao ?? null);
    }
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /*
   * Fase nova: topo da tela e foco no titulo. Feito depois da renderizacao, e
   * nao dentro de irPara, porque ali a fase antiga ainda estava desenhada e o
   * scroll voltava para o lugar errado. A primeira passagem nao mexe em nada:
   * abrir a sessao nao deve roubar o foco de quem acabou de chegar.
   */
  /*
   * O espaco reservado embaixo vem da altura real do rodape, nao de um valor
   * fixo: o recado de bloqueio quebra em duas linhas e a area segura do
   * aparelho muda de tamanho. Sem isso o ultimo campo fica atras da barra.
   */
  useEffect(() => {
    const el = rodape.current;
    if (!el) return;
    const medir = () => setAlturaRodape(el.offsetHeight);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [carregando]);

  const jaMontou = useRef(false);
  useEffect(() => {
    if (!jaMontou.current) {
      jaMontou.current = true;
      return;
    }
    window.scrollTo({ top: 0 });
    titulo.current?.focus();
  }, [fase]);

  const lamina: Lamina = useMemo(
    () => acharLamina(laminaId) ?? LAMINAS_LEITURA[0],
    [laminaId],
  );

  const sugeridas = useMemo(
    () => (pessoa ? rankearLaminas(anamneses, pessoa) : []),
    [anamneses, pessoa],
  );

  const temConvencao = Boolean(sessao?.convencao);
  const podeCamera = Boolean(
    pessoa?.consentimentos.find((c) => c.finalidade === "captura_de_video")
      ?.aceito,
  );
  const podeIa = Boolean(
    pessoa?.consentimentos.find(
      (c) => c.finalidade === "envio_a_fornecedor_de_ia",
    )?.aceito,
  );

  // --------------------------------------------------------------------
  async function registrarConvencao(
    mapa: Convencao["mapa"],
    sentido: Convencao["sentidoDeLeitura"],
  ) {
    if (!sessao) return;
    const c: Convencao = {
      id: novoId("CONV"),
      sessaoId: sessao.id,
      mapa,
      sentidoDeLeitura: sentido,
      registradoEm: agora(),
    };
    const s = { ...sessao, convencao: c };
    setSessao(s);
    await salvarSessao(s);
  }

  async function registrarLeitura(l: Leitura, modo: "camera" | "manual") {
    if (!sessao || !pergunta.trim()) {
      setAvisoIa("Escreva a pergunta exata antes de registrar a leitura.");
      // O motivo da recusa nao pode morar so num botao desligado: o foco vai
      // ao campo que precisa ser preenchido. Em tela cheia quem avisa e a
      // propria camada da camera, que tem o seu campo.
      if (!document.fullscreenElement) campoPergunta.current?.focus();
      return;
    }
    const temResultado = Boolean(l.zona);
    const evento: EventoLeitura = {
      id: novoId("EVT"),
      sessaoId: sessao.id,
      perguntaTexto: pergunta.trim(),
      sequencia: eventos.length + 1,
      laminaId: lamina.id,
      laminaVersao: lamina.versao,
      convencaoId: sessao.convencao?.id,
      modoEntrada: modo,
      movimento: l.movimento,
      zonaId: l.zona?.id,
      valor: l.valor,
      metricas: modo === "camera" ? l.metricas : undefined,
      motivosAbstencao: l.motivos.length ? l.motivos : undefined,
      statusResultado: temResultado
        ? "confirmado_pelo_terapeuta"
        : "inconclusivo",
      confirmadoPor: temResultado ? sessao.terapeuta : undefined,
      confirmadoEm: temResultado ? agora() : undefined,
    };
    await salvarEvento(evento);
    setEventos(await listarEventosDaSessao(sessao.id));
    setAvisoIa(null);
    // Pergunta nova para o proximo evento: nao reaproveitar texto.
    setPergunta("");
  }

  async function gerarSintese() {
    if (!sessao || !pessoa) return;
    setTrabalhando("Cruzando ficha e leituras pelas regras…");
    setAvisoIa(null);
    setRedacao(null);
    const base = sintetizar({
      sessaoId: sessao.id,
      pessoa,
      anamneses,
      eventos,
      temConvencao,
    });
    setSintese(base);
    await salvarSintese(base);
    const s = { ...sessao, status: "em_sintese" as const };
    setSessao(s);
    await salvarSessao(s);
    setTrabalhando(null);
  }

  async function orquestrarComIa() {
    if (!sessao || !pessoa || !sintese) return;
    setTrabalhando("O Jev está decidindo…");
    setAvisoIa(null);
    try {
      const trechos = extrairTrechos(anamneses);
      const payload = {
        tema: sessao.tema,
        preferenciaLinguagem: pessoa.preferenciaLinguagem ?? "neutra",
        assuntosEvitados: pessoa.assuntosEvitados ?? [],
        modulos: anamneses.map((a) => {
          const f = acharFormulario(a.formularioId);
          return {
            id: a.formularioId,
            titulo: f?.titulo ?? a.formularioId,
            limiteInterpretacao: f?.limiteInterpretacao ?? "",
          };
        }),
        // Desidentificado: sem nome, sem contato. Só IDs e trechos.
        fichaTrechos: trechos.map((t) => ({
          respostaId: t.respostaId,
          perguntaTexto: t.perguntaTexto,
          trecho: t.trecho,
          tags: t.tags,
          origem: t.origem,
        })),
        eventos: eventos.map((e) => {
          const lam = acharLamina(e.laminaId);
          const zona = lam?.zonas.find((z) => z.id === e.zonaId);
          return {
            eventoId: e.id,
            perguntaTexto: e.perguntaTexto,
            laminaNome: lam?.nome ?? e.laminaId,
            laminaVersao: e.laminaVersao,
            modoEntrada: e.modoEntrada,
            movimento: e.movimento,
            zonaRotulo: zona?.rotulo,
            zonaSignificado: zona?.significadoSimbolico,
            zonaTags: zona?.tags ?? [],
            valor: e.valor,
            statusResultado: e.statusResultado,
            motivosAbstencao: e.motivosAbstencao ?? [],
          };
        }),
        bandeiras: sintese.bandeiras.map((b) => ({
          tipo: b.tipo,
          trecho: b.trecho,
        })),
        laminasDisponiveis: CATALOGO.map((l) => ({
          id: l.id,
          nome: l.nome,
          tagsIndicacao: l.tagsIndicacao,
          configurada: l.configurada,
        })),
      };

      const rJev = await fetch("/api/jev/orquestrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const corpoJev = await rJev.json();
      if (!rJev.ok) {
        setAvisoIa(
          `${corpoJev?.erro ?? "Falha na orquestração."} A síntese pelas regras continua válida.`,
        );
        setTrabalhando(null);
        return;
      }
      const decisao = corpoJev.decisao as DecisaoJev;

      setTrabalhando("O Gemini está escrevendo o texto da entrega…");
      const rGem = await fetch("/api/gemini/redacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomePessoa: pessoa.nomePreferencia,
          nomeTerapeuta: sessao.terapeuta,
          tema: sessao.tema,
          preferenciaLinguagem: pessoa.preferenciaLinguagem ?? "neutra",
          assuntosEvitados: pessoa.assuntosEvitados ?? [],
          decisao,
          resultadoObservado: sintese.resultadoObservado,
          encaminhamentos: sintese.encaminhamentos,
          bandeiras: sintese.bandeiras.map((b) => ({
            tipo: b.tipo,
            trecho: b.trecho,
          })),
        }),
      });
      const corpoGem = await rGem.json();
      if (!rGem.ok) {
        setAvisoIa(
          `O Jev decidiu, mas a redação falhou: ${corpoGem?.erro ?? "erro"}. O PDF sai com o texto das regras.`,
        );
      }
      const redigida: Redacao | null = rGem.ok
        ? (corpoGem.redacao as Redacao)
        : null;
      if (redigida) setRedacao(redigida);

      const atualizada: Sintese = {
        ...sintese,
        redacao: redigida ?? sintese.redacao,
        status: decisao.status,
        interpretacaoSimbolica: decisao.interpretacaoSimbolica,
        vinculosDeApoio: decisao.vinculosDeApoio,
        contradicoesELacunas: [
          ...new Set([
            ...sintese.contradicoesELacunas,
            ...decisao.contradicoesELacunas,
          ]),
        ],
        perguntasDeConfirmacao: [
          ...new Set([
            ...sintese.perguntasDeConfirmacao,
            ...decisao.perguntasDeConfirmacao,
          ]),
        ],
        acoesAcordadas: [
          ...sintese.acoesAcordadas,
          ...decisao.acoesSugeridas.map((a) => ({
            prazo: a.prazo,
            texto: a.texto,
            apoio: a.apoio,
          })),
        ],
        limites: [...new Set([...sintese.limites, ...decisao.limites])],
        procedencia: {
          ...sintese.procedencia,
          motor: "deterministico+ia",
          jevModelo: corpoJev.modelo,
          geminiModelo: rGem.ok ? corpoGem.modelo : undefined,
          geradoEm: new Date().toISOString(),
        },
      };
      setSintese(atualizada);
      await salvarSintese(atualizada);

      if (decisao.proximaLaminaId) {
        setAvisoIa(
          `Sugestão de próxima lâmina: ${acharLamina(decisao.proximaLaminaId)?.nome ?? decisao.proximaLaminaId}. ${decisao.proximaLaminaMotivo}`,
        );
      }
    } catch {
      setAvisoIa(
        "Não foi possível falar com os serviços de IA. A síntese pelas regras continua válida.",
      );
    } finally {
      setTrabalhando(null);
    }
  }

  async function aprovarEBaixar() {
    if (!sessao || !pessoa || !sintese) return;
    const encerrada = sessao.encerradaEm ?? agora();
    const sFinal: Sessao = {
      ...sessao,
      status: "encerrada",
      encerradaEm: encerrada,
    };
    const versaoAnterior = sintese.revisao?.versao ?? 0;
    const revisada: Sintese = {
      ...sintese,
      revisao: {
        autor: sessao.terapeuta,
        decisao: "aprovada",
        alteracoes: versaoAnterior === 0 ? "primeira aprovação" : "nova versão aprovada",
        em: agora(),
        versao: versaoAnterior + 1,
      },
    };
    setSessao(sFinal);
    setSintese(revisada);
    await salvarSessao(sFinal);
    await salvarSintese(revisada);

    const nome = baixarPdf({
      pessoa,
      sessao: sFinal,
      sintese: revisada,
      redacao: redacao ?? undefined,
      laminasUsadas: [
        ...new Set(
          eventos.map((e) => acharLamina(e.laminaId)?.nome ?? e.laminaId),
        ),
      ],
    });
    setNomePdf(nome);
  }

  /**
   * Sessao encerrada volta a aceitar registro. O horario de encerramento sai
   * junto: a proxima aprovacao marca o seu, e cada aprovacao ja conta uma
   * versao propria na revisao.
   */
  async function reabrirSessao() {
    if (!sessao) return;
    const { encerradaEm: _antigo, ...resto } = sessao;
    const s: Sessao = { ...resto, status: "aberta" };
    setSessao(s);
    await salvarSessao(s);
    setNomePdf(null);
  }

  /**
   * Troca de fase: guarda onde parou, volta o scroll ao topo e leva o foco ao
   * titulo da fase nova, para quem navega por teclado ou leitor de tela nao
   * ficar preso no rodape.
   */
  async function irPara(n: number) {
    if (!sessao) return;
    const alvo = Math.min(FASES.length, Math.max(1, n));
    setFase(alvo);
    setVerEtapas(false);
    const s = { ...sessao, faseAtual: alvo };
    setSessao(s);
    await salvarSessao(s);
  }

  // --------------------------------------------------------------------
  if (carregando) {
    return <p className="text-sm text-[var(--color-texto-2)]">Carregando…</p>;
  }
  if (!sessao || !pessoa) {
    return (
      <div className="space-y-3">
        <p className="text-sm">Sessão não encontrada neste aparelho.</p>
        <Link href="/" className="btn">
          Voltar
        </Link>
      </div>
    );
  }

  const fe = FASES[fase - 1];

  // A acao principal do rodape e sempre o proximo gesto real, nao "avancar".
  let rotuloAcao = "Ir para a leitura";
  let acaoPrincipal: () => void = () => irPara(fase + 1);
  let impedimento: string | null = null;
  let recado: string | null = null;
  if (fase === 1) {
    if (!temConvencao)
      recado =
        "Sem convencao registrada as leituras so entram como inconclusivas.";
  } else if (fase === 2) {
    rotuloAcao = "Cruzar os dados";
    if (eventos.length === 0)
      recado =
        "Nenhuma leitura registrada ainda. Da para cruzar so a ficha, mas o texto sai magro.";
  } else if (fase === 3) {
    if (!sintese) {
      rotuloAcao = "Cruzar pelas regras";
      acaoPrincipal = gerarSintese;
    } else {
      rotuloAcao = "Ir para a entrega";
    }
  } else {
    rotuloAcao =
      sessao.status === "encerrada"
        ? "Gerar o PDF de novo"
        : "Aprovar e gerar o PDF";
    acaoPrincipal = aprovarEBaixar;
    if (!sintese)
      impedimento = "Cruze os dados na fase 3 antes de gerar o PDF.";
  }

  return (
    <div
      className="com-rodape space-y-5"
      style={{ paddingBottom: alturaRodape + 24 }}
    >
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="rotulo">
            Fase {fase} de {FASES.length} &middot; {fe.nome}
          </p>
          <button
            className="btn btn-discreto btn-pequeno"
            onClick={() => setVerEtapas((v) => !v)}
            aria-expanded={verEtapas}
          >
            {verEtapas ? "Fechar etapas" : "Ver etapas"}
          </button>
        </div>
        <h1
          ref={titulo}
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          {rotuloDoTema(sessao.tema) ?? sessao.tema}
        </h1>
        <p className="text-xs leading-relaxed text-[var(--color-texto-2)]">
          <Link href={`/pessoas/${pessoa.id}`} className="underline">
            {pessoa.nomePreferencia}
          </Link>{" "}
          &middot; {new Date(sessao.iniciadaEm).toLocaleString("pt-BR")}{" "}
          &middot; {sessao.terapeuta} &middot;{" "}
          {sessao.status.replace(/_/g, " ")}
        </p>
        {/*
          * A fase atual e mais alta e mais clara que as ja vistas: quem nao
          * distingue as duas cores ainda ve qual e qual pela altura.
          */}
        <div className="flex items-end gap-1.5" aria-hidden>
          {FASES.map((f) => (
            <span
              key={f.n}
              className={`flex-1 rounded-full ${
                f.n === fase
                  ? "h-2 bg-[var(--color-acento-forte)]"
                  : f.n < fase
                    ? "h-1 bg-[var(--color-acento)]"
                    : "h-1 bg-[var(--color-borda)]"
              }`}
            />
          ))}
        </div>
      </header>

      {verEtapas && (
        <nav className="cartao space-y-2">
          <p className="rotulo">Etapas desta sessão</p>
          <ul className="space-y-1.5">
            {FASES.map((f) => {
              // "Ja vista" e o que o app sabe de fato. Passar por uma fase
              // nao conclui nada: o requisito de cada uma continua valendo.
              const estado =
                f.n === fase ? "atual" : f.n < fase ? "já vista" : "não aberta";
              return (
                <li key={f.n}>
                  <button
                    className={`btn btn-pequeno w-full justify-between gap-3 ${
                      f.n === fase ? "btn-principal" : ""
                    }`}
                    onClick={() => irPara(f.n)}
                    aria-current={f.n === fase ? "step" : undefined}
                  >
                    <span className="text-left font-normal">
                      {f.n}. {f.nome}
                    </span>
                    <span className="text-xs opacity-80">{estado}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs leading-relaxed text-[var(--color-texto-2)]">
            Ir e voltar aqui não dispensa requisito: sem convenção o app não
            interpreta, e sem síntese não há PDF.
          </p>
        </nav>
      )}

      <div aria-live="polite">
        {avisoIa && (
          <p id="aviso-da-sessao" className="aviso aviso-cuidado">
            {avisoIa}
          </p>
        )}
      </div>

      {sessao.status === "encerrada" && (
        <div className="aviso aviso-cuidado space-y-2">
          <p>
            Esta sessão foi encerrada
            {sessao.encerradaEm
              ? ` em ${new Date(sessao.encerradaEm).toLocaleString("pt-BR")}`
              : ""}
            . O PDF pode ser gerado de novo a qualquer momento. Para registrar
            leituras novas, reabra a sessão — a reabertura não apaga nada do
            que já está gravado.
          </p>
          <button className="btn btn-pequeno" onClick={reabrirSessao}>
            Reabrir sessão
          </button>
        </div>
      )}

      {/* ================= Fase 1 — Preparar ================= */}
      {fase === 1 && (
        <div className="space-y-6">
          <BlocoConvencao sessao={sessao} onRegistrar={registrarConvencao} />

          <section className="space-y-3">
            <h2 className="rotulo">Lâmina desta leitura</h2>
            {sugeridas.length > 0 && (
              <div className="cartao space-y-2">
                <p className="text-sm">
                  Sugestão a partir da ficha — pertinência textual, não
                  probabilidade:
                </p>
                <div className="flex flex-wrap gap-2">
                  {sugeridas.slice(0, 5).map((s) => (
                    <button
                      key={s.lamina.id}
                      className={`btn btn-pequeno ${
                        laminaId === s.lamina.id ? "btn-principal" : ""
                      }`}
                      onClick={() => setLaminaId(s.lamina.id)}
                      title={s.porque.join("; ")}
                    >
                      {s.lamina.nome}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[var(--color-texto-2)]">
                  {sugeridas[0].porque.join(" · ")}
                </p>
              </div>
            )}
            <label className="block space-y-1">
              <span className="rotulo">Todas as lâminas</span>
              <select
                className="campo"
                value={laminaId}
                onChange={(e) => setLaminaId(e.target.value)}
              >
                {LAMINAS_LEITURA.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.tipo} — {l.nome}
                  </option>
                ))}
              </select>
            </label>
            <details className="cartao">
              <summary className="cursor-pointer py-1.5 text-sm">
                Manual de {lamina.nome}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-texto-2)]">
                {lamina.manual}
              </p>
            </details>
            <p className="text-xs leading-relaxed text-[var(--color-texto-2)]">
              A câmera reconhece a prancha sozinha e troca a lâmina ativa se o
              papel mudar no meio da sessão. Esta escolha é o ponto de partida.
            </p>
          </section>
        </div>
      )}

      {/* ================= Fase 2 — Ler ================= */}
      {fase === 2 && (
        <div className="space-y-6">
          {!temConvencao && (
            <p className="aviso aviso-cuidado">
              A convenção desta sessão não foi registrada. O app não interpreta
              sem ela: as leituras só podem ser gravadas como inconclusivas.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => irPara(1)}
              >
                Voltar e registrar
              </button>
              .
            </p>
          )}

          <section className="space-y-3">
            <h2 className="rotulo">Pergunta desta leitura</h2>
            <textarea
              ref={campoPergunta}
              className="campo"
              aria-label="Pergunta desta leitura"
              aria-invalid={Boolean(avisoIa) && !pergunta.trim()}
              aria-describedby={avisoIa ? "aviso-da-sessao" : undefined}
              rows={2}
              placeholder="Texto exato da pergunta, com tema e período definidos"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
            />
            <p className="text-xs leading-relaxed text-[var(--color-texto-2)]">
              O texto é guardado como está. Se a pergunta mudar durante a
              pendulação, isso vira um novo evento de leitura. Escreva sem
              nomes: a pergunta é a única frase sua que sai do aparelho quando
              você usa a camada de IA.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="rotulo">Pendulação em {lamina.nome}</h2>
            <CameraPendulo
              lamina={lamina}
              temConvencao={temConvencao}
              sentidoDeLeitura={
                sessao.convencao?.sentidoDeLeitura ?? "definido_pelo_terapeuta"
              }
              podeUsarCamera={podeCamera}
              podeEnviarAIa={podeIa}
              onRegistrar={registrarLeitura}
              onTrocarLamina={setLaminaId}
              pergunta={pergunta}
              onPergunta={setPergunta}
              totalLeituras={eventos.length}
            />
          </section>

          <section className="space-y-3">
            <h2 className="rotulo">Leituras registradas ({eventos.length})</h2>
            {eventos.length === 0 ? (
              <p className="text-sm text-[var(--color-texto-2)]">
                Nenhuma leitura ainda. Escreva a pergunta, abra a câmera ou
                toque na zona da lâmina.
              </p>
            ) : (
              <ul className="space-y-2">
                {eventos.map((e) => {
                  const pendencias = validarIntegridade(e, temConvencao);
                  return (
                    <li key={e.id} className="cartao space-y-2">
                      <p className="text-sm leading-relaxed">
                        {descreverEvento(e)}
                      </p>
                      {e.motivosAbstencao?.length ? (
                        <ul className="text-xs text-[var(--color-cuidado)]">
                          {e.motivosAbstencao.map((m) => (
                            <li key={m}>• {TEXTO_ABSTENCAO[m]}</li>
                          ))}
                        </ul>
                      ) : null}
                      {pendencias.length > 0 && (
                        <ul className="text-xs text-[var(--color-alerta)]">
                          {pendencias.map((p) => (
                            <li key={p.campo}>• {p.mensagem}</li>
                          ))}
                        </ul>
                      )}
                      <button
                        className="btn btn-pequeno"
                        onClick={async () => {
                          await apagarEvento(e.id);
                          setEventos(await listarEventosDaSessao(sessao.id));
                        }}
                      >
                        Remover este registro
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* ================= Fase 3 — Cruzar ================= */}
      {fase === 3 && (
        <div className="space-y-5">
          <section className="space-y-3">
            <h2 className="rotulo">Cruzamento</h2>
            <p className="text-sm leading-relaxed text-[var(--color-texto-2)]">
              Primeiro as regras do aplicativo, sem IA: elas cruzam a ficha com
              as {eventos.length} leitura(s) e decidem os encaminhamentos.
              Depois, se autorizado, o Jev decide o que se sustenta e o Gemini
              escreve na sua voz.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn flex-1"
                onClick={gerarSintese}
                disabled={Boolean(trabalhando)}
              >
                {sintese ? "Cruzar de novo" : "Cruzar pelas regras"}
              </button>
              <button
                className="btn flex-1"
                onClick={orquestrarComIa}
                disabled={!sintese || !podeIa || Boolean(trabalhando)}
                title={
                  podeIa
                    ? "Jev decide, Gemini escreve"
                    : "Sem autorização de envio a fornecedor de IA"
                }
              >
                Jev + Gemini
              </button>
            </div>
            {trabalhando && <p className="aviso aviso-ok">{trabalhando}</p>}
            {!podeIa && (
              <p className="text-xs leading-relaxed text-[var(--color-texto-2)]">
                A camada de IA está indisponível porque a autorização de envio
                a fornecedor de IA não foi registrada. A síntese pelas regras
                funciona sem ela.
              </p>
            )}
            {!sintese && !trabalhando && (
              <p className="text-sm text-[var(--color-texto-2)]">
                Nada cruzado ainda nesta sessão.
              </p>
            )}
          </section>

          {sintese && <PainelSintese sintese={sintese} redacao={redacao} />}
        </div>
      )}

      {/* ================= Fase 4 — Entregar ================= */}
      {fase === 4 && (
        <div className="space-y-4">
          <section className="space-y-3">
            <h2 className="rotulo">Entrega</h2>
            <p className="text-sm leading-relaxed text-[var(--color-texto-2)]">
              Toda síntese é rascunho até a sua revisão. Ao aprovar, a sessão é
              encerrada, a revisão fica registrada com autor e horário, e o PDF
              é gerado aqui no aparelho. A sessão encerrada continua aberta
              para gerar o PDF outra vez; cada aprovação conta uma versão.
            </p>
          </section>

          {!sintese ? (
            <p className="aviso aviso-cuidado">
              Não há síntese nesta sessão. Volte à fase Cruzar antes de gerar o
              PDF.
            </p>
          ) : redacao ? (
            <PainelRedacao redacao={redacao} />
          ) : (
            <p className="aviso aviso-cuidado">
              Sem a camada de redação, o PDF sai com o texto das regras —
              correto, mas seco. Rode &quot;Jev + Gemini&quot; na fase Cruzar
              para o texto na sua voz.
            </p>
          )}

          {nomePdf && (
            <p className="aviso aviso-ok">
              PDF gerado: <span className="font-mono">{nomePdf}</span>
            </p>
          )}
        </div>
      )}

      {/* Rodape persistente: a proxima acao nao exige rolar a tela. */}
      <div ref={rodape} className="rodape-fixo">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          {fase === 1 ? (
            <Link
              href={`/pessoas/${pessoa.id}`}
              className="btn btn-pequeno shrink-0"
            >
              ‹ Sair
            </Link>
          ) : (
            <button
              className="btn btn-pequeno shrink-0"
              onClick={() => irPara(fase - 1)}
            >
              ‹ {FASES[fase - 2].nome}
            </button>
          )}
          <button
            className="btn btn-principal min-w-0 flex-1"
            onClick={acaoPrincipal}
            disabled={Boolean(impedimento) || Boolean(trabalhando)}
          >
            {trabalhando ? "Trabalhando…" : rotuloAcao}
          </button>
        </div>
        {(impedimento || recado) && (
          <p className="mx-auto max-w-2xl px-4 pb-2.5 text-xs leading-snug text-[var(--color-texto-2)]">
            {impedimento ?? recado}
          </p>
        )}
      </div>
    </div>
  );
}

// =========================================================================
function BlocoConvencao({
  sessao,
  onRegistrar,
}: {
  sessao: Sessao;
  onRegistrar: (
    mapa: Convencao["mapa"],
    sentido: Convencao["sentidoDeLeitura"],
  ) => void;
}) {
  const [mapa, setMapa] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    for (const m of sessao.convencao?.mapa ?? []) {
      inicial[m.movimento] = m.significado;
    }
    return inicial;
  });
  const [sentido, setSentido] = useState<Convencao["sentidoDeLeitura"]>(
    sessao.convencao?.sentidoDeLeitura ?? "lado_da_prancha",
  );

  const registrada = Boolean(sessao.convencao);

  return (
    <section className="space-y-3">
      <h2 className="rotulo">
        Convenção desta sessão {registrada && "· registrada"}
      </h2>
      <div className="cartao space-y-3">
        <p className="text-sm leading-relaxed text-[var(--color-texto-2)]">
          A regra que associa cada movimento a um significado vale para esta
          sessão e fica guardada com ela. Escolas diferem; nada aqui é
          universal.
        </p>
        {MOVIMENTOS.map((m) => (
          <label key={m} className="block space-y-1">
            <span className="rotulo">{m.replace(/_/g, " ")}</span>
            <input
              className="campo"
              placeholder="O que este movimento significa nesta sessão"
              value={mapa[m] ?? ""}
              onChange={(e) => setMapa({ ...mapa, [m]: e.target.value })}
            />
          </label>
        ))}

        <div className="space-y-1">
          <span className="rotulo">
            Sentido de leitura num eixo de oscilação
          </span>
          <p className="text-xs leading-relaxed text-[var(--color-texto-2)]">
            Uma oscilação define um eixo com dois sentidos. Em leque de 180° só
            um cai sobre a prancha. Em círculo de 360° os dois caem, e a
            escolha é sua, não do algoritmo.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {(
              [
                ["lado_da_prancha", "O lado da prancha"],
                ["ambos_os_lados", "Os dois lados contam"],
                ["definido_pelo_terapeuta", "Eu escolho em cada leitura"],
              ] as const
            ).map(([v, rotulo]) => (
              <button
                key={v}
                className={`btn btn-pequeno ${
                  sentido === v ? "btn-principal" : ""
                }`}
                onClick={() => setSentido(v)}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn-principal w-full"
          onClick={() =>
            onRegistrar(
              MOVIMENTOS.filter((m) => (mapa[m] ?? "").trim()).map((m) => ({
                movimento: m,
                significado: mapa[m].trim(),
              })),
              sentido,
            )
          }
          disabled={!MOVIMENTOS.some((m) => (mapa[m] ?? "").trim())}
        >
          {registrada ? "Atualizar convenção" : "Registrar convenção"}
        </button>
      </div>
    </section>
  );
}

// =========================================================================
function PainelSintese({
  sintese,
  redacao,
}: {
  sintese: Sintese;
  redacao: Redacao | null;
}) {
  return (
    <div className="space-y-3">
      <div className="cartao space-y-2">
        <p className="rotulo">Status</p>
        <p className="text-sm">
          {sintese.status.replace(/_/g, " ")} ·{" "}
          {sintese.procedencia.motor === "deterministico"
            ? "regras do aplicativo"
            : `regras + ${sintese.procedencia.jevModelo ?? "Jev"}${
                sintese.procedencia.geminiModelo
                  ? ` + ${sintese.procedencia.geminiModelo}`
                  : ""
              }`}
        </p>
      </div>

      {sintese.bandeiras.length > 0 && (
        <div className="space-y-2 rounded-xl border border-[var(--color-cuidado)]/50 bg-[var(--color-cuidado)]/10 p-4">
          <p className="rotulo">Encaminhamentos por regra</p>
          <ul className="space-y-1 text-sm">
            {sintese.bandeiras.map((b) => (
              <li key={`${b.tipo}-${b.respostaId}`}>
                <strong>{TEXTO_BANDEIRA[b.tipo]}</strong> — {b.respostaId}
              </li>
            ))}
          </ul>
          {sintese.encaminhamentos.map((e) => (
            <p key={e} className="text-sm leading-relaxed">
              {e}
            </p>
          ))}
        </div>
      )}

      <Bloco titulo="O que foi observado" itens={sintese.resultadoObservado} />

      <div className="cartao space-y-2">
        <p className="rotulo">Hipótese simbólica</p>
        <p className="whitespace-pre-line text-sm leading-relaxed">
          {sintese.interpretacaoSimbolica}
        </p>
      </div>

      {sintese.vinculosDeApoio.length > 0 && (
        <div className="cartao space-y-2">
          <p className="rotulo">
            Vínculos citados ({sintese.vinculosDeApoio.length})
          </p>
          <ul className="space-y-1.5 text-sm">
            {sintese.vinculosDeApoio.map((v, i) => (
              <li key={`${v.respostaId}-${i}`}>
                <strong>{v.temaDoSimbolo}</strong> ←{" "}
                <span className="font-mono text-xs">{v.respostaId}</span>:{" "}
                <span className="text-[var(--color-texto-2)]">{v.trecho}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Bloco
        titulo="Lacunas e divergências"
        itens={sintese.contradicoesELacunas}
      />
      <Bloco
        titulo="Perguntas de confirmação"
        itens={sintese.perguntasDeConfirmacao}
      />

      {sintese.acoesAcordadas.length > 0 && (
        <div className="cartao space-y-2">
          <p className="rotulo">Passos acordados</p>
          {(["agora", "curto", "medio", "longo"] as const).map((prazo) => {
            const itens = sintese.acoesAcordadas.filter(
              (a) => a.prazo === prazo,
            );
            if (itens.length === 0) return null;
            return (
              <div key={prazo}>
                <p className="text-sm font-medium capitalize">{prazo}</p>
                <ul className="space-y-1 text-sm text-[var(--color-texto-2)]">
                  {itens.map((a, i) => (
                    <li key={`${prazo}-${i}`}>
                      • {a.texto}
                      {a.apoio.length === 0 && (
                        <span className="text-[var(--color-cuidado)]">
                          {" "}
                          (sem apoio citado)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <Bloco titulo="Limites" itens={sintese.limites} />

      {redacao && (
        <div className="cartao space-y-3">
          <p className="rotulo">Texto que vai no PDF</p>
          {(
            [
              ["", redacao.abertura],
              ["O que aconteceu na lâmina", redacao.oQueObservamos],
              ["O que você me contou", redacao.oQueVoceContou],
              ["Como uma coisa conversa com a outra", redacao.comoIssoSeConversa],
              ["O que ficou em aberto", redacao.oQueFicouEmAberto],
              ["Encaminhamento", redacao.encaminhamento],
              ["Para fechar", redacao.fechamento],
            ] as const
          ).map(([titulo, texto], i) =>
            texto?.trim() ? (
              <div key={i} className="space-y-1">
                {titulo && <p className="rotulo">{titulo}</p>}
                <p className="text-sm leading-relaxed">{texto}</p>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function Bloco({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (itens.length === 0) return null;
  return (
    <div className="cartao space-y-2">
      <p className="rotulo">{titulo}</p>
      <ul className="space-y-1.5 text-sm leading-relaxed text-[var(--color-texto-2)]">
        {itens.map((t, i) => (
          <li key={i}>• {t}</li>
        ))}
      </ul>
    </div>
  );
}

// =========================================================================
// O texto que vai no PDF, na tela antes da aprovacao. O terapeuta nao deve
// assinar um documento que ele nao leu (dossie, p. 40: "Toda sintese e
// rascunho ate a revisao").
// =========================================================================
function PainelRedacao({ redacao }: { redacao: Redacao }) {
  const passos: [string, string[]][] = [
    ["Agora", redacao.passos.agora],
    ["Curto prazo", redacao.passos.curto],
    ["Médio prazo", redacao.passos.medio],
    ["Longo prazo", redacao.passos.longo],
  ];
  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-acento)]/35 bg-[var(--color-acento)]/5 p-3">
      <p className="rotulo">Como vai sair no PDF, na sua voz</p>
      <div className="space-y-3 text-sm leading-relaxed">
        <Paragrafo texto={redacao.abertura} />
        <Trecho titulo="O que observamos" texto={redacao.oQueObservamos} />
        <Trecho titulo="O que você contou" texto={redacao.oQueVoceContou} />
        <Trecho
          titulo="Como isso se conversa"
          texto={redacao.comoIssoSeConversa}
        />
        <Trecho
          titulo="O que ficou em aberto"
          texto={redacao.oQueFicouEmAberto}
        />
        {redacao.perguntasParaVoce.length > 0 && (
          <div>
            <p className="rotulo">Perguntas para você pensar</p>
            <ul className="space-y-1">
              {redacao.perguntasParaVoce.map((q) => (
                <li key={q}>— {q}</li>
              ))}
            </ul>
          </div>
        )}
        {passos.map(([titulo, itens]) =>
          itens.length === 0 ? null : (
            <div key={titulo}>
              <p className="rotulo">{titulo}</p>
              <ul className="space-y-1">
                {itens.map((i) => (
                  <li key={i}>— {i}</li>
                ))}
              </ul>
            </div>
          ),
        )}
        <Trecho titulo="Encaminhamento" texto={redacao.encaminhamento} />
        <Paragrafo texto={redacao.fechamento} />
      </div>
      <p className="text-xs text-[var(--color-texto-2)]">
        Leia antes de aprovar. Se algo não for seu jeito de falar, rode
        &quot;Jev + Gemini&quot; de novo: cada rodada reescreve o texto.
      </p>
    </div>
  );
}

function Paragrafo({ texto }: { texto: string }) {
  if (!texto?.trim()) return null;
  return <p>{texto}</p>;
}

function Trecho({ titulo, texto }: { titulo: string; texto: string }) {
  if (!texto?.trim()) return null;
  return (
    <div>
      <p className="rotulo">{titulo}</p>
      <p className="text-[var(--color-texto-2)]">{texto}</p>
    </div>
  );
}
