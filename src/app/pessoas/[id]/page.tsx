"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  agora,
  apagarPessoa,
  lerNomeTerapeuta,
  lerPessoa,
  listarAnamnesesDaPessoa,
  listarSessoesDaPessoa,
  novoId,
  salvarPessoa,
  salvarSessao,
} from "@/lib/db";
import {
  acharFormulario,
  FICHA_BASE,
  MODULOS,
  MOTIVO_PARA_MODULOS,
  rotuloDoTema,
} from "@/data/formularios";
import { FINALIDADES } from "@/lib/tipos";
import type {
  AnamneseRespondida,
  Consentimento,
  FinalidadeConsentimento,
  Pessoa,
  PreferenciaLinguagem,
  Sessao,
} from "@/lib/tipos";

/** B02 guarda o valor interno; aqui vira o rótulo que a pessoa leu na tela. */
export default function PaginaPessoa() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [anamneses, setAnamneses] = useState<AnamneseRespondida[]>([]);
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [tema, setTema] = useState("");
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    const p = await lerPessoa(id);
    if (!p) {
      setCarregando(false);
      return;
    }
    setPessoa(p);
    setAnamneses(await listarAnamnesesDaPessoa(id));
    setSessoes(await listarSessoesDaPessoa(id));
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  async function atualizar(mudanca: Partial<Pessoa>) {
    if (!pessoa) return;
    const novo = { ...pessoa, ...mudanca, atualizadoEm: agora() };
    setPessoa(novo);
    await salvarPessoa(novo);
  }

  async function alternarConsentimento(f: FinalidadeConsentimento) {
    if (!pessoa) return;
    const def = FINALIDADES.find((x) => x.valor === f)!;
    const existente = pessoa.consentimentos.find((c) => c.finalidade === f);
    const novo: Consentimento = {
      finalidade: f,
      aceito: !existente?.aceito,
      textoApresentado: def.texto,
      decididoEm: agora(),
      revogadoEm: existente?.aceito ? agora() : undefined,
    };
    await atualizar({
      consentimentos: [
        ...pessoa.consentimentos.filter((c) => c.finalidade !== f),
        novo,
      ],
    });
  }

  async function iniciarSessao() {
    if (!pessoa) return;
    const t =
      tema.trim() || rotuloDoTema(pessoa.temaPrincipal) || "sessão sem tema declarado";
    const s: Sessao = {
      id: novoId("SES"),
      pessoaId: pessoa.id,
      tema: t,
      anamneseIds: anamneses.map((a) => a.id),
      status: "aberta",
      iniciadaEm: agora(),
      terapeuta: lerNomeTerapeuta() || "terapeuta não identificado",
    };
    await salvarSessao(s);
    router.push(`/sessao/${s.id}`);
  }

  if (carregando) {
    return <p className="text-sm text-[var(--color-texto-2)]">Carregando…</p>;
  }
  if (!pessoa) {
    return (
      <div className="space-y-3">
        <p className="text-sm">Pessoa não encontrada neste aparelho.</p>
        <Link href="/" className="btn">
          Voltar
        </Link>
      </div>
    );
  }

  const fichaBase = anamneses.find((a) => a.formularioId === "BASE");
  const modulosSugeridos = pessoa.temaPrincipal
    ? MOTIVO_PARA_MODULOS[pessoa.temaPrincipal] ?? []
    : [];
  const consentimentoRegistro = pessoa.consentimentos.find(
    (c) => c.finalidade === "registro_da_sessao",
  )?.aceito;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/"
          className="btn btn-discreto btn-pequeno -ml-3"
        >
          ‹ Pessoas
        </Link>
        <h1 className="text-xl font-semibold">{pessoa.nomePreferencia}</h1>
      </header>

      {/* ---- Preferências ---- */}
      <section className="cartao space-y-4">
        <p className="rotulo">Preferências desta pessoa</p>

        <label className="block space-y-1">
          <span className="text-sm">
            Linguagem preferida (B14) — define o tom do relatório
          </span>
          <div className="flex flex-wrap gap-2">
            {(["espiritual", "simbolica", "neutra"] as PreferenciaLinguagem[]).map(
              (v) => (
                <button
                  key={v}
                  className={`btn btn-pequeno ${
                    pessoa.preferenciaLinguagem === v ? "btn-principal" : ""
                  }`}
                  onClick={() => atualizar({ preferenciaLinguagem: v })}
                >
                  {v}
                </button>
              ),
            )}
          </div>
        </label>

        <label className="block space-y-1">
          <span className="text-sm">
            Assuntos que ela pediu para não abordar (B15)
          </span>
          <input
            className="campo"
            placeholder="Separe por ponto e vírgula"
            defaultValue={(pessoa.assuntosEvitados ?? []).join("; ")}
            onBlur={(e) =>
              atualizar({
                assuntosEvitados: e.target.value
                  .split(";")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
          <span className="text-xs text-[var(--color-texto-2)]">
            Estes assuntos ficam bloqueados na síntese e no relatório.
          </span>
        </label>
      </section>

      {/* ---- Autorizações ---- */}
      <section className="cartao space-y-3">
        <p className="rotulo">Autorizações, por finalidade</p>
        <p className="text-sm text-[var(--color-texto-2)]">
          Um &quot;sim&quot; genérico não autoriza todo uso de dados. Cada
          finalidade é decidida separadamente, e pode ser revogada.
        </p>
        <ul className="space-y-2">
          {FINALIDADES.map((f) => {
            const c = pessoa.consentimentos.find(
              (x) => x.finalidade === f.valor,
            );
            return (
              <li key={f.valor} className="space-y-1">
                <button
                  className={`btn btn-pequeno w-full justify-start text-left ${
                    c?.aceito ? "btn-principal" : ""
                  }`}
                  onClick={() => alternarConsentimento(f.valor)}
                >
                  {c?.aceito ? "✓" : "○"} {f.rotulo}
                </button>
                <p className="pl-1 text-xs leading-relaxed text-[var(--color-texto-2)]">
                  {f.texto}
                  {c && (
                    <>
                      {" "}
                      <em>
                        ({c.aceito ? "aceito" : "não aceito"} em{" "}
                        {new Date(c.decididoEm).toLocaleString("pt-BR")})
                      </em>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- Anamneses ---- */}
      <section className="space-y-3">
        <h2 className="rotulo">Fichas</h2>

        <Link
          href={`/pessoas/${pessoa.id}/anamnese/BASE`}
          className="cartao-link flex items-center justify-between gap-3"
        >
          <span>
            <span className="block font-medium">{FICHA_BASE.titulo}</span>
            <span className="text-xs text-[var(--color-texto-2)]">
              {fichaBase
                ? `${Object.keys(fichaBase.respostas).length} campo(s) preenchido(s)`
                : "não preenchida"}
            </span>
          </span>
          <span className="text-[var(--color-texto-2)]">›</span>
        </Link>

        {modulosSugeridos.length > 0 && (
          <p className="text-xs text-[var(--color-texto-2)]">
            Sugestão a partir do motivo principal:{" "}
            {modulosSugeridos
              .map((m) => acharFormulario(m)?.titulo ?? m)
              .join(", ")}
            . Comece com até dois módulos por sessão.
          </p>
        )}

        <details className="cartao">
          <summary className="cursor-pointer text-sm font-medium">
            Módulos por motivo de procura ({MODULOS.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {MODULOS.map((m) => {
              const preenchida = anamneses.find(
                (a) => a.formularioId === m.id,
              );
              const sugerido = modulosSugeridos.includes(m.id);
              return (
                <li key={m.id}>
                  <Link
                    href={`/pessoas/${pessoa.id}/anamnese/${m.id}`}
                    className="linha-link items-start justify-between border-b border-[var(--color-borda)]/60"
                  >
                    <span>
                      <span className="block text-sm">
                        <span className="font-mono text-xs text-[var(--color-texto-2)]">
                          {m.id}
                        </span>{" "}
                        {m.titulo}
                        {sugerido && (
                          <span className="ml-2 text-xs text-[var(--color-acento)]">
                            sugerido
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-[var(--color-texto-2)]">
                        {preenchida
                          ? `${Object.keys(preenchida.respostas).length} campo(s)`
                          : m.resumo}
                      </span>
                    </span>
                    <span className="text-[var(--color-texto-2)]">›</span>
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href={`/pessoas/${pessoa.id}/anamnese/RETORNO`}
                className="linha-link justify-between text-sm"
              >
                Retorno (R01–R08)
                <span className="text-[var(--color-texto-2)]">›</span>
              </Link>
            </li>
            <li>
              <Link
                href={`/pessoas/${pessoa.id}/anamnese/EXT_ANIMAL_PLANTA`}
                className="linha-link justify-between text-sm"
              >
                Extensão: animal, planta ou terreno
                <span className="text-[var(--color-texto-2)]">›</span>
              </Link>
            </li>
          </ul>
        </details>
      </section>

      {/* ---- Sessões ---- */}
      <section className="space-y-3">
        <h2 className="rotulo">Sessões</h2>
        <div className="cartao space-y-3">
          <input
            className="campo"
            placeholder="Tema desta sessão"
            value={tema}
            onChange={(e) => setTema(e.target.value)}
          />
          <button
            className="btn btn-principal w-full"
            onClick={iniciarSessao}
            disabled={!fichaBase || !consentimentoRegistro}
          >
            Iniciar sessão
          </button>
          {!fichaBase && (
            <p className="text-xs text-[var(--color-cuidado)]">
              Preencha a ficha inicial antes de iniciar. Sem contexto, não há o
              que cruzar.
            </p>
          )}
          {!consentimentoRegistro && (
            <p className="text-xs text-[var(--color-cuidado)]">
              Registre a autorização de registro da sessão.
            </p>
          )}
        </div>

        {sessoes.length > 0 && (
          <ul className="space-y-2">
            {sessoes.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sessao/${s.id}`}
                  className="cartao-link flex items-center justify-between gap-3"
                >
                  <span>
                    <span className="block text-sm font-medium">{s.tema}</span>
                    <span className="text-xs text-[var(--color-texto-2)]">
                      {new Date(s.iniciadaEm).toLocaleString("pt-BR")} ·{" "}
                      {s.status}
                    </span>
                  </span>
                  <span className="text-[var(--color-texto-2)]">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Exclusão ---- */}
      <section className="cartao space-y-2">
        <p className="rotulo">Direito de exclusão</p>
        <p className="text-sm text-[var(--color-texto-2)]">
          Apaga a pessoa, as fichas, as sessões, as leituras e os relatórios
          deste aparelho. Não há como desfazer.
        </p>
        <button
          className="btn w-full border-[var(--color-alerta)]/50 text-[var(--color-alerta)]"
          onClick={async () => {
            const certeza = window.confirm(
              `Apagar ${pessoa.nomePreferencia} e todo o histórico? Isso não pode ser desfeito.`,
            );
            if (!certeza) return;
            await apagarPessoa(pessoa.id);
            router.push("/");
          }}
        >
          Apagar esta pessoa e todo o histórico
        </button>
      </section>
    </div>
  );
}
