"use client";

/**
 * Gera o PDF entregue a pessoa atendida, no proprio aparelho.
 * Nenhum dado sai do celular para montar este arquivo.
 *
 * Nome do arquivo: Nome-da-pessoa_AAAA-MM-DD_HHhMM.pdf
 */
import { rotuloDoTema } from "@/data/formularios";
import { jsPDF } from "jspdf";
import type { Redacao } from "./schemas";
import type { Pessoa, Sessao, Sintese } from "./tipos";
import { TEXTO_BANDEIRA } from "./motor";

const MARGEM = 18;
const LARGURA_PAGINA = 210;
const ALTURA_PAGINA = 297;
const LARGURA_TEXTO = LARGURA_PAGINA - MARGEM * 2;

export interface DadosPdf {
  pessoa: Pessoa;
  sessao: Sessao;
  sintese: Sintese;
  /** Texto redigido pelo Gemini. Ausente = PDF so com a base determinística. */
  redacao?: Redacao;
  /** Lâminas usadas, para o resumo técnico. */
  laminasUsadas: string[];
}

export function nomeArquivoPdf(pessoa: Pessoa, quando: Date): string {
  const slug = pessoa.nomePreferencia
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "pessoa-atendida";

  const d = String(quando.getDate()).padStart(2, "0");
  const m = String(quando.getMonth() + 1).padStart(2, "0");
  const a = quando.getFullYear();
  const h = String(quando.getHours()).padStart(2, "0");
  const min = String(quando.getMinutes()).padStart(2, "0");
  return `${slug}_${a}-${m}-${d}_${h}h${min}.pdf`;
}

function dataHoraLonga(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Escritor sequencial com quebra de pagina automatica. */
class Folha {
  private doc: jsPDF;
  private y = MARGEM + 6;
  private pagina = 1;

  constructor(doc: jsPDF) {
    this.doc = doc;
  }

  private espaco(altura: number): void {
    if (this.y + altura > ALTURA_PAGINA - MARGEM - 12) {
      this.rodape();
      this.doc.addPage();
      this.pagina++;
      this.y = MARGEM + 6;
    }
  }

  titulo(texto: string): void {
    this.espaco(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(19);
    this.doc.setTextColor(28, 28, 32);
    const linhas = this.doc.splitTextToSize(texto, LARGURA_TEXTO) as string[];
    for (const l of linhas) {
      this.espaco(9);
      this.doc.text(l, MARGEM, this.y);
      this.y += 8.5;
    }
    this.y += 2;
  }

  secao(texto: string): void {
    this.espaco(16);
    this.y += 4;
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11.5);
    this.doc.setTextColor(60, 60, 70);
    this.doc.text(texto.toUpperCase(), MARGEM, this.y);
    this.y += 2.5;
    this.doc.setDrawColor(215, 215, 222);
    this.doc.setLineWidth(0.3);
    this.doc.line(MARGEM, this.y, LARGURA_PAGINA - MARGEM, this.y);
    this.y += 6;
  }

  paragrafo(texto: string, tamanho = 11): void {
    if (!texto?.trim()) return;
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(tamanho);
    this.doc.setTextColor(32, 32, 38);
    const alturaLinha = tamanho * 0.52;
    for (const bloco of texto.split(/\n{2,}/)) {
      const linhas = this.doc.splitTextToSize(
        bloco.replace(/\n/g, " ").trim(),
        LARGURA_TEXTO,
      ) as string[];
      for (const l of linhas) {
        this.espaco(alturaLinha);
        this.doc.text(l, MARGEM, this.y);
        this.y += alturaLinha;
      }
      this.y += 3;
    }
  }

  lista(itens: string[], marcador = "•"): void {
    if (itens.length === 0) return;
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(11);
    this.doc.setTextColor(32, 32, 38);
    for (const item of itens) {
      const linhas = this.doc.splitTextToSize(
        item.trim(),
        LARGURA_TEXTO - 6,
      ) as string[];
      linhas.forEach((l, i) => {
        this.espaco(5.7);
        if (i === 0) this.doc.text(marcador, MARGEM, this.y);
        this.doc.text(l, MARGEM + 6, this.y);
        this.y += 5.7;
      });
      this.y += 1.5;
    }
    this.y += 1.5;
  }

  campos(pares: [string, string][]): void {
    this.doc.setFontSize(10);
    const usados = pares.filter(([, v]) => v?.trim());
    if (usados.length === 0) return;
    // A coluna do rotulo acompanha o rotulo mais largo: assim nenhum valor
    // encosta no rotulo, qualquer que seja o texto.
    this.doc.setFont("helvetica", "bold");
    const larguraRotulo =
      Math.max(...usados.map(([r]) => this.doc.getTextWidth(r))) + 4;
    for (const [rotulo, valor] of usados) {
      this.espaco(5.6);
      this.doc.setFont("helvetica", "bold");
      this.doc.setTextColor(88, 88, 98);
      this.doc.text(rotulo, MARGEM, this.y);
      this.doc.setFont("helvetica", "normal");
      this.doc.setTextColor(32, 32, 38);
      const linhas = this.doc.splitTextToSize(
        valor,
        LARGURA_TEXTO - larguraRotulo,
      ) as string[];
      linhas.forEach((l, i) => {
        if (i > 0) {
          this.espaco(5.2);
          this.y += 5.2;
        }
        this.doc.text(l, MARGEM + larguraRotulo, this.y);
      });
      this.y += 5.6;
    }
    this.y += 2;
  }

  caixa(titulo: string, texto: string, cor: [number, number, number]): void {
    if (!texto?.trim()) return;
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10.5);
    const linhas = this.doc.splitTextToSize(
      texto.replace(/\n+/g, " "),
      LARGURA_TEXTO - 12,
    ) as string[];
    const altura = linhas.length * 5.2 + 15;
    this.espaco(altura);
    this.doc.setFillColor(cor[0], cor[1], cor[2]);
    this.doc.setDrawColor(cor[0] - 25, cor[1] - 25, cor[2] - 25);
    this.doc.roundedRect(MARGEM, this.y - 4, LARGURA_TEXTO, altura, 2, 2, "FD");
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(50, 50, 58);
    this.doc.text(titulo.toUpperCase(), MARGEM + 6, this.y + 3);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10.5);
    let yy = this.y + 10;
    for (const l of linhas) {
      this.doc.text(l, MARGEM + 6, yy);
      yy += 5.2;
    }
    this.y += altura + 4;
  }

  rodape(): void {
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7.6);
    this.doc.setTextColor(130, 130, 140);
    const aviso =
      "Registro de leitura simbólica. Não é diagnóstico, prescrição, exame nem previsão.";
    this.doc.text(aviso, MARGEM, ALTURA_PAGINA - 11);
    this.doc.text(
      String(this.pagina),
      LARGURA_PAGINA - MARGEM,
      ALTURA_PAGINA - 11,
      { align: "right" },
    );
  }

  fechar(): void {
    this.rodape();
  }
}

