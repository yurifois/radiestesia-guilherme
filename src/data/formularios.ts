/**
 * Ficha-base (B01-B20), 12 modulos (M01-M12), formulario de retorno (R01-R08)
 * e extensao opcional para animal/planta/terreno.
 *
 * As perguntas vem do dossie (p. 10-23). As tags, os tipos de resposta e as
 * bandeiras de encaminhamento foram adicionados aqui para alimentar o ranking
 * de laminas e o motor de cruzamento.
 *
 * Nenhum formulario tem pontuacao diagnostica. Dossie, p. 9:
 * "Estes sao roteiros originais de entrevista e cadastro, sem pontuacao
 *  diagnostica."
 */
import type { Formulario, Pergunta } from "@/lib/tipos";

/** Atalho para montar perguntas de texto livre. */
function t(id: string, texto: string, tags: string[] = [], opcional = false): Pergunta {
  return { id, texto, tipo: "T", tags, opcional };
}

// ===========================================================================
// Ficha-base
// ===========================================================================
export const FICHA_BASE: Formulario = {
  id: "BASE",
  versao: 1,
  titulo: "Ficha inicial de contexto",
  resumo:
    "Perguntas comuns a qualquer motivo de procura. Só B01, o tema principal, a finalidade e as autorizações são o núcleo inicial.",
  organiza: "Nome de preferência, tema, expectativa, recursos, limites e autorizações.",
  limiteInterpretacao:
    "A ficha registra o relato da pessoa. Nenhuma resposta vira diagnóstico, nem é usada para escolher o setor da lâmina.",
  tags: ["triagem"],
  blocos: [
    {
      titulo: "Identificação e tema",
      perguntas: [
        { id: "B01", texto: "Como prefere ser chamado(a)?", tipo: "T", tags: ["identificacao"], ajuda: "Nome de preferência. Não pedimos CPF, endereço completo nem documentos." },
        {
          id: "B02",
          texto: "Qual é o motivo principal da procura hoje?",
          tipo: "U",
          tags: ["motivo_principal"],
          opcoes: [
            { valor: "bem_estar", rotulo: "Bem-estar e vitalidade" },
            { valor: "emocoes", rotulo: "Emoções e estresse" },
            { valor: "saude_apoio", rotulo: "Saúde, como apoio complementar" },
            { valor: "autoconhecimento", rotulo: "Autoconhecimento e espiritualidade" },
            { valor: "carreira", rotulo: "Carreira e transição profissional" },
            { valor: "financas", rotulo: "Finanças e prosperidade" },
            { valor: "relacionamentos", rotulo: "Relacionamentos" },
            { valor: "sono", rotulo: "Sono e rotina" },
            { valor: "negocio", rotulo: "Negócio e lucro" },
            { valor: "objetivos", rotulo: "Meta pessoal ou estudos" },
            { valor: "transicao", rotulo: "Mudança, perda e recomeço" },
            { valor: "ambiente", rotulo: "Casa e ambiente de trabalho" },
            { valor: "curiosidade", rotulo: "Curiosidade ou indicação de alguém" },
            { valor: "nao_sei_explicar", rotulo: "Não sei explicar" },
          ],
          ajuda: "Curiosidade e \"não sei explicar\" são motivos legítimos.",
        },
        {
          id: "B03",
          texto: "Há outros assuntos que deseja incluir?",
          tipo: "M",
          tags: ["temas_secundarios"],
          opcional: true,
          opcoes: [
            { valor: "bem_estar", rotulo: "Bem-estar e vitalidade" },
            { valor: "emocoes", rotulo: "Emoções e estresse" },
            { valor: "saude_apoio", rotulo: "Saúde, como apoio complementar" },
            { valor: "autoconhecimento", rotulo: "Autoconhecimento e espiritualidade" },
            { valor: "carreira", rotulo: "Carreira" },
            { valor: "financas", rotulo: "Finanças" },
            { valor: "relacionamentos", rotulo: "Relacionamentos" },
            { valor: "sono", rotulo: "Sono e rotina" },
            { valor: "negocio", rotulo: "Negócio" },
            { valor: "objetivos", rotulo: "Objetivos e estudos" },
            { valor: "transicao", rotulo: "Transição e perdas" },
            { valor: "ambiente", rotulo: "Ambiente" },
          ],
          ajuda: "Comece com até dois módulos por sessão, para não cansar.",
        },
      ],
    },
    {
      titulo: "História da situação",
      perguntas: [
        t("B04", "O que aconteceu para procurar a sessão agora?", ["gatilho"]),
        { id: "B05", texto: "Desde quando essa situação acontece?", tipo: "D", tags: ["duracao"] },
        t("B06", "Em quais situações ela aparece ou se intensifica?", ["contexto"]),
        {
          id: "B07",
          texto: "Quanto isso afeta seu cotidiano?",
          tipo: "E",
          ancoras: { min: "0 = nada", max: "10 = muito" },
          tags: ["impacto"],
          ajuda: "É autorrelato com âncoras escritas. Não é escala Bovis nem percentual de bloqueio.",
        },
        t("B08", "Qual resultado concreto espera desta conversa ou sessão?", ["expectativa"]),
        t("B09", "O que já tentou e qual foi o resultado percebido?", ["tentativas"]),
        t("B10", "O que costuma ajudar e o que costuma piorar?", ["recursos", "agravantes"]),
      ],
    },
    {
      titulo: "Recursos e limites",
      perguntas: [
        t("B11", "Que recursos, pessoas ou serviços de apoio você tem?", ["apoio", "rede"]),
        {
          id: "B12",
          texto: "Há restrições de tempo, dinheiro, mobilidade ou privacidade?",
          tipo: "M",
          tags: ["restricao"],
          opcoes: [
            { valor: "tempo", rotulo: "Tempo" },
            { valor: "dinheiro", rotulo: "Dinheiro" },
            { valor: "mobilidade", rotulo: "Mobilidade" },
            { valor: "privacidade", rotulo: "Privacidade" },
            { valor: "nenhuma", rotulo: "Nenhuma que eu queira informar" },
          ],
        },
        t("B13", "Já participou de radiestesia? O que espera do método?", ["experiencia_previa"]),
        {
          id: "B14",
          texto: "Prefere linguagem espiritual, simbólica ou neutra?",
          tipo: "U",
          tags: ["linguagem"],
          opcoes: [
            { valor: "espiritual", rotulo: "Espiritual" },
            { valor: "simbolica", rotulo: "Simbólica" },
            { valor: "neutra", rotulo: "Neutra" },
          ],
          ajuda: "O relatório é escrito na linguagem que você escolher.",
        },
        t("B15", "Há assuntos ou práticas que não deseja abordar?", ["evitar"]),
      ],
    },
    {
      titulo: "Cuidado profissional",
      perguntas: [
        { id: "B16", texto: "Deseja informar cuidados profissionais em andamento?", tipo: "T", tags: ["acompanhamento"], opcional: true, ajuda: "Opcional. Serve para que o relatório respeite o que já está em curso." },
        {
          id: "B17",
          texto: "Existe algo que exige ajuda profissional antes desta sessão?",
          tipo: "U",
          tags: ["encaminhamento"],
          opcoes: [
            { valor: "nao", rotulo: "Não" },
            { valor: "sim", rotulo: "Sim", bandeira: "saude_sem_acompanhamento" },
            { valor: "nao_sei_dizer", rotulo: "Não sei dizer" },
          ],
        },
      ],
    },
    {
      titulo: "Revisão e autorizações",
      perguntas: [
        {
          id: "B18",
          texto: "Pode revisar as respostas registradas e corrigir algo?",
          tipo: "U",
          tags: ["revisao"],
          opcoes: [
            { valor: "revisei", rotulo: "Revisei e está correto" },
            { valor: "corrigi", rotulo: "Corrigi o que precisava" },
            { valor: "nao_revisei", rotulo: "Não revisei agora" },
          ],
        },
        {
          id: "B19",
          texto: "Compreendeu a finalidade e os limites do registro simbólico?",
          tipo: "U",
          tags: ["consentimento"],
          opcoes: [
            { valor: "sim", rotulo: "Sim, compreendi" },
            { valor: "quero_mais_explicacao", rotulo: "Quero mais explicação" },
          ],
          ajuda: "Interpretações são simbólicas e revisadas pelo terapeuta. Não são diagnóstico, prescrição ou previsão.",
        },
        {
          id: "B20",
          texto: "Quais usos de seus dados e mídias foram aceitos?",
          tipo: "M",
          tags: ["consentimento"],
          ajuda: "Registrado separadamente na tela de autorizações. Um \"sim\" genérico não autoriza todo uso de dados.",
        },
      ],
    },
  ],
};

