"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [busca, setBusca] = useState("");
  const [nome, setNome] = useState("");
  const [cadastrando, setCadastrando] = useState(false);
  const [terapeuta, setTerapeuta] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const campoNome = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTerapeuta(lerNomeTerapeuta());
    listarPessoas()
      .then(setPessoas)
      .catch(() => setErro("Não foi possível abrir o banco local."));
  }, []);

  useEffect(() => {
    if (cadastrando) campoNome.current?.focus();
  }, [cadastrando]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q || !pessoas) return pessoas ?? [];
    return pessoas.filter((p) => p.nomePreferencia.toLowerCase().includes(q));
  }, [pessoas, busca]);

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
    setCadastrando(false);
    setBusca("");
    setPessoas(await listarPessoas());
  }

  const temMuitas = (pessoas?.length ?? 0) > 3;

  return (
    <div className="space-y-5">
      {/* As duas tarefas da home: achar alguem e cadastrar alguem. */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Pessoas</h1>
        <button
          className="btn btn-principal btn-pequeno"
          onClick={() => setCadastrando((v) => !v)}
          aria-expanded={cadastrando}
        >
          {cadastrando ? "Cancelar" : "Nova pessoa"}
        </button>
      </div>

      {cadastrando && (
        <div className="cartao space-y-3">
          <label className="block space-y-1">
            <span className="rotulo">Como a pessoa prefere ser chamada</span>
            <input
              ref={campoNome}
              className="campo"
              placeholder="Primeiro nome ou apelido"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && criar()}
            />
          </label>
          <p className="text-xs leading-relaxed text-[var(--color-texto-2)]">
            Nome de preferência, não nome civil completo. Sem CPF, endereço ou
            documentos.
          </p>
          <button
            className="btn btn-principal w-full"
            onClick={criar}
            disabled={!nome.trim()}
          >
            Cadastrar
          </button>
          {!nome.trim() && (
            <p className="text-xs text-[var(--color-texto-2)]">
              Escreva um nome para cadastrar.
            </p>
          )}
        </div>
      )}

      {temMuitas && (
        <label className="block space-y-1">
          <span className="rotulo">Buscar por nome</span>
          <input
            className="campo"
            type="search"
            placeholder="Comece a digitar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
      )}

      {erro && <p className="aviso aviso-alerta">{erro}</p>}

      {pessoas === null ? (
        <p className="text-sm text-[var(--color-texto-2)]">Carregando…</p>
      ) : pessoas.length === 0 ? (
        <div className="cartao space-y-2">
          <p className="text-sm">Nenhuma pessoa cadastrada ainda.</p>
          <p className="text-sm text-[var(--color-texto-2)]">
            Toque em <strong>Nova pessoa</strong> para começar o primeiro
            cadastro.
          </p>
        </div>
      ) : filtradas.length === 0 ? (
        <p className="text-sm text-[var(--color-texto-2)]">
          Ninguém com esse nome. Apague a busca para ver todos.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtradas.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pessoas/${p.id}`}
                className="cartao-link flex items-center justify-between gap-3 py-3.5"
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
                <span aria-hidden className="text-[var(--color-texto-2)]">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!terapeuta && (
        <p className="aviso aviso-cuidado">
          Seu nome assina os relatórios e ainda não foi definido. Defina em{" "}
          <Link href="/ajustes" className="underline">
            Ajustes
          </Link>
          .
        </p>
      )}

      {/* O texto legal continua acessivel, mas nao disputa a tela com o trabalho. */}
      <details className="cartao">
        <summary className="cursor-pointer py-1.5 text-sm font-medium">
          Como este app trata os dados
        </summary>
        <div className="mt-2 space-y-2 text-sm leading-relaxed">
          <p>
            Este sistema registra informações fornecidas pela pessoa atendida e
            observações de uma sessão de radiestesia. As interpretações são
            simbólicas e passam por revisão do terapeuta. Não são diagnóstico,
            prescrição ou previsão.
          </p>
          <p className="text-[var(--color-texto-2)]">
            Guardar aqui não é o mesmo que nunca sair: a camada de IA é
            opcional, depende de autorização por pessoa, e envia só a pergunta
            da leitura e trechos da ficha — nunca nome nem contato.
          </p>
          <p className="text-[var(--color-texto-2)]">
            A pessoa pode não responder a temas opcionais e pedir informações
            sobre o uso dos seus dados. O cadastro fica guardado apenas neste
            aparelho: se você limpar os dados do navegador, tudo se perde. Faça
            backup em{" "}
            <Link href="/ajustes" className="underline">
              Ajustes
            </Link>
            .
          </p>
        </div>
      </details>
    </div>
  );
}
