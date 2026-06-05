import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { DEFAULT_BOT_ID, normalizeBotId } from "./botContext.js";

const dataDir = path.resolve(process.cwd(), "data");
const feedbackPath = path.join(dataDir, "feedback.json");

const feedbackState = {
  entries: [],
};

const MAX_ENTRIES = 2000;

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function loadFeedback() {
  try {
    const raw = await fs.readFile(feedbackPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.entries)) {
      feedbackState.entries = parsed.entries;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("No se pudo cargar feedback", error);
    }
  }
}

async function persistFeedback() {
  try {
    await ensureDataDir();
    await fs.writeFile(feedbackPath, JSON.stringify(feedbackState, null, 2), "utf8");
  } catch (error) {
    console.error("No se pudo guardar feedback", error);
  }
}

export const feedbackReady = loadFeedback();

/**
 * Registra la calificación (👍/👎) de una respuesta.
 * rating: "up" | "down"
 */
export async function recordFeedback({ botId, chatId, question, answer, rating } = {}) {
  const entry = {
    id: crypto.randomUUID(),
    botId: normalizeBotId(botId || DEFAULT_BOT_ID),
    chatId: chatId != null ? String(chatId) : null,
    question: String(question || "").slice(0, 1000),
    answer: String(answer || "").slice(0, 4000),
    rating: rating === "down" ? "down" : "up",
    createdAt: new Date().toISOString(),
  };

  feedbackState.entries.unshift(entry);
  if (feedbackState.entries.length > MAX_ENTRIES) {
    feedbackState.entries.length = MAX_ENTRIES;
  }

  await persistFeedback();
  return entry;
}

export function listFeedback(botId, { rating, resolved } = {}) {
  const resolvedBot = normalizeBotId(botId || DEFAULT_BOT_ID);
  return feedbackState.entries.filter((e) => {
    if (normalizeBotId(e.botId) !== resolvedBot) return false;
    if (rating && e.rating !== rating) return false;
    if (resolved === true && !e.resolved) return false;
    if (resolved === false && e.resolved) return false;
    return true;
  });
}

export function getFeedbackById(id, botId) {
  const resolved = normalizeBotId(botId || DEFAULT_BOT_ID);
  return feedbackState.entries.find(
    (e) => e.id === id && normalizeBotId(e.botId) === resolved
  ) || null;
}

/**
 * Marca una entrada de feedback como resuelta (se guardó una respuesta correcta).
 */
export async function markFeedbackResolved(id, botId, resolvedAnswer) {
  const resolved = normalizeBotId(botId || DEFAULT_BOT_ID);
  const entry = feedbackState.entries.find(
    (e) => e.id === id && normalizeBotId(e.botId) === resolved
  );
  if (!entry) return null;
  entry.resolved = true;
  entry.resolvedAnswer = String(resolvedAnswer || "").slice(0, 4000);
  entry.resolvedAt = new Date().toISOString();
  await persistFeedback();
  return entry;
}

export function getFeedbackStats(botId) {
  const resolvedBot = normalizeBotId(botId || DEFAULT_BOT_ID);
  const entries = feedbackState.entries.filter((e) => normalizeBotId(e.botId) === resolvedBot);
  const up = entries.filter((e) => e.rating === "up").length;
  const down = entries.filter((e) => e.rating === "down").length;
  const pendingDown = entries.filter((e) => e.rating === "down" && !e.resolved).length;
  const resolvedDown = entries.filter((e) => e.rating === "down" && e.resolved).length;
  return { up, down, total: up + down, pendingDown, resolvedDown };
}