// ===========================================================================
// M01 - Bem-estar e vitalidade
// ===========================================================================
const M01: Formulario = {
  id: "M01",
  versao: 1,
  titulo: "Bem-estar e vitalidade",
  resumo: "Módulo amplo para quem quer melhorar a experiência cotidiana e não chega com um tema único.",
  organiza: "Rotina, descanso, sobrecarga e disposição percebida.",
  exemploCruzamento:
    "Se a lâmina indicar \"descanso\", relacionar ao relato sobre pausas; se não houver esse relato, perguntar se o tema faz sentido.",
  limiteInterpretacao:
    "Não traduzir baixa disposição em falta de \"energia vital\" medida. Sintomas persistentes pertencem ao cuidado profissional adequado.",
  tags: ["bem_estar", "rotina", "descanso", "sobrecarga"],
  blocos: [
    {
      titulo: "Disposição e rotina",
      perguntas: [
        t("M01.01", "Como descreve sua disposição no dia a dia?", ["disposicao"]),
        {
          id: "M01.02",
          texto: "Em qual período costuma se sentir mais disposto(a) ou esgotado(a)?",
          tipo: "U",
          tags: ["rotina"],
          opcoes: [
            { valor: "manha", rotulo: "Manhã" },
            { valor: "tarde", rotulo: "Tarde" },
            { valor: "noite", rotulo: "Noite" },
            { valor: "varia", rotulo: "Varia muito" },
          ],
        },
        t("M01.03", "Quais atividades mais consomem seu tempo e sua energia percebida?", ["sobrecarga"]),
        {
          id: "M01.04",
          texto: "Quanto consegue descansar?",
          tipo: "E",
          ancoras: { min: "0 = nada", max: "10 = o suficiente para você" },
          tags: ["descanso"],
        },
        t("M01.05", "Como estão as pausas, o lazer e as atividades que lhe dão prazer?", ["pausa", "prazer"]),
      ],
    },
    {
      titulo: "Mudanças e recursos",
      perguntas: [
        t("M01.06", "Que mudanças recentes afetaram sua rotina?", ["mudanca"]),
        t("M01.07", "Que tarefas ou responsabilidades poderiam ser reorganizadas?", ["organizacao"]),
        t("M01.08", "O que costuma recuperar sua disposição?", ["recursos"]),
        t("M01.09", "Qual pequena mudança gostaria de experimentar por escolha própria?", ["acao", "curto"]),
        { id: "M01.10", texto: "Que sinal concreto de melhora observará até o retorno?", tipo: "T", tags: ["retorno", "medida_propria"] },
      ],
    },
  ],
};

