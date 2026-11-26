"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import CameraPendulo from "@/components/CameraPendulo";
import { acharLamina, CATALOGO, LAMINAS_LEITURA } from "@/data/laminas";
import { acharFormulario } from "@/data/formularios";
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

  const carregar = useCallback(async () => {
    const s = await lerSessao(id);
    if (!s) {
      setCarregando(false);
      return;
    }
    setSessao(s);
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

  return (
    <div className="space-y-7">
      <header className="space-y-1">
        <Link
          href={`/pessoas/${pessoa.id}`}
          className="text-sm text-[var(--color-texto-2)] hover:text-[var(--color-texto)]"
        >
          ‹ {pessoa.nomePreferencia}
        </Link>
        <h1 className="text-xl font-semibold">{sessao.tema}</h1>
        <p className="text-xs text-[var(--color-texto-2)]">
          {new Date(sessao.iniciadaEm).toLocaleString("pt-BR")} ·{" "}
          {sessao.terapeuta} · {sessao.status}
        </p>
      </header>

      {/* ---- 1. Convenção ---- */}
      <BlocoConvencao
        sessao={sessao}
        onRegistrar={registrarConvencao}
      />

      {/* ---- 2. Lâmina ---- */}
      <section className="space-y-3">
        <h2 className="rotulo">2. Lâmina</h2>
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
        <details className="cartao">
          <summary className="cursor-pointer text-sm">
            Manual de {lamina.nome}
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-texto-2)]">
            {lamina.manual}
          </p>
        </details>
      </section>

      {/* ---- 3. Pergunta ---- */}
      <section className="space-y-3">
        <h2 className="rotulo">3. Pergunta desta leitura</h2>
        <textarea
          className="campo"
          rows={2}
          placeholder="Texto exato da pergunta, com tema e período definidos"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
        />
        <p className="text-xs text-[var(--color-texto-2)]">
          O texto é guardado como está. Se a pergunta mudar durante a
          pendulação, isso virá um novo evento de leitura.
        </p>
      </section>

      {/* ---- 4. Pendulação ---- */}
      <section className="space-y-3">
        <h2 className="rotulo">4. Pendulação</h2>
        {!temConvencao && (
          <p className="rounded-lg border border-[var(--color-cuidado)]/40 bg-[var(--color-cuidado)]/10 p-3 text-sm">
            Registre a convenção acima. Sem convenção, o app não interpreta.
          </p>
        )}
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
        />
      </section>

      {/* ---- 5. Eventos ---- */}
      <section className="space-y-3">
        <h2 className="rotulo">5. Leituras registradas ({eventos.length})</h2>
        {eventos.length === 0 ? (
          <p className="text-sm text-[var(--color-texto-2)]">
            Nenhuma leitura ainda.
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

      {/* ---- 6. Síntese ---- */}
      <section className="space-y-3">
        <h2 className="rotulo">6. Síntese</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-principal flex-1"
            onClick={gerarSintese}
            disabled={Boolean(trabalhando)}
          >
            Cruzar pelas regras
          </button>
          <button
            className="btn"
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
        {trabalhando && (
          <p className="text-sm text-[var(--color-acento-forte)]">
            {trabalhando}
          </p>
        )}
        {avisoIa && (
          <p className="rounded-lg border border-[var(--color-cuidado)]/40 bg-[var(--color-cuidado)]/10 p-3 text-sm">
            {avisoIa}
          </p>
        )}
        {!podeIa && (
          <p className="text-xs text-[var(--color-texto-2)]">
            A camada de IA está indisponível porque a autorização de envio a
            fornecedor de IA não foi registrada. A síntese pelas regras funciona
            sem ela.
          </p>
        )}

        {sintese && <PainelSintese sintese={sintese} redacao={redacao} />}
      </section>

      {/* ---- 7. Entrega ---- */}
      {sintese && (
        <section className="space-y-3">
          <h2 className="rotulo">7. Entrega</h2>
          <div className="cartao space-y-3">
            <p className="text-sm leading-relaxed text-[var(--color-texto-2)]">
              Toda síntese é rascunho até a sua revisão. Ao aprovar, a sessão é
              encerrada, a revisão fica registrada com autor e horário, e o PDF
              é gerado aqui no aparelho. A sessão encerrada continua aberta
              para gerar o PDF outra vez; cada aprovação conta uma versão.
            </p>
            <button className="btn btn-principal w-full" onClick={aprovarEBaixar}>
              {sessao.status === "encerrada"
                ? "Gerar o PDF de novo"
                : "Aprovar e gerar o PDF"}
            </button>
            {nomePdf && (
              <p className="text-sm text-[var(--color-ok)]">
                PDF gerado: <span className="font-mono">{nomePdf}</span>
              </p>
            )}
            {!redacao && (
              <p className="text-xs text-[var(--color-texto-2)]">
                Sem a camada de redação, o PDF sai com o texto das regras —
                correto, mas seco. Rode &quot;Jev + Gemini&quot; antes para o
                texto na sua voz.
              </p>
            )}
          </div>
        </section>
      )}
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
        1. Convenção desta sessão {registrada && "· registrada"}
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
