import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { DEFAULT_BOT_ID, normalizeBotId } from "./botContext.js";

const dataDir = path.resolve(process.cwd(), "data");
const gapsPath = path.join(dataDir, "knowledge-gaps.json");

const gapsState = {
  entries: [],
};

const MAX_ENTRIES = 1000;

function normalizeQuestion(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function loadGaps() {
  try {
    const raw = await fs.readFile(gapsPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.entries)) {
      gapsState.entries = parsed.entries;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("No se pudieron cargar vacíos de conocimiento", error);
    }
  }
}

async function persistGaps() {
  try {
    await ensureDataDir();
    await fs.writeFile(gapsPath, JSON.stringify(gapsState, null, 2), "utf8");
  } catch (error) {
    console.error("No se pudieron guardar vacíos de conocimiento", error);
  }
}

export const knowledgeGapsReady = loadGaps();

/**
 * Frases que indican que el bot NO pudo responder (vacío de conocimiento).
 */
const GAP_MARKERS = [
  /no tengo (esa |la )?(informaci[oó]n|datos)/i,
  /no (cuento con|dispongo de|encontr[eé]|hall[eé])/i,
  /no (aparece|est[aá]) (en los documentos|disponible|registrad)/i,
  /no tengo acceso a/i,
  /no puedo (responder|ayudarte con eso|brindar)/i,
  /informaci[oó]n no (disponible|encontrada)/i,
  /no se encuentra en (los|la) (documentos|base)/i,
];

export function isKnowledgeGap(answer) {
  const text = String(answer || "");
  if (!text || text.length < 8) return false;
  return GAP_MARKERS.some((re) => re.test(text));
}

/**
 * Registra (o incrementa) un vacío de conocimiento. Si ya existe una pregunta
 * normalizada igual, aumenta el contador en lugar de duplicar.
 */
export async function recordKnowledgeGap({ botId, question, answer, category, chatId } = {}) {
  const resolvedBot = normalizeBotId(botId || DEFAULT_BOT_ID);
  const norm = normalizeQuestion(question);
  if (!norm) return null;

  const existing = gapsState.entries.find(
    (e) => normalizeBotId(e.botId) === resolvedBot && e.normalized === norm && !e.resolved
  );

  if (existing) {
    existing.count = (existing.count || 1) + 1;
    existing.lastSeenAt = new Date().toISOString();
    if (answer) existing.lastAnswer = String(answer).slice(0, 1000);
    await persistGaps();
    return existing;
  }

  const entry = {
    id: crypto.randomUUID(),
    botId: resolvedBot,
    question: String(question || "").slice(0, 500),
    normalized: norm,
    lastAnswer: String(answer || "").slice(0, 1000),
    category: category || "general",
    chatId: chatId != null ? String(chatId) : null,
    count: 1,
    resolved: false,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  };

  gapsState.entries.unshift(entry);
  if (gapsState.entries.length > MAX_ENTRIES) {
    gapsState.entries.length = MAX_ENTRIES;
  }
  await persistGaps();
  return entry;
}

export function listKnowledgeGaps(botId, { includeResolved = false } = {}) {
  const resolvedBot = normalizeBotId(botId || DEFAULT_BOT_ID);
  return gapsState.entries
    .filter((e) => normalizeBotId(e.botId) === resolvedBot && (includeResolved || !e.resolved))
    .sort((a, b) => (b.count || 1) - (a.count || 1));
}

export function getKnowledgeGapsByCategory(botId) {
  const items = listKnowledgeGaps(botId);
  const groups = {};
  for (const item of items) {
    const cat = item.category || "general";
    if (!groups[cat]) groups[cat] = { category: cat, total: 0, items: [] };
    groups[cat].total += item.count || 1;
    groups[cat].items.push(item);
  }
  return Object.values(groups).sort((a, b) => b.total - a.total);
}

export async function resolveKnowledgeGap(id, botId) {
  const resolvedBot = normalizeBotId(botId || DEFAULT_BOT_ID);
  const entry = gapsState.entries.find(
    (e) => e.id === id && normalizeBotId(e.botId) === resolvedBot
  );
  if (!entry) return null;
  entry.resolved = true;
  entry.resolvedAt = new Date().toISOString();
  await persistGaps();
  return entry;
}

export function getKnowledgeGapsStats(botId) {
  const resolvedBot = normalizeBotId(botId || DEFAULT_BOT_ID);
  const entries = gapsState.entries.filter((e) => normalizeBotId(e.botId) === resolvedBot);
  const pending = entries.filter((e) => !e.resolved);
  return {
    pending: pending.length,
    resolved: entries.filter((e) => e.resolved).length,
    totalOccurrences: pending.reduce((acc, e) => acc + (e.count || 1), 0),
  };
}
