"use client";

/**
 * Banco local no aparelho do terapeuta. Sem login e sem servidor de dados:
 * nada de pessoa atendida sai deste celular, exceto trechos desidentificados
 * enviados a IA com consentimento proprio (dossie, p. 39).
 *
 * Consequencia assumida: limpar os dados do navegador apaga tudo.
 * Por isso existe exportarTudo()/importarTudo() para backup em arquivo.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  AnamneseRespondida,
  EventoLeitura,
  Lamina,
  Pessoa,
  Sessao,
  Sintese,
} from "./tipos";

const NOME_BANCO = "radiestesia";
const VERSAO_BANCO = 1;

interface Esquema extends DBSchema {
  pessoas: { key: string; value: Pessoa; indexes: { porNome: string } };
  anamneses: {
    key: string;
    value: AnamneseRespondida;
    indexes: { porPessoa: string };
  };
  sessoes: { key: string; value: Sessao; indexes: { porPessoa: string } };
  eventos: {
    key: string;
    value: EventoLeitura;
    indexes: { porSessao: string };
  };
  sinteses: { key: string; value: Sintese; indexes: { porSessao: string } };
  /** Laminas cadastradas pelo terapeuta, alem do catalogo embutido. */
  laminasCustom: { key: string; value: Lamina };
}

let promessaBanco: Promise<IDBPDatabase<Esquema>> | null = null;

function banco(): Promise<IDBPDatabase<Esquema>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("IndexedDB indisponível neste ambiente."),
    );
  }
  if (!promessaBanco) {
    promessaBanco = openDB<Esquema>(NOME_BANCO, VERSAO_BANCO, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("pessoas")) {
          const s = db.createObjectStore("pessoas", { keyPath: "id" });
          s.createIndex("porNome", "nomePreferencia");
        }
        if (!db.objectStoreNames.contains("anamneses")) {
          const s = db.createObjectStore("anamneses", { keyPath: "id" });
          s.createIndex("porPessoa", "pessoaId");
        }
        if (!db.objectStoreNames.contains("sessoes")) {
          const s = db.createObjectStore("sessoes", { keyPath: "id" });
          s.createIndex("porPessoa", "pessoaId");
        }
        if (!db.objectStoreNames.contains("eventos")) {
          const s = db.createObjectStore("eventos", { keyPath: "id" });
          s.createIndex("porSessao", "sessaoId");
        }
        if (!db.objectStoreNames.contains("sinteses")) {
          const s = db.createObjectStore("sinteses", { keyPath: "id" });
          s.createIndex("porSessao", "sessaoId");
        }
        if (!db.objectStoreNames.contains("laminasCustom")) {
          db.createObjectStore("laminasCustom", { keyPath: "id" });
        }
      },
    });
  }
  return promessaBanco;
}

