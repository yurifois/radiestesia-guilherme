# Radiestesia — registro de sessões

Aplicativo web (mobile-first) para o Guilherme conduzir sessões de radiestesia:
ficha de anamnese, catálogo de lâminas, acompanhamento do pêndulo pela câmera,
cruzamento com o que a pessoa contou e entrega em PDF, na voz dele.

Nada é diagnóstico. Toda saída é **síntese simbólica para revisão** — o texto
só vira PDF depois que o terapeuta aprova, e a aprovação fica registrada com
autor, horário e número de versão.

---

## O que o app faz

1. **Cadastro da pessoa** — nome de preferência, sem CPF, endereço ou documentos.
2. **Consentimentos por finalidade** — registro da sessão, captura de vídeo,
   envio a fornecedor de IA e guarda do histórico são quatro autorizações
   separadas. Cada recurso só liga se a sua estiver registrada.
3. **Anamnese** — ficha base (B01–B20) mais doze módulos temáticos (M01–M12),
   ficha de retorno (R01–R08) e extensão para animal/planta (E01–E10). Toda
   pergunta aceita "prefiro não responder", "não sei" e "não se aplica".
4. **Lâminas** — 18 lâminas de leitura (L01–L16) desenhadas em SVG a partir da
   geometria declarada, mais 4 gráficos radiônicos que são de trabalho e nunca
   são lidos. O desenho e o mapa de leitura saem da mesma fonte, então não há
   como divergirem.
5. **Pendulação** — a câmera traseira acompanha o pêndulo e mede eixo de
   oscilação, sentido de giro e estabilidade. O registro manual pelo toque na
   lâmina é o caminho principal; a câmera é apoio.
6. **Síntese** — primeiro pelas regras (determinística, sem IA), depois, se
   autorizado, a camada Jev + Gemini.
7. **Entrega** — PDF gerado no próprio aparelho, nomeado
   `Nome-Da-Pessoa_AAAA-MM-DD_HHhMM.pdf`.

## Onde ficam os dados

**No aparelho, só.** IndexedDB, sem backend de dados, sem login. Limpar os
dados do navegador apaga tudo. Em *Ajustes* há exportação e importação de
backup em JSON — é a única cópia que existe.

As rotas `/api/*` são de passagem: recebem um pedido já desidentificado,
chamam o fornecedor e devolvem. Não gravam nada.

## A abstenção

O rastreio devolve motivos de abstenção em vez de chutar um setor. Se o eixo
cai na fronteira entre dois setores, se a imagem está sem nitidez, se o
movimento está instável, se faltam quadros ou se a convenção da sessão não foi
registrada, o botão "Confirmar esta leitura" fica desligado e a leitura só pode
ser gravada como inconclusiva.

Uma oscilação define um eixo com dois sentidos. Em leque de 180° só um cai
sobre a prancha, e a geometria resolve. Em círculo de 360° os dois caem: o app
devolve as duas zonas candidatas e não escolhe — quem escolhe é a convenção da
sessão.

## Jev e Gemini

| Camada | Modelo | Papel |
|---|---|---|
| Orquestração | `typesafe/jev-router` (OpenRouter) | decide, em JSON tipado, o que se sustenta: status, hipótese, vínculos, lacunas, perguntas de confirmação |
| Redação | `gemini-2.5-flash` | escreve o texto humano do PDF, na voz do Guilherme |
| Visão | `gemini-2.5-flash` | identifica a lâmina a partir de uma foto, uma vez |

Controles que ficam **fora do prompt**, no servidor:

- vínculo que cita `respostaId` ou `eventoId` que não existe é descartado; se
  não sobrar nenhum, o status cai para `inconclusivo`;
- `proximaLaminaId` fora do catálogo vira `null`;
- o encaminhamento do PDF é **sempre** o texto determinístico. O modelo não
  cria, não reescreve e não remove encaminhamento;
- confiança `baixa` ou `nenhuma` na visão devolve `laminaId: null`.

O payload enviado é desidentificado: `respostaId`, texto da pergunta, trecho e
tags. Nunca nome, nunca contato.

## Rodar local

```bash
npm install
cp .env.example .env.local   # e preencha as chaves
npm run dev
```

A câmera exige HTTPS fora de `localhost`. No celular, use a URL da Vercel.

### Variáveis

| Variável | Para quê |
|---|---|
| `OPENROUTER_API_KEY` | chamada ao Jev |
| `OPENROUTER_JEV_MODEL` | padrão `typesafe/jev-router` |
| `GEMINI_API_KEY` | redação e visão |
| `GEMINI_MODEL` | padrão `gemini-2.5-flash` |
| `IA_DESABILITADA` | `true` desliga a camada de IA e mantém só as regras |

Sem chaves o app continua inteiro: a síntese pelas regras, o PDF e todo o
registro funcionam offline.

## Scripts

```bash
npm run dev        # servidor de desenvolvimento
npm run build      # build de produção
npm run typecheck  # tsc --noEmit
```

## O que este app não faz

Não diagnostica, não prescreve, não indica substância, dosagem ou cristal, não
mede energia, não prevê, não substitui cuidado de saúde, jurídico ou
veterinário. Encaminhamentos apontam para serviços reais (UBS, CAPS, CVV 188,
SAMU 192, Central 180, Direitos Humanos 100, clínicas-escola, veterinário,
agrônomo) e saem de regra, não de modelo.