// ===========================================================================
// M02 - Emocoes, estresse e sobrecarga
// ===========================================================================
const M02: Formulario = {
  id: "M02",
  versao: 1,
  titulo: "Emoções, estresse e sobrecarga",
  resumo: "Para explorar a experiência emocional com perguntas abertas; não é avaliação psicológica nem instrumento para diagnosticar transtornos.",
  organiza: "Sentimentos nomeados pela pessoa, situações, impacto e apoio.",
  exemploCruzamento:
    "\"Medo\" pode ser um convite para perguntar sobre uma situação relatada; não prova a origem do sentimento.",
  limiteInterpretacao:
    "Não induzir lembranças de abuso, \"vidas passadas\" ou traumas. Se houver relato de perigo imediato, interromper a interpretação e priorizar ajuda adequada.",
  tags: ["emocoes", "estresse", "sobrecarga"],
  blocos: [
    {
      titulo: "O que você sente",
      perguntas: [
        {
          id: "M02.01",
          texto: "Que sentimentos você deseja conversar hoje?",
          tipo: "M",
          tags: ["emocoes"],
          opcoes: [
            { valor: "ansiedade", rotulo: "Ansiedade" },
            { valor: "tristeza", rotulo: "Tristeza" },
            { valor: "raiva", rotulo: "Raiva" },
            { valor: "medo", rotulo: "Medo" },
            { valor: "culpa", rotulo: "Culpa" },
            { valor: "cansaco", rotulo: "Cansaço" },
            { valor: "desesperanca", rotulo: "Desesperança" },
            { valor: "vontade_de_me_machucar", rotulo: "Vontade de me machucar", bandeira: "risco_imediato" },
            { valor: "outro", rotulo: "Outro (descrevo abaixo)" },
          ],
          ajuda: "Escolha as palavras que fizerem sentido para você. Nenhuma é obrigatória.",
        },
        t("M02.02", "Em quais situações eles aparecem com mais força?", ["contexto"]),
        { id: "M02.03", texto: "Há quanto tempo percebe isso?", tipo: "D", tags: ["duracao"] },
        t("M02.04", "Como isso interfere no trabalho, na rotina ou nos vínculos?", ["impacto"]),
        t("M02.05", "Quais sinais você percebe em si quando a situação piora?", ["sinais_proprios"]),
      ],
    },
    {
      titulo: "Apoio e limites",
      perguntas: [
        t("M02.06", "O que já ajuda a lidar com esses momentos?", ["recursos"]),
        {
          id: "M02.07",
          texto: "Há alguém com quem consegue conversar com segurança?",
          tipo: "U",
          tags: ["apoio", "rede"],
          opcoes: [
            { valor: "sim", rotulo: "Sim" },
            { valor: "mais_ou_menos", rotulo: "Mais ou menos" },
            { valor: "nao", rotulo: "Não", bandeira: "sofrimento_psiquico" },
          ],
        },
        {
          id: "M02.08",
          texto: "Deseja informar se possui acompanhamento profissional?",
          tipo: "U",
          tags: ["acompanhamento"],
          opcional: true,
          opcoes: [
            { valor: "sim_em_acompanhamento", rotulo: "Sim, estou em acompanhamento", bandeira: "saude_em_acompanhamento" },
            { valor: "ja_tive", rotulo: "Já tive, hoje não" },
            { valor: "nunca", rotulo: "Nunca tive" },
            { valor: "prefiro_nao_informar", rotulo: "Prefiro não informar" },
          ],
        },
        t("M02.09", "Há temas ou lembranças que prefere não explorar?", ["evitar"]),
        {
          id: "M02.10",
          texto: "Que tipo de apoio espera desta sessão agora?",
          tipo: "U",
          tags: ["expectativa"],
          opcoes: [
            { valor: "acolhimento", rotulo: "Acolhimento" },
            { valor: "organizacao", rotulo: "Organização das ideias" },
            { valor: "reflexao", rotulo: "Reflexão" },
            { valor: "registro", rotulo: "Registro da sessão" },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// M03 - Sono, descanso e organizacao da rotina
// ===========================================================================
const M03: Formulario = {
  id: "M03",
  versao: 1,
  titulo: "Sono, descanso e organização da rotina",
  resumo: "Recorte de bem-estar para registrar hábitos e a percepção da pessoa, sem interpretar sinais como diagnóstico de sono.",
  organiza: "Horários, ambiente, preocupações e descanso autorrelatado.",
  exemploCruzamento:
    "Um setor \"rotina\" pode ser associado a horários variáveis informados, preservando a possibilidade de outras explicações.",
  limiteInterpretacao:
    "Não diagnosticar insônia ou apneia, indicar sedativos, alterar remédios ou tratar a lâmina como exame.",
  tags: ["sono", "rotina", "descanso"],
  blocos: [
    {
      titulo: "Horários e hábitos",
      perguntas: [
        t("M03.01", "Como descreve seu descanso atualmente?", ["descanso"]),
        t("M03.02", "Quais são seus horários habituais de deitar e levantar?", ["horarios"]),
        {
          id: "M03.03",
          texto: "Esses horários variam entre dias úteis e folgas?",
          tipo: "U",
          tags: ["horarios", "rotina"],
          opcoes: [
            { valor: "nao", rotulo: "Não, são parecidos" },
            { valor: "pouco", rotulo: "Variam um pouco" },
            { valor: "muito", rotulo: "Variam muito" },
          ],
        },
        t("M03.04", "O que costuma fazer antes de dormir?", ["habito"]),
        {
          id: "M03.05",
          texto: "Que fatores do ambiente incomodam ou ajudam?",
          tipo: "M",
          tags: ["ambiente"],
          opcoes: [
            { valor: "ruido", rotulo: "Ruído" },
            { valor: "luz", rotulo: "Luz" },
            { valor: "temperatura", rotulo: "Temperatura" },
            { valor: "colchao", rotulo: "Cama ou colchão" },
            { valor: "companhia", rotulo: "Companhia no quarto" },
            { valor: "telas", rotulo: "Telas" },
          ],
        },
      ],
    },
    {
      titulo: "Preocupações e ajustes",
      perguntas: [
        t("M03.06", "Que preocupações aparecem no período de descanso?", ["preocupacao"]),
        t("M03.07", "Como se sente ao acordar e ao longo do dia?", ["disposicao"]),
        {
          id: "M03.08",
          texto: "Há trabalho em turnos, cuidados com alguém ou outra restrição?",
          tipo: "M",
          tags: ["restricao", "sobrecarga"],
          opcoes: [
            { valor: "turnos", rotulo: "Trabalho em turnos" },
            { valor: "cuidador", rotulo: "Cuido de alguém" },
            { valor: "bebe", rotulo: "Bebê ou criança pequena" },
            { valor: "estudo_noturno", rotulo: "Estudo à noite" },
            { valor: "nenhuma", rotulo: "Nenhuma" },
          ],
        },
        t("M03.09", "Qual ajuste de rotina considera possível e deseja testar?", ["acao", "curto"]),
        t("M03.10", "Que registro simples permitirá avaliar sua experiência depois?", ["retorno", "medida_propria"]),
      ],
    },
  ],
};

// ===========================================================================
// M04 - Saude: contexto de apoio complementar
// ===========================================================================
const M04: Formulario = {
  id: "M04",
  versao: 1,
  titulo: "Saúde: contexto de apoio complementar",
  resumo: "Para quem procura acolhimento durante um cuidado de saúde. Coletar o mínimo necessário e manter o relato clínico separado da leitura simbólica.",
  organiza: "Queixa relatada, acompanhamento e limites acordados.",
  exemploCruzamento:
    "Se surgir um símbolo corporal, registrar o rótulo da lâmina e perguntar se deseja conversar; não inferir disfunção do órgão.",
  limiteInterpretacao:
    "Não usar pendulação para detectar doença, alergia, gravidez ou carência; nem para suspender tratamento ou escolher dose. O app não fará avaliação clínica automatizada.",
  tags: ["saude_apoio", "corpo", "acompanhamento"],
  blocos: [
    {
      titulo: "Sua preocupação",
      perguntas: [
        t("M04.01", "Qual é sua preocupação de saúde, em suas próprias palavras?", ["queixa"]),
        {
          id: "M04.02",
          texto: "Existe avaliação profissional sobre esse assunto que queira registrar?",
          tipo: "U",
          tags: ["acompanhamento"],
          opcoes: [
            { valor: "sim", rotulo: "Sim", bandeira: "saude_em_acompanhamento" },
            { valor: "nao", rotulo: "Não", bandeira: "saude_sem_acompanhamento" },
            { valor: "em_busca", rotulo: "Estou procurando atendimento", bandeira: "saude_sem_acompanhamento" },
            { valor: "prefiro_nao_informar", rotulo: "Prefiro não informar" },
          ],
        },
        t("M04.03", "Que cuidado ou acompanhamento já está em andamento?", ["acompanhamento"]),
        t("M04.04", "Há recomendações do profissional que precisam ser respeitadas?", ["restricao", "acompanhamento"]),
      ],
    },
    {
      titulo: "O que você espera",
      perguntas: [
        {
          id: "M04.05",
          texto: "O que deseja desta sessão: acolhimento, organização ou reflexão?",
          tipo: "M",
          tags: ["expectativa"],
          opcoes: [
            { valor: "acolhimento", rotulo: "Acolhimento" },
            { valor: "organizacao", rotulo: "Organização" },
            { valor: "reflexao", rotulo: "Reflexão" },
          ],
        },
        t("M04.06", "Como essa situação afeta sua vida cotidiana?", ["impacto"]),
        {
          id: "M04.07",
          texto: "Há exames ou documentos relevantes que deseja compartilhar?",
          tipo: "U",
          tags: ["documento"],
          opcional: true,
          opcoes: [
            { valor: "nao", rotulo: "Não" },
            { valor: "sim_trouxe", rotulo: "Sim, trouxe" },
            { valor: "sim_depois", rotulo: "Sim, envio depois" },
          ],
          ajuda: "Opcional. Nada é anexado sem sua autorização.",
        },
        { id: "M04.08", texto: "Há medicamentos ou restrições que queira informar por pertinência?", tipo: "T", tags: ["restricao"], opcional: true },
        { id: "M04.09", texto: "Qual pessoa ou serviço acompanha sua saúde, se desejar informar?", tipo: "T", tags: ["acompanhamento"], opcional: true },
        t("M04.10", "Como distinguirá conforto percebido de mudança clínica verificada?", ["limite_proprio"]),
      ],
    },
  ],
};

// ===========================================================================
// M05 - Autoconhecimento e espiritualidade
// ===========================================================================
const M05: Formulario = {
  id: "M05",
  versao: 1,
  titulo: "Autoconhecimento e espiritualidade",
  resumo: "Para explorar valores, sentidos e crenças escolhidas pela pessoa. Não exigir religião ou adesão ao vocabulário do terapeuta.",
  organiza: "Valores, preferência de linguagem, consentimento e autonomia.",
  exemploCruzamento:
    "Um chakra pode ser explicado segundo o protocolo cadastrado; só conectá-lo a experiências que a pessoa reconheça.",
  limiteInterpretacao:
    "Não afirmar possessão, ataque espiritual, culpa moral ou superioridade vibracional como fatos. Não atribuir sofrimento a crença insuficiente.",
  tags: ["autoconhecimento", "sentido", "espiritualidade"],
  blocos: [
    {
      titulo: "Valores e sentido",
      perguntas: [
        t("M05.01", "O que deseja compreender melhor sobre si neste momento?", ["autoconhecimento"]),
        t("M05.02", "Quais valores orientam suas escolhas?", ["valores"]),
        t("M05.03", "Que situações parecem se repetir e como você as descreve?", ["repeticao"]),
        t("M05.04", "Que explicações você próprio(a) considera possíveis?", ["hipotese_propria"]),
        {
          id: "M05.05",
          texto: "Prefere falar de símbolos, espiritualidade ou temas práticos?",
          tipo: "U",
          tags: ["linguagem"],
          opcoes: [
            { valor: "simbolos", rotulo: "Símbolos" },
            { valor: "espiritualidade", rotulo: "Espiritualidade" },
            { valor: "praticos", rotulo: "Temas práticos" },
          ],
        },
      ],
    },
    {
      titulo: "Crenças e limites",
      perguntas: [
        { id: "M05.06", texto: "Existe alguma crença que deseje compartilhar voluntariamente?", tipo: "T", tags: ["crenca"], opcional: true, ajuda: "Opcional. Convicção religiosa é dado sensível; só registramos se você quiser." },
        t("M05.07", "Há símbolos, tradições ou práticas que não aceita?", ["evitar"]),
        t("M05.08", "Que experiências lhe trazem sentido ou pertencimento?", ["sentido", "pertencimento"]),
        t("M05.09", "Qual decisão ou reflexão está sob seu controle hoje?", ["autonomia", "acao"]),
        t("M05.10", "O que seria uma descoberta útil, sem exigir uma certeza absoluta?", ["expectativa"]),
      ],
    },
  ],
};

// ===========================================================================
// M06 - Carreira
// ===========================================================================
const M06: Formulario = {
  id: "M06",
  versao: 1,
  titulo: "Carreira e crescimento profissional",
  resumo: "Para organizar objetivo, contexto e ações possíveis na vida profissional.",
  organiza: "Objetivo, competências, alternativas, tentativas e restrições.",
  exemploCruzamento:
    "Um setor \"comunicação\" pode motivar reflexão sobre apresentar portfólio se isso já aparece no relato.",
  limiteInterpretacao:
    "Não prever contratação, promoção ou demissão. Não substituir análise real de proposta por \"compatibilidade energética\".",
  tags: ["carreira", "trabalho", "transicao"],
  blocos: [
    {
      titulo: "Situação e objetivo",
      perguntas: [
        {
          id: "M06.01",
          texto: "Qual é sua situação profissional atual?",
          tipo: "U",
          tags: ["situacao"],
          opcoes: [
            { valor: "empregado", rotulo: "Empregado(a)" },
            { valor: "autonomo", rotulo: "Autônomo(a)" },
            { valor: "empresario", rotulo: "Tenho um negócio" },
            { valor: "desempregado", rotulo: "Sem trabalho agora" },
            { valor: "estudante", rotulo: "Estudando" },
            { valor: "transicao", rotulo: "Em transição" },
          ],
        },
        t("M06.02", "Qual mudança ou conquista deseja?", ["objetivo"]),
        { id: "M06.03", texto: "Qual prazo você imagina e por quê?", tipo: "D", tags: ["prazo"] },
        t("M06.04", "Que experiências e competências já possui?", ["competencia"]),
        t("M06.05", "Quais dificuldades são concretas e verificáveis?", ["dificuldade"]),
      ],
    },
    {
      titulo: "Caminhos possíveis",
      perguntas: [
        t("M06.06", "Que receios ou dúvidas deseja conversar?", ["receio"]),
        t("M06.07", "Que oportunidades ou alternativas já identificou?", ["oportunidade"]),
        t("M06.08", "O que já fez e que retorno recebeu?", ["tentativas"]),
        {
          id: "M06.09",
          texto: "Quais restrições de renda, tempo ou responsabilidades existem?",
          tipo: "M",
          tags: ["restricao"],
          opcoes: [
            { valor: "renda", rotulo: "Renda" },
            { valor: "tempo", rotulo: "Tempo" },
            { valor: "familia", rotulo: "Responsabilidades familiares" },
            { valor: "localizacao", rotulo: "Localização" },
            { valor: "formacao", rotulo: "Formação exigida" },
            { valor: "nenhuma", rotulo: "Nenhuma relevante" },
          ],
        },
        t("M06.10", "Qual próximo passo depende de você e pode ser acompanhado?", ["acao", "curto"]),
      ],
    },
  ],
};

// ===========================================================================
// M07 - Financas pessoais
// ===========================================================================
const M07: Formulario = {
  id: "M07",
  versao: 1,
  titulo: "Finanças pessoais e prosperidade",
  resumo: "Para diferenciar desejos, hábitos e situação material, sem oferecer aconselhamento de investimento baseado na lâmina.",
  organiza: "Definição de prosperidade, realidade econômica e escolhas pessoais.",
  exemploCruzamento:
    "\"Organização\" pode se conectar à ausência de controle de gastos informada; isso é um vínculo textual, não uma causa energética.",
  limiteInterpretacao:
    "Não prometer ganhos, indicar ativos ou apostas, afirmar prazo de enriquecimento ou culpar a pessoa por pobreza.",
  tags: ["financas", "prosperidade", "material"],
  blocos: [
    {
      titulo: "O que você quer organizar",
      perguntas: [
        t("M07.01", "O que \"prosperidade\" significa para você?", ["definicao_propria"]),
        t("M07.02", "Qual objetivo financeiro concreto deseja organizar?", ["objetivo"]),
        {
          id: "M07.03",
          texto: "Quer informar valores ou prefere trabalhar sem números?",
          tipo: "U",
          tags: ["preferencia"],
          opcoes: [
            { valor: "com_valores", rotulo: "Com valores" },
            { valor: "sem_numeros", rotulo: "Sem números" },
          ],
        },
        {
          id: "M07.04",
          texto: "Se informar, o valor é renda, gasto, dívida ou reserva?",
          tipo: "U",
          tags: ["natureza_do_valor"],
          opcional: true,
          opcoes: [
            { valor: "renda", rotulo: "Renda" },
            { valor: "gasto", rotulo: "Gasto" },
            { valor: "divida", rotulo: "Dívida" },
            { valor: "reserva", rotulo: "Reserva" },
          ],
        },
        { id: "M07.05", texto: "Qual é o prazo desejado e o grau de urgência percebido?", tipo: "D", tags: ["prazo", "urgencia"] },
      ],
    },
    {
      titulo: "Hábitos e contexto",
      perguntas: [
        t("M07.06", "Que hábitos de organização financeira já pratica?", ["organizacao", "habito"]),
        t("M07.07", "Quais acontecimentos afetaram sua situação?", ["historia"]),
        t("M07.08", "Que sentimentos surgem ao lidar com dinheiro?", ["emocoes", "financas"]),
        t("M07.09", "Que apoio técnico ou familiar você já utiliza?", ["apoio"]),
        t("M07.10", "Qual ação possível pode ser revista no retorno?", ["acao", "retorno"]),
      ],
    },
  ],
};

// ===========================================================================
// M08 - Negocios
// ===========================================================================
const M08: Formulario = {
  id: "M08",
  versao: 1,
  titulo: "Negócios, vendas e lucro",
  resumo: "Para empreendedor ou responsável autorizado. Separar a experiência pessoal do dono e os dados da empresa.",
  organiza: "Problema do negócio, dados voluntários, autoridade e ações.",
  exemploCruzamento:
    "\"Visibilidade\" pode ser tema de reflexão se o dono informou ausência de divulgação; o relatório deve citar esse dado.",
  limiteInterpretacao:
    "Não diagnosticar funcionário, selecionar candidato, prever contrato ou afirmar que símbolos produzirão lucro. Preservar segredos comerciais.",
  tags: ["negocio", "vendas", "lucro", "operacao"],
  blocos: [
    {
      titulo: "O negócio",
      perguntas: [
        t("M08.01", "Qual negócio e qual é sua relação com ele?", ["negocio"]),
        {
          id: "M08.02",
          texto: "Qual desafio deseja trabalhar: vendas, caixa, operação ou outro?",
          tipo: "U",
          tags: ["desafio"],
          opcoes: [
            { valor: "vendas", rotulo: "Vendas" },
            { valor: "caixa", rotulo: "Caixa" },
            { valor: "operacao", rotulo: "Operação" },
            { valor: "equipe", rotulo: "Equipe" },
            { valor: "preco", rotulo: "Precificação" },
            { valor: "outro", rotulo: "Outro" },
          ],
        },
        {
          id: "M08.03",
          texto: "Qual indicador descreve melhor o problema?",
          tipo: "U",
          tags: ["indicador"],
          opcional: true,
          opcoes: [
            { valor: "faturamento", rotulo: "Faturamento" },
            { valor: "margem", rotulo: "Margem" },
            { valor: "lucro", rotulo: "Lucro" },
            { valor: "caixa", rotulo: "Saldo de caixa" },
            { valor: "nao_acompanho", rotulo: "Não acompanho indicador" },
          ],
        },
        {
          id: "M08.04",
          texto: "O valor informado é receita, margem, lucro ou saldo de caixa?",
          tipo: "U",
          tags: ["natureza_do_valor"],
          opcional: true,
          opcoes: [
            { valor: "receita", rotulo: "Receita" },
            { valor: "margem", rotulo: "Margem" },
            { valor: "lucro", rotulo: "Lucro" },
            { valor: "caixa", rotulo: "Saldo de caixa" },
          ],
          ajuda: "Caixa, receita e lucro são coisas diferentes. Vale registrar qual é qual.",
        },
        { id: "M08.05", texto: "De que período são os dados e qual a fonte?", tipo: "D", tags: ["procedencia"] },
      ],
    },
    {
      titulo: "Operação e autoridade",
      perguntas: [
        t("M08.06", "Quem é o público e como as vendas acontecem?", ["publico", "vendas"]),
        t("M08.07", "Que mudanças já foram tentadas e com quais resultados?", ["tentativas"]),
        t("M08.08", "Quais decisões estão sob sua autoridade?", ["autoridade"]),
        {
          id: "M08.09",
          texto: "Há restrições de equipe, orçamento ou capacidade?",
          tipo: "M",
          tags: ["restricao", "capacidade"],
          opcoes: [
            { valor: "equipe", rotulo: "Equipe" },
            { valor: "orcamento", rotulo: "Orçamento" },
            { valor: "capacidade", rotulo: "Capacidade de produção" },
            { valor: "tempo", rotulo: "Tempo" },
            { valor: "nenhuma", rotulo: "Nenhuma relevante" },
          ],
        },
        t("M08.10", "Que resultado observável e próximo passo deseja acompanhar?", ["acao", "retorno"]),
      ],
    },
  ],
};

// ===========================================================================
// M09 - Objetivos pessoais
// ===========================================================================
const M09: Formulario = {
  id: "M09",
  versao: 1,
  titulo: "Objetivos pessoais, estudos e hábitos",
  resumo: "Para quem quer concluir um projeto, estudar, mudar um hábito ou organizar uma decisão.",
  organiza: "Objetivo específico, progresso, recursos e próxima etapa.",
  exemploCruzamento:
    "Se a lâmina trouxer \"foco\", conectar apenas a relatos sobre prioridades ou dispersão, sem inventar dificuldade de atenção.",
  limiteInterpretacao:
    "Não inferir transtorno, capacidade intelectual ou aprovação futura. Não apresentar uma meta frustrada como \"vibração baixa\".",
  tags: ["objetivos", "estudos", "habitos", "foco"],
  blocos: [
    {
      titulo: "O objetivo",
      perguntas: [
        t("M09.01", "Qual objetivo deseja trabalhar?", ["objetivo"]),
        t("M09.02", "Por que ele é importante para você?", ["motivacao"]),
        t("M09.03", "Como saberá que foi concluído?", ["medida_propria"]),
        { id: "M09.04", texto: "Qual prazo deseja e qual flexibilidade existe?", tipo: "D", tags: ["prazo"] },
        t("M09.05", "O que já foi feito até agora?", ["progresso"]),
      ],
    },
    {
      titulo: "Obstáculos e recursos",
      perguntas: [
        t("M09.06", "Quais obstáculos concretos você encontra?", ["obstaculo"]),
        t("M09.07", "Que pensamentos ou sentimentos deseja conversar?", ["emocoes"]),
        t("M09.08", "Quais recursos, tempo e apoios estão disponíveis?", ["recursos", "apoio"]),
        t("M09.09", "Qual é a menor etapa viável que depende de você?", ["acao", "agora"]),
        { id: "M09.10", texto: "Quando e como deseja revisar seu progresso?", tipo: "D", tags: ["retorno"] },
      ],
    },
  ],
};

// ===========================================================================
// M10 - Relacionamentos
// ===========================================================================
const M10: Formulario = {
  id: "M10",
  versao: 1,
  titulo: "Relacionamentos e convivência",
  resumo: "Para compreender a vivência da pessoa atendida. Não é leitura da mente ou diagnóstico de outra pessoa.",
  organiza: "Vivência própria, comunicação, limites, apoio e segurança.",
  exemploCruzamento:
    "Um setor \"limites\" pode ser explorado como pergunta sobre a própria pessoa, sem atribuir culpa ou intenção a terceiros.",
  limiteInterpretacao:
    "Não confirmar traição, \"amarração\", intenção oculta ou retorno de ex-parceiro. A permissão de um cliente não autoriza coletar dados sensíveis de outra pessoa.",
  tags: ["relacionamentos", "vinculos", "convivencia", "limites"],
  blocos: [
    {
      titulo: "A relação",
      perguntas: [
        t("M10.01", "Que relação deseja conversar e qual é sua vivência nela?", ["relacao"]),
        t("M10.02", "Qual situação concreta motivou a procura?", ["gatilho"]),
        t("M10.03", "O que você deseja mudar na própria experiência?", ["objetivo"]),
        t("M10.04", "Como costuma acontecer a comunicação entre vocês?", ["comunicacao"]),
        t("M10.05", "Que limites seus foram respeitados ou desrespeitados?", ["limites"]),
      ],
    },
    {
      titulo: "Segurança e apoio",
      perguntas: [
        t("M10.06", "O que já tentou conversar ou reorganizar?", ["tentativas"]),
        {
          id: "M10.07",
          texto: "Você se sente seguro(a) para abordar esse assunto?",
          tipo: "U",
          tags: ["seguranca"],
          opcoes: [
            { valor: "sim", rotulo: "Sim" },
            { valor: "em_parte", rotulo: "Em parte" },
            { valor: "nao", rotulo: "Não", bandeira: "violencia_ou_controle" },
          ],
        },
        {
          id: "M10.08",
          texto: "Há controle, ameaça ou violência que queira relatar?",
          tipo: "U",
          tags: ["seguranca", "violencia"],
          opcional: true,
          opcoes: [
            { valor: "nao", rotulo: "Não" },
            { valor: "sim", rotulo: "Sim", bandeira: "violencia_ou_controle" },
            { valor: "prefiro_nao_responder_agora", rotulo: "Prefiro não responder agora" },
          ],
          ajuda: "Opcional. Você decide o quanto quer contar.",
        },
        t("M10.09", "Que rede de apoio você possui?", ["apoio", "rede"]),
        t("M10.10", "Qual próximo passo preserva sua autonomia e segurança?", ["acao", "seguranca"]),
      ],
    },
  ],
};

// ===========================================================================
// M11 - Transicoes
// ===========================================================================
const M11: Formulario = {
  id: "M11",
  versao: 1,
  titulo: "Transições de vida, perdas e recomeços",
  resumo: "Para acolher mudanças e redefinição de prioridades. Não pressupõe doença ou necessidade de intervenção espiritual.",
  organiza: "Mudança concreta, ritmo da pessoa, apoio e necessidade atual.",
  exemploCruzamento:
    "\"Recomeço\" é uma possibilidade de conversa, não prova de que a pessoa deve romper vínculos ou acelerar o luto.",
  limiteInterpretacao:
    "Não afirmar comunicação com falecidos ou causa espiritual da perda. Não estimular dependência de sessões para evitar consequências temidas.",
  tags: ["transicao", "perda", "luto", "recomeco"],
  blocos: [
    {
      titulo: "A mudança",
      perguntas: [
        { id: "M11.01", texto: "Que mudança ou perda deseja conversar, se sentir à vontade?", tipo: "T", tags: ["perda"], opcional: true },
        { id: "M11.02", texto: "Quando aconteceu e o que mudou na sua rotina?", tipo: "D", tags: ["duracao", "rotina"] },
        t("M11.03", "O que tem sido mais difícil neste momento?", ["dificuldade"]),
        t("M11.04", "O que tem ajudado, mesmo que pouco?", ["recursos"]),
        t("M11.05", "Quais responsabilidades ou decisões estão pendentes?", ["decisao"]),
      ],
    },
    {
      titulo: "Apoio e ritmo",
      perguntas: [
        t("M11.06", "Que pessoas ou serviços oferecem apoio?", ["apoio", "rede"]),
        { id: "M11.07", texto: "Há práticas, rituais ou crenças que deseja respeitar?", tipo: "T", tags: ["crenca"], opcional: true },
        t("M11.08", "Há temas que prefere não abordar agora?", ["evitar"]),
        t("M11.09", "Qual necessidade imediata considera prioritária?", ["acao", "agora"]),
        { id: "M11.10", texto: "Como gostaria de ser acompanhado(a) no retorno?", tipo: "D", tags: ["retorno"] },
      ],
    },
  ],
};

// ===========================================================================
// M12 - Ambiente
// ===========================================================================
const M12: Formulario = {
  id: "M12",
  versao: 1,
  titulo: "Casa, trabalho e percepção do ambiente",
  resumo: "Para registrar o espaço e o desconforto percebido. Separar a pessoa responsável do ambiente e de outros moradores.",
  organiza: "Local, percepção, circunstâncias e fatores materiais relatados.",
  exemploCruzamento:
    "Um setor \"quarto\" remete a uma região do mapa cadastrado. Não comprova presença de radiação, entidade ou risco físico.",
  limiteInterpretacao:
    "Não atestar potabilidade, segurança elétrica, estrutura, gás ou exposição ambiental pelo pêndulo. Demandas técnicas exigem métodos e profissionais apropriados.",
  tags: ["ambiente", "casa", "trabalho_fisico"],
  blocos: [
    {
      titulo: "O espaço",
      perguntas: [
        t("M12.01", "Que ambiente deseja abordar e qual é sua relação com ele?", ["ambiente"]),
        t("M12.02", "Que desconforto percebe e em quais situações?", ["desconforto"]),
        { id: "M12.03", texto: "Quando começou e o que mudou no local?", tipo: "D", tags: ["duracao", "mudanca"] },
        t("M12.04", "Em qual cômodo ou região isso é percebido?", ["ambiente", "local"]),
        {
          id: "M12.05",
          texto: "Como estão luz, ventilação, ruído e organização, segundo você?",
          tipo: "M",
          tags: ["ambiente", "fator_material"],
          opcoes: [
            { valor: "luz_ruim", rotulo: "Pouca luz" },
            { valor: "ventilacao_ruim", rotulo: "Pouca ventilação" },
            { valor: "ruido", rotulo: "Muito ruído" },
            { valor: "desorganizado", rotulo: "Desorganizado" },
            { valor: "tudo_bem", rotulo: "Está tudo bem nesses pontos" },
          ],
        },
      ],
    },
    {
      titulo: "Fatores materiais e autorizações",
      perguntas: [
        {
          id: "M12.06",
          texto: "Há umidade, cheiro, instalações ou outro fator a verificar?",
          tipo: "M",
          tags: ["fator_material"],
          opcoes: [
            { valor: "nao", rotulo: "Não" },
            { valor: "umidade", rotulo: "Umidade ou mofo", bandeira: "risco_material_do_ambiente" },
            { valor: "cheiro", rotulo: "Cheiro forte ou de gás", bandeira: "risco_material_do_ambiente" },
            { valor: "eletrica", rotulo: "Problema elétrico", bandeira: "risco_material_do_ambiente" },
            { valor: "estrutura", rotulo: "Rachadura ou estrutura", bandeira: "risco_material_do_ambiente" },
            { valor: "agua", rotulo: "Dúvida sobre a água", bandeira: "risco_material_do_ambiente" },
          ],
          ajuda: "Esses pontos são verificados por profissional técnico, não pelo pêndulo.",
        },
        t("M12.07", "Quem pode autorizar registros, fotos e mudanças no espaço?", ["autorizacao"]),
        t("M12.08", "Que tentativas de melhoria já foram realizadas?", ["tentativas"]),
        {
          id: "M12.09",
          texto: "Há restrições de orçamento, acesso ou privacidade?",
          tipo: "M",
          tags: ["restricao"],
          opcoes: [
            { valor: "orcamento", rotulo: "Orçamento" },
            { valor: "acesso", rotulo: "Acesso ao local" },
            { valor: "privacidade", rotulo: "Privacidade" },
            { valor: "aluguel", rotulo: "É alugado" },
            { valor: "nenhuma", rotulo: "Nenhuma" },
          ],
        },
        t("M12.10", "Que mudança prática e observável gostaria de acompanhar?", ["acao", "retorno"]),
      ],
    },
  ],
};

// ===========================================================================
// Retorno
// ===========================================================================
export const FORMULARIO_RETORNO: Formulario = {
  id: "RETORNO",
  versao: 1,
  titulo: "Retorno",
  resumo: "Formulário comum de retorno, para a sessão seguinte.",
  organiza: "O que mudou, o que foi feito, o que fez sentido e o próximo passo.",
  limiteInterpretacao:
    "Mudança de autorrelato não prova efeito da radiestesia: contexto, ações concretas, cuidados paralelos e passagem do tempo também podem influenciar a experiência.",
  tags: ["retorno"],
  blocos: [
    {
      titulo: "Desde a última sessão",
      perguntas: [
        t("R01", "O que mudou desde a sessão anterior, em suas palavras?", ["mudanca"]),
        t("R02", "O objetivo continua o mesmo? Se mudou, qual é o novo?", ["objetivo"]),
        t("R03", "Que ações você realmente realizou e o que aconteceu?", ["acao", "progresso"]),
        {
          id: "R04",
          texto: "Como avalia hoje o impacto no cotidiano?",
          tipo: "E",
          ancoras: { min: "0 = nada", max: "10 = muito" },
          tags: ["impacto"],
          ajuda: "Mesma escala da ficha inicial, para comparar com a sua própria percepção anterior.",
        },
      ],
    },
    {
      titulo: "Sobre o relatório anterior",
      perguntas: [
        t("R05", "Houve novos acontecimentos, cuidados profissionais ou informações relevantes?", ["acompanhamento", "novidade"]),
        t("R06", "O que no relatório anterior fez sentido, não fez sentido ou precisa de correção?", ["divergencia"]),
        {
          id: "R07",
          texto: "Houve desconforto, medo, pressão ou consequência indesejada da sessão?",
          tipo: "U",
          tags: ["efeito_indesejado"],
          opcoes: [
            { valor: "nao", rotulo: "Não" },
            { valor: "sim", rotulo: "Sim", bandeira: "sofrimento_psiquico" },
            { valor: "um_pouco", rotulo: "Um pouco" },
          ],
        },
        { id: "R08", texto: "Qual será o próximo passo escolhido e quando deseja revisar?", tipo: "D", tags: ["acao", "retorno"] },
      ],
    },
  ],
};

// ===========================================================================
// Extensao: animal, planta, terreno
// ===========================================================================
export const EXT_ANIMAL_PLANTA: Formulario = {
  id: "EXT_ANIMAL_PLANTA",
  versao: 1,
  titulo: "Extensão: animal, planta ou terreno",
  resumo:
    "Extensão opcional. O animal não responde anamnese: quem informa é a pessoa responsável, que é distinta do objeto da sessão.",
  organiza: "Responsável, objeto da sessão, motivo, cuidado técnico em andamento e resultado esperado.",
  limiteInterpretacao:
    "Não usar leitura para diagnosticar doença ou substituir assistência veterinária ou técnica. Não reutilizar automaticamente perguntas humanas.",
  tags: ["animal", "planta", "terreno"],
  blocos: [
    {
      titulo: "Responsável e objeto",
      perguntas: [
        t("E01", "Quem é o responsável e qual é o vínculo com o animal, planta ou terreno?", ["responsavel"]),
        {
          id: "E02",
          texto: "Qual é o objeto desta sessão?",
          tipo: "U",
          tags: ["objeto"],
          opcoes: [
            { valor: "animal", rotulo: "Animal" },
            { valor: "planta", rotulo: "Planta" },
            { valor: "terreno", rotulo: "Terreno ou lavoura" },
          ],
        },
        t("E03", "Descreva o objeto: espécie, idade aproximada, há quanto tempo com você.", ["descricao"]),
        t("E04", "Qual é o motivo da procura, nas suas palavras?", ["motivo_principal"]),
        t("E05", "O que você observa que mudou e quando começou?", ["observacao", "duracao"]),
      ],
    },
    {
      titulo: "Cuidado técnico",
      perguntas: [
        {
          id: "E06",
          texto: "Há acompanhamento veterinário, agronômico ou técnico em andamento?",
          tipo: "U",
          tags: ["acompanhamento"],
          opcoes: [
            { valor: "sim", rotulo: "Sim" },
            { valor: "nao", rotulo: "Não", bandeira: "animal_sem_veterinario" },
            { valor: "em_busca", rotulo: "Estou procurando", bandeira: "animal_sem_veterinario" },
          ],
        },
        t("E07", "Que recomendações técnicas precisam ser respeitadas?", ["restricao"]),
        t("E08", "O que já foi tentado e com que resultado?", ["tentativas"]),
        t("E09", "Qual resultado você espera desta sessão?", ["expectativa"]),
        t("E10", "Que sinal observável você acompanhará até o retorno?", ["retorno", "medida_propria"]),
      ],
    },
  ],
};

// ===========================================================================
export const MODULOS: Formulario[] = [
  M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M11, M12,
];

export const FORMULARIOS: Formulario[] = [
  FICHA_BASE,
  ...MODULOS,
  FORMULARIO_RETORNO,
  EXT_ANIMAL_PLANTA,
];

export function acharFormulario(id: string): Formulario | undefined {
  return FORMULARIOS.find((f) => f.id === id);
}

export function acharPergunta(id: string): Pergunta | undefined {
  for (const f of FORMULARIOS) {
    for (const b of f.blocos) {
      const p = b.perguntas.find((q) => q.id === id);
      if (p) return p;
    }
  }
  return undefined;
}

/**
 * Motivo principal (B02) -> modulos sugeridos. Dossie, p. 8 (mapa 2) e p. 9:
 * "Pessoa ou terapeuta seleciona o principal e os secundarios. Sugerir
 *  modulos, sem classificar doencas."
 */
export const MOTIVO_PARA_MODULOS: Record<string, string[]> = {
  bem_estar: ["M01", "M03"],
  emocoes: ["M02"],
  saude_apoio: ["M04"],
  autoconhecimento: ["M05"],
  carreira: ["M06"],
  financas: ["M07"],
  relacionamentos: ["M10"],
  sono: ["M03", "M01"],
  negocio: ["M08", "M07"],
  objetivos: ["M09"],
  transicao: ["M11"],
  ambiente: ["M12"],
  curiosidade: ["M01"],
  nao_sei_explicar: ["M01", "M05"],
};

/**
 * Rotulo legivel do tema principal (B02). O valor guardado e o codigo da
 * opcao; a pessoa nunca deve ver "bem_estar" na tela.
 */
export function rotuloDoTema(valor?: string): string | undefined {
  if (!valor) return undefined;
  const b02 = FICHA_BASE.blocos
    .flatMap((b) => b.perguntas)
    .find((p) => p.id === "B02");
  return b02?.opcoes?.find((o) => o.valor === valor)?.rotulo ?? valor;
}
