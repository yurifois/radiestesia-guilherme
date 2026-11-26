"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import CampoPergunta from "@/components/CampoPergunta";
import { acharFormulario } from "@/data/formularios";
import {
  agora,
  lerPessoa,
  listarAnamnesesDaPessoa,
  novoId,
  salvarAnamnese,
  salvarPessoa,
} from "@/lib/db";
import { detectarBandeiras, TEXTO_BANDEIRA, ENCAMINHAMENTO } from "@/lib/motor";
import type {
  AnamneseRespondida,
  IdFormulario,
  Pessoa,
  Resposta,
} from "@/lib/tipos";

export default function PaginaAnamnese() {
  const { id, formulario } = useParams<{ id: string; formulario: string }>();
  const router = useRouter();

  const formDef = acharFormulario(formulario);
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [anamnese, setAnamnese] = useState<AnamneseRespondida | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const p = await lerPessoa(id);
    setPessoa(p ?? null);
    if (!p || !formDef) return;
    const existentes = await listarAnamnesesDaPessoa(id);
    const achada = existentes.find((a) => a.formularioId === formDef.id);
    setAnamnese(
      achada ?? {
        id: novoId("ANA"),
        pessoaId: id,
        formularioId: formDef.id,
        formularioVersao: formDef.versao,
        respostas: {},
        criadoEm: agora(),
        atualizadoEm: agora(),
        revisoes: [],
      },
    );
  }, [id, formDef]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function responder(r: Resposta) {
    if (!anamnese) return;
    const atualizada: AnamneseRespondida = {
      ...anamnese,
      respostas: { ...anamnese.respostas, [r.perguntaId]: r },
      atualizadoEm: agora(),
    };
    setAnamnese(atualizada);
    setSalvando(true);
    await salvarAnamnese(atualizada);
    setSalvando(false);
    setSalvoEm(new Date().toLocaleTimeString("pt-BR"));

    // B02/B03/B14/B15 alimentam o cadastro da pessoa.
    if (formDef?.id === "BASE" && pessoa) {
      const mudanca: Partial<Pessoa> = {};
      if (r.perguntaId === "B02" && typeof r.valor === "string") {
        mudanca.temaPrincipal = r.valor;
      }
      if (r.perguntaId === "B03" && Array.isArray(r.valor)) {
        mudanca.temasSecundarios = r.valor as string[];
      }
      if (r.perguntaId === "B14" && typeof r.valor === "string") {
        mudanca.preferenciaLinguagem =
          r.valor as Pessoa["preferenciaLinguagem"];
      }
      if (r.perguntaId === "B15" && typeof r.valor === "string") {
        mudanca.assuntosEvitados = r.valor
          .split(/[;\n]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (Object.keys(mudanca).length > 0) {
        const novo = { ...pessoa, ...mudanca, atualizadoEm: agora() };
        setPessoa(novo);
        await salvarPessoa(novo);
      }
    }
  }

  if (!formDef) {
    return (
      <div className="space-y-3">
        <p className="text-sm">Formulário desconhecido.</p>
        <Link href={`/pessoas/${id}`} className="btn">
          Voltar
        </Link>
      </div>
    );
  }
  if (!pessoa || !anamnese) {
    return <p className="text-sm text-[var(--color-texto-2)]">Carregando…</p>;
  }

  const bandeiras = detectarBandeiras([anamnese]);
  const preenchidas = Object.keys(anamnese.respostas).length;
  const total = formDef.blocos.reduce((s, b) => s + b.perguntas.length, 0);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href={`/pessoas/${id}`}
          className="text-sm text-[var(--color-texto-2)] hover:text-[var(--color-texto)]"
        >
          ‹ {pessoa.nomePreferencia}
        </Link>
        <h1 className="text-xl font-semibold">{formDef.titulo}</h1>
        <p className="text-sm leading-relaxed text-[var(--color-texto-2)]">
          {formDef.resumo}
        </p>
        <p className="text-xs text-[var(--color-texto-2)]">
          {preenchidas} de {total} campos ·{" "}
          {salvando ? "salvando…" : salvoEm ? `salvo às ${salvoEm}` : "salva automaticamente"}
        </p>
      </header>

      {formDef.id !== "BASE" && (
        <div className="cartao space-y-2 text-sm">
          <p className="rotulo">Limite de interpretação deste módulo</p>
          <p className="leading-relaxed text-[var(--color-texto-2)]">
            {formDef.limiteInterpretacao}
          </p>
          {formDef.exemploCruzamento && (
            <>
              <p className="rotulo pt-2">Exemplo de cruzamento</p>
              <p className="leading-relaxed text-[var(--color-texto-2)]">
                {formDef.exemploCruzamento}
              </p>
            </>
          )}
        </div>
      )}

      {bandeiras.length > 0 && (
        <div className="space-y-2 rounded-xl border border-[var(--color-cuidado)]/50 bg-[var(--color-cuidado)]/10 p-4">
          <p className="rotulo">Encaminhamento acionado por regra</p>
          {bandeiras.map((b) => (
            <div key={`${b.tipo}-${b.respostaId}`} className="space-y-1 text-sm">
              <p className="font-medium">{TEXTO_BANDEIRA[b.tipo]}</p>
              <p className="text-xs text-[var(--color-texto-2)]">
                Em {b.respostaId}: {b.trecho}
              </p>
              <p className="leading-relaxed">{ENCAMINHAMENTO[b.tipo]}</p>
            </div>
          ))}
        </div>
      )}

      {formDef.blocos.map((bloco) => (
        <section key={bloco.titulo} className="space-y-4">
          <h2 className="rotulo">{bloco.titulo}</h2>
          {bloco.perguntas.map((p) => (
            <CampoPergunta
              key={p.id}
              pergunta={p}
              resposta={anamnese.respostas[p.id]}
              onMudar={responder}
            />
          ))}
        </section>
      ))}

      <div className="cartao space-y-2 text-sm">
        <p className="rotulo">O que o aplicativo organiza daqui</p>
        <p className="text-[var(--color-texto-2)]">{formDef.organiza}</p>
      </div>

      <button
        className="btn btn-principal w-full"
        onClick={() => router.push(`/pessoas/${id}`)}
      >
        Concluir e voltar
      </button>
    </div>
  );
}
