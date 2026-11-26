"use client";

import { useEffect, useRef, useState } from "react";
import {
  exportarTudo,
  importarTudo,
  lerNomeTerapeuta,
  salvarNomeTerapeuta,
  type Backup,
} from "@/lib/db";
import { LIMIARES } from "@/lib/pendulo";

export default function Ajustes() {
  const [nome, setNome] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => setNome(lerNomeTerapeuta()), []);

  async function exportar() {
    const b = await exportarTudo();
    const blob = new Blob([JSON.stringify(b, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    a.href = url;
    a.download = `radiestesia-backup_${d.toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setAviso(
      `Backup gerado com ${b.pessoas.length} pessoa(s) e ${b.sessoes.length} sessão(ões).`,
    );
  }

  async function importar(f: File) {
    try {
      const texto = await f.text();
      const r = await importarTudo(JSON.parse(texto) as Backup);
      setAviso(`Importados ${r.gravados} registro(s). Recarregue as telas.`);
    } catch (e) {
      setAviso(
        e instanceof Error ? e.message : "Não foi possível ler o arquivo.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Ajustes</h1>

      <section className="cartao space-y-3">
        <p className="rotulo">Quem atende</p>
        <input
          className="campo"
          placeholder="Seu nome, como aparece no relatório"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setSalvo(false);
          }}
        />
        <button
          className="btn btn-principal"
          onClick={() => {
            salvarNomeTerapeuta(nome.trim());
            setSalvo(true);
          }}
        >
          {salvo ? "Salvo" : "Salvar"}
        </button>
        <p className="text-xs text-[var(--color-texto-2)]">
          Este cadastro é do profissional. Não é uma anamnese: você não
          preenche ficha sobre si.
        </p>
      </section>

      <section className="cartao space-y-3">
        <p className="rotulo">Backup</p>
        <p className="text-sm text-[var(--color-texto-2)]">
          Tudo é guardado só neste aparelho. Exporte com frequência: limpar os
          dados do navegador apaga pessoas, anamneses, sessões e relatórios.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-principal" onClick={exportar}>
            Exportar backup
          </button>
          <button
            className="btn"
            onClick={() => arquivoRef.current?.click()}
          >
            Importar backup
          </button>
          <input
            ref={arquivoRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importar(f);
              e.target.value = "";
            }}
          />
        </div>
        {aviso && <p className="text-sm">{aviso}</p>}
      </section>

      <section className="cartao space-y-2">
        <p className="rotulo">Limiares da câmera</p>
        <p className="text-sm text-[var(--color-texto-2)]">
          São provisórios. Precisam ser calibrados com vídeos reais das lâminas
          que você usa, e não valem como números universais. Enquanto não
          houver essa calibração, o app se abstém com facilidade — de
          propósito.
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {Object.entries(LIMIARES).map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between gap-2 border-b border-[var(--color-borda)]/60 py-1"
            >
              <dt className="text-[var(--color-texto-2)]">{k}</dt>
              <dd className="font-mono">{String(v)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="cartao space-y-2 text-sm leading-relaxed">
        <p className="rotulo">O que este app não faz</p>
        <ul className="space-y-1 text-[var(--color-texto-2)]">
          <li>• Não diagnostica, não descarta e não nomeia doença.</li>
          <li>• Não prescreve nada, nem altera tratamento em curso.</li>
          <li>• Não prevê acontecimento, contrato, ganho ou prazo.</li>
          <li>• Não lê intenção de terceiros.</li>
          <li>
            • Não atesta potabilidade, elétrica, estrutura, gás ou exposição
            ambiental.
          </li>
          <li>
            • Não converte escala Bovis ou percentual em estado de saúde ou
            probabilidade.
          </li>
          <li>
            • Não escolhe o setor que combina melhor com a ficha para a resposta
            parecer certa.
          </li>
        </ul>
      </section>
    </div>
  );
}
