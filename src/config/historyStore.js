// Simple persistent Q&A history store
import fs from "fs";
import path from "path";
import { DEFAULT_BOT_ID, normalizeBotId } from "./botContext.js";

const DATA_PATH = path.resolve("data/history.json");
const DATA_DIR = path.dirname(DATA_PATH);
let history = [];
let loaded = false;

function loadHistory() {
  if (loaded) return;
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, "utf8");
      const parsed = JSON.parse(raw);
      history = Array.isArray(parsed)
        ? parsed.map((entry) => ({
            botId: normalizeBotId(entry?.botId || DEFAULT_BOT_ID),
            ...entry,
          }))
        : [];
    }
  } catch (e) {
    console.error("No se pudo cargar el historial", e);
    history = [];
  }
  loaded = true;
}

function ensureDataDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error("No se pudo crear el directorio data", e);
  }
}

function persistHistory() {
  try {
    ensureDataDir();
    fs.writeFileSync(DATA_PATH, JSON.stringify(history, null, 2), "utf8");
  } catch (e) {}
}

export function getHistory(botId) {
  loadHistory();
  const resolved = normalizeBotId(botId);
  return history.filter((item) => normalizeBotId(item?.botId) === resolved).slice();
}

export function addHistoryEntry(entry, botId) {
  loadHistory();
  history.push({
    botId: normalizeBotId(botId || entry?.botId || DEFAULT_BOT_ID),
    ...entry,
    timestamp: Date.now(),
  });
  persistHistory();
}

export function getHistoryByChatId(chatId, limit = 100, botId) {
  loadHistory();
  const normalized = String(chatId);
  const resolved = normalizeBotId(botId);
  const filtered = history.filter(
    (item) => String(item.chatId) === normalized && normalizeBotId(item?.botId) === resolved
  );
  return filtered.slice(-limit);
}

export function clearHistoryForChatId(chatId, botId) {
  loadHistory();
  const normalized = String(chatId);
  const resolved = normalizeBotId(botId);
  history = history.filter(
    (item) =>
      !(String(item.chatId) === normalized && normalizeBotId(item?.botId) === resolved)
  );
  persistHistory();
}

export function clearHistory(botId) {
  loadHistory();
  if (botId) {
    const resolved = normalizeBotId(botId);
    history = history.filter((item) => normalizeBotId(item?.botId) !== resolved);
  } else {
    history = [];
  }
  persistHistory();
}
