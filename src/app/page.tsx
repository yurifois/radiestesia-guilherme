"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  agora,
  lerNomeTerapeuta,
  listarPessoas,
  novoId,
  salvarPessoa,
} from "@/lib/db";
import { rotuloDoTema } from "@/data/formularios";
import type { Pessoa } from "@/lib/tipos";

export default function Inicio() {
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [nome, setNome] = useState("");
  const [terapeuta, setTerapeuta] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setTerapeuta(lerNomeTerapeuta());
    listarPessoas()
      .then(setPessoas)
      .catch(() => setErro("Não foi possível abrir o banco local."));
  }, []);

  async function criar() {
    const limpo = nome.trim();
    if (!limpo) return;
    const p: Pessoa = {
      id: novoId("PES"),
      nomePreferencia: limpo,
      consentimentos: [],
      criadoEm: agora(),
      atualizadoEm: agora(),
    };
    await salvarPessoa(p);
    setNome("");
    setPessoas(await listarPessoas());
  }

  return (
    <div className="space-y-6">
      <section className="cartao space-y-2 text-sm leading-relaxed">
        <p className="rotulo">Antes de começar</p>
        <p>
          Este sistema registra informações fornecidas pela pessoa atendida e
          observações de uma sessão de radiestesia. As interpretações são
          simbólicas e passam por revisão do terapeuta. Não são diagnóstico,
          prescrição ou previsão.
        </p>
        <p className="text-[var(--color-texto-2)]">
          A pessoa pode não responder a temas opcionais e pedir informações
          sobre o uso dos seus dados. Tudo fica guardado apenas neste aparelho:
          se você limpar os dados do navegador, tudo se perde. Faça backup em{" "}
          <Link href="/ajustes" className="underline">
            Ajustes
          </Link>
          .
        </p>
      </section>

      {!terapeuta && (
        <section className="cartao space-y-2">
          <p className="rotulo">Quem atende</p>
          <p className="text-sm text-[var(--color-texto-2)]">
            Seu nome assina os relatórios. Defina em{" "}
            <Link href="/ajustes" className="underline">
              Ajustes
            </Link>
            .
          </p>
        </section>
      )}

      <section className="space-y-3">
        <h1 className="text-lg font-semibold">Pessoas atendidas</h1>
        <div className="flex gap-2">
          <input
            className="campo"
            placeholder="Como a pessoa prefere ser chamada"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && criar()}
          />
          <button className="btn btn-principal" onClick={criar}>
            Criar
          </button>
        </div>
        <p className="text-xs text-[var(--color-texto-2)]">
          Nome de preferência, não nome civil completo. Sem CPF, endereço ou
          documentos.
        </p>

        {erro && <p className="text-sm text-[var(--color-alerta)]">{erro}</p>}

        {pessoas === null ? (
          <p className="text-sm text-[var(--color-texto-2)]">Carregando…</p>
        ) : pessoas.length === 0 ? (
          <p className="text-sm text-[var(--color-texto-2)]">
            Nenhuma pessoa cadastrada ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {pessoas.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/pessoas/${p.id}`}
                  className="cartao flex items-center justify-between gap-3 hover:border-[var(--color-acento)]"
                >
                  <span>
                    <span className="block font-medium">
                      {p.nomePreferencia}
                    </span>
                    <span className="text-xs text-[var(--color-texto-2)]">
                      {p.temaPrincipal
                        ? `tema: ${rotuloDoTema(p.temaPrincipal)}`
                        : "sem tema definido"}
                    </span>
                  </span>
                  <span className="text-[var(--color-texto-2)]">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
