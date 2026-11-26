# Notas para quem mexer neste código

Next.js 16 (App Router) + React 19 + TypeScript estrito + Tailwind v4.
Tudo em português, inclusive nomes de tipos, funções e arquivos.

## Regras que não se negociam

1. **Nenhum dado de pessoa sai do aparelho sem consentimento explícito.**
   O payload de IA leva `respostaId`, texto da pergunta, trecho e tags — nunca
   nome, contato ou identificador civil. O PDF é montado no cliente.

2. **A palavra "diagnóstico" não aparece na saída.** Nem "laudo",
   "prescrição", "cura" ou "tratamento médico". A lista completa está em
   `PROIBICOES`, em `src/lib/prompts.ts`.

3. **Encaminhamento é determinístico.** Nasce de `detectarBandeiras` +
   `ENCAMINHAMENTO` em `src/lib/motor.ts`, a partir de metadados das opções da
   ficha. A rota `/api/gemini/redacao` sobrescreve o campo
   `redacao.encaminhamento` com o texto das regras antes de devolver. Se for
   preciso mudar um encaminhamento, muda-se a regra — nunca o prompt.

4. **A IA não escolhe setor de lâmina.** O setor vem da geometria
   (`mapearParaZona`) ou do toque do terapeuta. A anamnese nunca entra nessa
   decisão: ela só é cruzada depois, como hipótese.

5. **Abstenção antes de palpite.** `analisarJanela` devolve
   `MotivoAbstencao[]`. Enquanto houver um motivo, a leitura não pode ser
   confirmada. Não afrouxe os limiares de `LIMIARES` sem motivo medido.

6. **Desenho e leitura vêm da mesma fonte.** `LaminaSvg` renderiza a partir das
   zonas declaradas em `src/data/laminas.ts`, as mesmas que o mapeamento usa.
   Não acrescente arte solta: acrescente geometria.

7. **Nada de lâmina copiada.** Todo desenho é original, gerado da geometria.
   O dossiê registra obras de terceiros sob CC BY-NC; o catálogo só guarda
   nomes como título, nunca a arte.

8. **Chaves só em `.env.local`.** Nunca em `.env.example`, nunca em commit,
   nunca no cliente. `src/lib/ia-servidor.ts` tem `import "server-only"`.

## Mapa do código

| Arquivo | O que é |
|---|---|
| `src/lib/tipos.ts` | modelo de domínio inteiro |
| `src/lib/schemas.ts` | Zod nas fronteiras de `/api` |
| `src/lib/db.ts` | IndexedDB (6 stores), backup, apagar pessoa |
| `src/lib/pendulo.ts` | rastreio, limiares, mapeamento zona |
| `src/lib/motor.ts` | regras, bandeiras, encaminhamentos, síntese |
| `src/lib/prompts.ts` | instrução base e proibições |
| `src/lib/ia-servidor.ts` | chamadas a OpenRouter e Gemini |
| `src/lib/pdf.ts` | jsPDF, nome do arquivo, layout |
| `src/data/laminas.ts` | 18 lâminas + 4 gráficos radiônicos |
| `src/data/formularios.ts` | ficha base, M01–M12, retorno, animal/planta |

## Versões

`VERSAO_REGRAS` em `src/lib/motor.ts` sobe sempre que uma regra de bandeira,
encaminhamento ou cruzamento muda. Ela é gravada em cada síntese e sai no PDF,
em "Como este documento foi feito".

## Antes de abrir PR

```bash
npm run typecheck
npm run build
```

A sessão guarda a síntese no IndexedDB e a recarrega ao abrir a página: se
mexer em `salvarSintese` ou no `carregar` da página de sessão, confira que
recarregar a sessão encerrada ainda mostra a síntese e permite gerar o PDF de
novo.
