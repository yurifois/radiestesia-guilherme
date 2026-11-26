"use client";

/**
 * Um campo de anamnese.
 *
 * Tres regras do dossie (p. 9) que a interface tem de sustentar:
 *  - toda pergunta admite "nao se aplica", "nao sei" e "prefiro nao responder";
 *  - ausencia de resposta nunca e convertida em "nao";
 *  - a origem da resposta e registrada (pessoa, ditado, observacao, documento).
 */
import { AUSENCIAS, ORIGENS } from "@/lib/tipos";
import type { AusenciaResposta, OrigemResposta, Pergunta, Resposta } from "@/lib/tipos";

interface Props {
  pergunta: Pergunta;
  resposta?: Resposta;
  onMudar: (r: Resposta) => void;
}

export default function CampoPergunta({ pergunta, resposta, onMudar }: Props) {
  const agora = () => new Date().toISOString();
  const origem: OrigemResposta = resposta?.origem ?? "pessoa";

  function definirValor(valor: string | string[] | number | undefined) {
    onMudar({
      perguntaId: pergunta.id,
      valor,
      ausencia: undefined,
      origem,
      unidade: pergunta.unidade,
      atualizadoEm: agora(),
    });
  }

  function definirAusencia(a: AusenciaResposta) {
    onMudar({
      perguntaId: pergunta.id,
      valor: undefined,
      ausencia: resposta?.ausencia === a ? undefined : a,
      origem,
      atualizadoEm: agora(),
    });
  }

  function definirOrigem(o: OrigemResposta) {
    onMudar({
      perguntaId: pergunta.id,
      valor: resposta?.valor,
      ausencia: resposta?.ausencia,
      origem: o,
      unidade: resposta?.unidade ?? pergunta.unidade,
      atualizadoEm: agora(),
    });
  }

  const marcadoAusente = Boolean(resposta?.ausencia);
  const multiplos = Array.isArray(resposta?.valor)
    ? (resposta!.valor as string[])
    : [];

  return (
    <div className="space-y-2 border-b border-[var(--color-borda)]/60 pb-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 font-mono text-xs text-[var(--color-texto-2)]">
          {pergunta.id}
        </span>
        <div className="flex-1">
          <label className="block text-[0.95rem] leading-snug">
            {pergunta.texto}
            {pergunta.opcional && (
              <span className="ml-1 text-xs text-[var(--color-texto-2)]">
                (opcional)
              </span>
            )}
          </label>
          {pergunta.ajuda && (
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-texto-2)]">
              {pergunta.ajuda}
            </p>
          )}
        </div>
      </div>

      {!marcadoAusente && (
        <div className="pl-0 sm:pl-10">
          {pergunta.tipo === "T" && (
            <textarea
              className="campo"
              rows={3}
              value={typeof resposta?.valor === "string" ? resposta.valor : ""}
              onChange={(e) => definirValor(e.target.value)}
            />
          )}

          {pergunta.tipo === "D" && (
            <input
              type="text"
              className="campo"
              placeholder="Ex.: desde março, há 2 anos, em 30 dias"
              value={typeof resposta?.valor === "string" ? resposta.valor : ""}
              onChange={(e) => definirValor(e.target.value)}
            />
          )}

          {pergunta.tipo === "N" && (
            <div className="flex gap-2">
              <input
                type="number"
                className="campo"
                value={typeof resposta?.valor === "number" ? resposta.valor : ""}
                onChange={(e) =>
                  definirValor(
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
              />
              {pergunta.unidade && (
                <span className="self-center text-sm text-[var(--color-texto-2)]">
                  {pergunta.unidade}
                </span>
              )}
            </div>
          )}

          {pergunta.tipo === "E" && (
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={typeof resposta?.valor === "number" ? resposta.valor : 5}
                onChange={(e) => definirValor(Number(e.target.value))}
                className="w-full accent-[var(--color-acento)]"
              />
              <div className="flex justify-between text-xs text-[var(--color-texto-2)]">
                <span>{pergunta.ancoras?.min ?? "0"}</span>
                <span className="font-mono text-[var(--color-texto)]">
                  {typeof resposta?.valor === "number" ? resposta.valor : "—"}
                </span>
                <span>{pergunta.ancoras?.max ?? "10"}</span>
              </div>
            </div>
          )}

          {pergunta.tipo === "U" && (
            <div className="flex flex-wrap gap-2">
              {(pergunta.opcoes ?? []).map((o) => {
                const ativo = resposta?.valor === o.valor;
                return (
                  <button
                    key={o.valor}
                    type="button"
                    onClick={() => definirValor(ativo ? undefined : o.valor)}
                    className={`btn btn-pequeno ${
                      ativo ? "btn-principal" : ""
                    }`}
                  >
                    {o.rotulo}
                    {o.bandeira && !ativo && (
                      <span
                        className="text-[var(--color-cuidado)]"
                        title="Esta resposta aciona encaminhamento profissional"
                      >
                        ·
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {pergunta.tipo === "M" && (
            <div className="flex flex-wrap gap-2">
              {(pergunta.opcoes ?? []).map((o) => {
                const ativo = multiplos.includes(o.valor);
                return (
                  <button
                    key={o.valor}
                    type="button"
                    onClick={() =>
                      definirValor(
                        ativo
                          ? multiplos.filter((v) => v !== o.valor)
                          : [...multiplos, o.valor],
                      )
                    }
                    className={`btn btn-pequeno ${
                      ativo ? "btn-principal" : ""
                    }`}
                  >
                    {o.rotulo}
                  </button>
                );
              })}
            </div>
          )}

          {pergunta.tipo === "ANEXO" && (
            <p className="text-sm text-[var(--color-texto-2)]">
              Anexos não são guardados neste aplicativo. Registre em texto o que
              for pertinente.
            </p>
          )}
        </div>
      )}

      {/* Ausência de resposta e origem */}
      <div className="flex flex-wrap items-center gap-1.5 pl-0 text-xs sm:pl-10">
        {AUSENCIAS.map((a) => (
          <button
            key={a.valor}
            type="button"
            onClick={() => definirAusencia(a.valor)}
            className={`rounded-md border px-2 py-1 ${
              resposta?.ausencia === a.valor
                ? "border-[var(--color-acento)] bg-[var(--color-acento)]/15 text-[var(--color-acento-forte)]"
                : "border-[var(--color-borda)] text-[var(--color-texto-2)]"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
        <select
          className="ml-auto rounded-md border border-[var(--color-borda)] bg-[var(--color-superficie-2)] px-2 py-1 text-[var(--color-texto-2)]"
          value={origem}
          onChange={(e) => definirOrigem(e.target.value as OrigemResposta)}
          aria-label="Origem da resposta"
        >
          {ORIGENS.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