export function gerarPdf(dados: DadosPdf): { blob: Blob; nome: string } {
  const { pessoa, sessao, sintese, redacao, laminasUsadas } = dados;
  const quando = new Date(sessao.encerradaEm ?? sessao.iniciadaEm);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const f = new Folha(doc);

  // -- Cabecalho -----------------------------------------------------------
  f.titulo(`${pessoa.nomePreferencia}, sobre a nossa sessão`);
  f.campos([
    ["Pessoa", pessoa.nomePreferencia],
    ["Terapeuta", sessao.terapeuta],
    ["Tema da sessão", rotuloDoTema(sessao.tema) ?? sessao.tema],
    ["Data e hora", dataHoraLonga(sessao.iniciadaEm)],
    [
      "Encerrada em",
      sessao.encerradaEm ? dataHoraLonga(sessao.encerradaEm) : "—",
    ],
    ["Sessão", sessao.id],
    ["Linguagem combinada", pessoa.preferenciaLinguagem ?? "não informada"],
    ["Lâminas usadas", laminasUsadas.join(", ") || "—"],
  ]);

  // -- Encaminhamento prioritario vem antes de tudo ------------------------
  const prioritarias = sintese.bandeiras.filter(
    (b) => b.tipo === "risco_imediato" || b.tipo === "violencia_ou_controle",
  );
  if (prioritarias.length > 0) {
    f.caixa(
      "Antes de qualquer coisa",
      sintese.encaminhamentos.join(" "),
      [255, 240, 238],
    );
  }

  // -- Corpo, na voz do terapeuta -----------------------------------------
  if (redacao) {
    f.paragrafo(redacao.abertura);

    f.secao("O que aconteceu na lâmina");
    f.paragrafo(redacao.oQueObservamos);

    f.secao("O que você me contou");
    f.paragrafo(redacao.oQueVoceContou);

    f.secao("Como uma coisa conversa com a outra");
    f.paragrafo(redacao.comoIssoSeConversa);

    if (redacao.oQueFicouEmAberto.trim()) {
      f.secao("O que ficou em aberto");
      f.paragrafo(redacao.oQueFicouEmAberto);
    }

    if (redacao.perguntasParaVoce.length > 0) {
      f.secao("Perguntas para você pensar");
      f.lista(redacao.perguntasParaVoce, "—");
    }

    const { agora, curto, medio, longo } = redacao.passos;
    if (agora.length || curto.length || medio.length || longo.length) {
      f.secao("Próximos passos que combinamos");
      if (agora.length) {
        f.paragrafo("Agora:", 10.5);
        f.lista(agora);
      }
      if (curto.length) {
        f.paragrafo("Curto prazo:", 10.5);
        f.lista(curto);
      }
      if (medio.length) {
        f.paragrafo("Médio prazo:", 10.5);
        f.lista(medio);
      }
      if (longo.length) {
        f.paragrafo("Longo prazo:", 10.5);
        f.lista(longo);
      }
    }

    if (redacao.encaminhamento.trim() && prioritarias.length === 0) {
      f.secao("Um encaminhamento");
      f.paragrafo(redacao.encaminhamento);
    }

    if (redacao.fechamento.trim()) {
      f.secao("Para fechar");
      f.paragrafo(redacao.fechamento);
    }
  } else {
    // Sem a camada de redacao: entrega a base determinística, sem floreio.
    f.secao("O que foi registrado");
    f.lista(sintese.resultadoObservado, "—");

    f.secao("Hipótese de conversa");
    f.paragrafo(sintese.interpretacaoSimbolica);

    if (sintese.contradicoesELacunas.length) {
      f.secao("O que ficou em aberto");
      f.lista(sintese.contradicoesELacunas);
    }
    if (sintese.perguntasDeConfirmacao.length) {
      f.secao("Perguntas para você pensar");
      f.lista(sintese.perguntasDeConfirmacao, "—");
    }
    if (sintese.acoesAcordadas.length) {
      f.secao("Próximos passos que combinamos");
      for (const prazo of ["agora", "curto", "medio", "longo"] as const) {
        const itens = sintese.acoesAcordadas
          .filter((a) => a.prazo === prazo)
          .map((a) => a.texto);
        if (itens.length === 0) continue;
        const rotulo = {
          agora: "Agora:",
          curto: "Curto prazo:",
          medio: "Médio prazo:",
          longo: "Longo prazo:",
        }[prazo];
        f.paragrafo(rotulo, 10.5);
        f.lista(itens);
      }
    }
    if (sintese.encaminhamentos.length && prioritarias.length === 0) {
      f.secao("Um encaminhamento");
      f.lista(sintese.encaminhamentos);
    }
  }

  // -- Limites -------------------------------------------------------------
  f.secao("Limites deste registro");
  f.lista(sintese.limites, "—");

  // -- Procedencia ---------------------------------------------------------
  f.secao("Como este documento foi feito");
  const proc = sintese.procedencia;
  f.campos([
    [
      "Motor",
      proc.motor === "deterministico"
        ? "regras do aplicativo, sem IA"
        : "regras do aplicativo + apoio de IA",
    ],
    ["Regras", proc.regrasVersao],
    ["Orquestração", proc.jevModelo ?? "—"],
    ["Redação", proc.geminiModelo ?? "—"],
    ["Gerado em", dataHoraLonga(proc.geradoEm)],
    [
      "Leituras consideradas",
      String(sintese.procedencia.leituras ?? "—"),
    ],
    ["Status", sintese.status.replace(/_/g, " ")],
  ]);

  if (sintese.bandeiras.length > 0) {
    f.paragrafo(
      "Sinais que acionaram encaminhamento: " +
        sintese.bandeiras.map((b) => TEXTO_BANDEIRA[b.tipo]).join("; ") +
        ".",
      9.5,
    );
  }

  f.fechar();

  return {
    blob: doc.output("blob"),
    nome: nomeArquivoPdf(pessoa, quando),
  };
}

export function baixarPdf(dados: DadosPdf): string {
  const { blob, nome } = gerarPdf(dados);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return nome;
}