export function novoId(prefixo: string): string {
  const aleatorio =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefixo}-${Date.now().toString(36)}-${aleatorio}`;
}

export function agora(): string {
  return new Date().toISOString();
}

// --------------------------------------------------------------------------
// Pessoas
// --------------------------------------------------------------------------
export async function salvarPessoa(p: Pessoa): Promise<void> {
  const db = await banco();
  await db.put("pessoas", { ...p, atualizadoEm: agora() });
}

export async function lerPessoa(id: string): Promise<Pessoa | undefined> {
  const db = await banco();
  return db.get("pessoas", id);
}

export async function listarPessoas(): Promise<Pessoa[]> {
  const db = await banco();
  const todas = await db.getAll("pessoas");
  return todas.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
}

/**
 * Apaga a pessoa e tudo ligado a ela. Direito do titular (LGPD; dossie, p. 39).
 */
export async function apagarPessoa(id: string): Promise<void> {
  const db = await banco();
  const sessoes = await db.getAllFromIndex("sessoes", "porPessoa", id);
  const tx = db.transaction(
    ["pessoas", "anamneses", "sessoes", "eventos", "sinteses"],
    "readwrite",
  );
  await tx.objectStore("pessoas").delete(id);
  for (const a of await db.getAllFromIndex("anamneses", "porPessoa", id)) {
    await tx.objectStore("anamneses").delete(a.id);
  }
  for (const s of sessoes) {
    await tx.objectStore("sessoes").delete(s.id);
    for (const e of await db.getAllFromIndex("eventos", "porSessao", s.id)) {
      await tx.objectStore("eventos").delete(e.id);
    }
    for (const t of await db.getAllFromIndex("sinteses", "porSessao", s.id)) {
      await tx.objectStore("sinteses").delete(t.id);
    }
  }
  await tx.done;
}

// --------------------------------------------------------------------------
// Anamneses
// --------------------------------------------------------------------------
export async function salvarAnamnese(a: AnamneseRespondida): Promise<void> {
  const db = await banco();
  await db.put("anamneses", { ...a, atualizadoEm: agora() });
}

export async function lerAnamnese(
  id: string,
): Promise<AnamneseRespondida | undefined> {
  const db = await banco();
  return db.get("anamneses", id);
}

export async function listarAnamnesesDaPessoa(
  pessoaId: string,
): Promise<AnamneseRespondida[]> {
  const db = await banco();
  const todas = await db.getAllFromIndex("anamneses", "porPessoa", pessoaId);
  return todas.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
}

// --------------------------------------------------------------------------
// Sessoes
// --------------------------------------------------------------------------
export async function salvarSessao(s: Sessao): Promise<void> {
  const db = await banco();
  await db.put("sessoes", s);
}

export async function lerSessao(id: string): Promise<Sessao | undefined> {
  const db = await banco();
  return db.get("sessoes", id);
}

export async function listarSessoesDaPessoa(
  pessoaId: string,
): Promise<Sessao[]> {
  const db = await banco();
  const todas = await db.getAllFromIndex("sessoes", "porPessoa", pessoaId);
  return todas.sort((a, b) => b.iniciadaEm.localeCompare(a.iniciadaEm));
}

export async function listarSessoes(): Promise<Sessao[]> {
  const db = await banco();
  const todas = await db.getAll("sessoes");
  return todas.sort((a, b) => b.iniciadaEm.localeCompare(a.iniciadaEm));
}

// --------------------------------------------------------------------------
// Eventos de leitura. Nunca sobrescrever o resultado bruto (dossie, p. 37).
// --------------------------------------------------------------------------
export async function salvarEvento(e: EventoLeitura): Promise<void> {
  const db = await banco();
  await db.put("eventos", e);
}

export async function listarEventosDaSessao(
  sessaoId: string,
): Promise<EventoLeitura[]> {
  const db = await banco();
  const todos = await db.getAllFromIndex("eventos", "porSessao", sessaoId);
  return todos.sort((a, b) => a.sequencia - b.sequencia);
}

export async function apagarEvento(id: string): Promise<void> {
  const db = await banco();
  await db.delete("eventos", id);
}

// --------------------------------------------------------------------------
// Sinteses. Cada correcao gera nova versao (dossie, p. 40).
// --------------------------------------------------------------------------
export async function salvarSintese(s: Sintese): Promise<void> {
  const db = await banco();
  await db.put("sinteses", s);
}

export async function listarSintesesDaSessao(
  sessaoId: string,
): Promise<Sintese[]> {
  const db = await banco();
  const todas = await db.getAllFromIndex("sinteses", "porSessao", sessaoId);
  return todas.sort((a, b) =>
    b.procedencia.geradoEm.localeCompare(a.procedencia.geradoEm),
  );
}

// --------------------------------------------------------------------------
// Laminas cadastradas pelo terapeuta
// --------------------------------------------------------------------------
export async function salvarLaminaCustom(l: Lamina): Promise<void> {
  const db = await banco();
  await db.put("laminasCustom", l);
}

export async function listarLaminasCustom(): Promise<Lamina[]> {
  const db = await banco();
  return db.getAll("laminasCustom");
}

export async function apagarLaminaCustom(id: string): Promise<void> {
  const db = await banco();
  await db.delete("laminasCustom", id);
}

// --------------------------------------------------------------------------
// Backup
// --------------------------------------------------------------------------
export interface Backup {
  formato: "radiestesia-backup";
  versao: number;
  exportadoEm: string;
  pessoas: Pessoa[];
  anamneses: AnamneseRespondida[];
  sessoes: Sessao[];
  eventos: EventoLeitura[];
  sinteses: Sintese[];
  laminasCustom: Lamina[];
}

export async function exportarTudo(): Promise<Backup> {
  const db = await banco();
  return {
    formato: "radiestesia-backup",
    versao: VERSAO_BANCO,
    exportadoEm: agora(),
    pessoas: await db.getAll("pessoas"),
    anamneses: await db.getAll("anamneses"),
    sessoes: await db.getAll("sessoes"),
    eventos: await db.getAll("eventos"),
    sinteses: await db.getAll("sinteses"),
    laminasCustom: await db.getAll("laminasCustom"),
  };
}

/**
 * Importa um backup somando ao que existe. Registros com o mesmo ID sao
 * substituidos; nada e apagado silenciosamente.
 */
export async function importarTudo(b: Backup): Promise<{ gravados: number }> {
  if (b?.formato !== "radiestesia-backup") {
    throw new Error("Arquivo não é um backup deste aplicativo.");
  }
  const db = await banco();
  let gravados = 0;
  const tx = db.transaction(
    ["pessoas", "anamneses", "sessoes", "eventos", "sinteses", "laminasCustom"],
    "readwrite",
  );
  for (const p of b.pessoas ?? []) {
    await tx.objectStore("pessoas").put(p);
    gravados++;
  }
  for (const a of b.anamneses ?? []) {
    await tx.objectStore("anamneses").put(a);
    gravados++;
  }
  for (const s of b.sessoes ?? []) {
    await tx.objectStore("sessoes").put(s);
    gravados++;
  }
  for (const e of b.eventos ?? []) {
    await tx.objectStore("eventos").put(e);
    gravados++;
  }
  for (const t of b.sinteses ?? []) {
    await tx.objectStore("sinteses").put(t);
    gravados++;
  }
  for (const l of b.laminasCustom ?? []) {
    await tx.objectStore("laminasCustom").put(l);
    gravados++;
  }
  await tx.done;
  return { gravados };
}

// --------------------------------------------------------------------------
// Preferencias do terapeuta (localStorage: nao e dado de pessoa atendida)
// --------------------------------------------------------------------------
const CHAVE_TERAPEUTA = "radiestesia:terapeuta";

export function lerNomeTerapeuta(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(CHAVE_TERAPEUTA) ?? "";
}

export function salvarNomeTerapeuta(nome: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CHAVE_TERAPEUTA, nome);
}
