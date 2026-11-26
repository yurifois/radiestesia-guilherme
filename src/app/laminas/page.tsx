"use client";

import { useState } from "react";
import LaminaSvg from "@/components/LaminaSvg";
import {
  GRAFICOS_RADIONICOS,
  LAMINAS_LEITURA,
  NOMES_PARA_CADASTRO,
} from "@/data/laminas";
import type { Lamina } from "@/lib/tipos";

export default function Laminas() {
  const [aberta, setAberta] = useState<string | null>(null);

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold">Lâminas</h1>
        <p className="text-sm leading-relaxed text-[var(--color-texto-2)]">
          Os desenhos abaixo são originais deste aplicativo, feitos a partir da
          geometria cadastrada. Não reproduzem prancha autoral de terceiros:
          acesso público e download gratuito não dão licença de uso em
          aplicativo. Para usar uma prancha de autor, cadastre-a com autor,
          licença, manual, versão e regra de leitura.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="rotulo">
          Lâminas de leitura ({LAMINAS_LEITURA.length})
        </h2>
        <div className="space-y-2">
          {LAMINAS_LEITURA.map((l) => (
            <Cartao
              key={l.id}
              lamina={l}
              aberta={aberta === l.id}
              onAlternar={() => setAberta(aberta === l.id ? null : l.id)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="rotulo">
          Gráficos de trabalho ({GRAFICOS_RADIONICOS.length})
        </h2>
        <p className="text-sm text-[var(--color-texto-2)]">
          Não são superfícies de leitura. O app registra uso, versão e intenção
          declarada, e não presume emissão física nem promete resultado.
        </p>
        <div className="space-y-2">
          {GRAFICOS_RADIONICOS.map((l) => (
            <Cartao
              key={l.id}
              lamina={l}
              aberta={aberta === l.id}
              onAlternar={() => setAberta(aberta === l.id ? null : l.id)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="rotulo">Nomes encontrados em catálogos</h2>
        <p className="text-sm leading-relaxed text-[var(--color-texto-2)]">
          Inventário de referência, sem esgotar o tema. Ficam aqui como
          títulos: um catálogo confirma que um gráfico existe e é
          comercializado, mas não fornece seu protocolo nem prova função. Cada
          um exige manual específico antes de ser interpretado.
        </p>
        {NOMES_PARA_CADASTRO.map((g) => (
          <div key={g.grupo} className="cartao space-y-2">
            <p className="text-sm font-medium">{g.grupo}</p>
            <p className="text-sm leading-relaxed text-[var(--color-texto-2)]">
              {g.nomes.join(" · ")}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}

function Cartao({
  lamina,
  aberta,
  onAlternar,
}: {
  lamina: Lamina;
  aberta: boolean;
  onAlternar: () => void;
}) {
  return (
    <div className="cartao space-y-3">
      <button
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={onAlternar}
      >
        <span>
          <span className="block font-medium">{lamina.nome}</span>
          <span className="text-xs text-[var(--color-texto-2)]">
            {lamina.tipo} · {lamina.modoLeitura.replace(/_/g, " ")} · v
            {lamina.versao}
            {lamina.unidade ? ` · ${lamina.unidade}` : ""}
          </span>
        </span>
        <span className="text-[var(--color-texto-2)]">{aberta ? "–" : "+"}</span>
      </button>

      {aberta && (
        <div className="space-y-3">
          <div className="rounded-lg border border-[var(--color-borda)] bg-[var(--color-fundo)] p-2">
            <LaminaSvg lamina={lamina} />
          </div>
          <div className="space-y-1 text-sm">
            <p className="rotulo">Manual</p>
            <p className="leading-relaxed text-[var(--color-texto-2)]">
              {lamina.manual}
            </p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="rotulo">Autor e licença</p>
            <p className="text-[var(--color-texto-2)]">
              {lamina.autorELicenca}
            </p>
          </div>
          {lamina.zonas.length > 0 && (
            <div className="space-y-1 text-sm">
              <p className="rotulo">Zonas ({lamina.zonas.length})</p>
              <ul className="space-y-1.5">
                {lamina.zonas.map((z) => (
                  <li
                    key={z.id}
                    className="border-b border-[var(--color-borda)]/50 pb-1.5"
                  >
                    <span className="font-medium">{z.rotulo}</span>{" "}
                    <span className="font-mono text-xs text-[var(--color-texto-2)]">
                      {z.id}
                    </span>
                    <p className="text-[var(--color-texto-2)]">
                      {z.significadoSimbolico}
                    </p>
                    <p className="text-xs text-[var(--color-texto-2)]">
                      Uso permitido: {z.usoPermitido}.
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
