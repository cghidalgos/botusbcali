// Almacén persistente de preguntas de seguimiento sugeridas por mensaje.
//
// Los botones de seguimiento (sg_0/1/2) se resuelven por (bot, chat, message_id).
// Antes esto vivía solo en memoria, así que cada reinicio del contenedor dejaba
// muertos los botones de todos los mensajes anteriores. Aquí lo persistimos a
// disco (data/ es un volumen montado) para que sobrevivan a los redespliegues.
import fs from "fs";
import path from "path";
import { DEFAULT_BOT_ID, normalizeBotId } from "./botContext.js";

const DATA_PATH = path.resolve("data/followups.json");
const DATA_DIR = path.dirname(DATA_PATH);

// Expiración y tope para acotar el archivo.
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const MAX_ENTRIES = 5000;

// Mapa key -> { followUps: string[], ts: number }
let store = {};
let loaded = false;

function buildKey(botId, chatId, messageId) {
  return `${normalizeBotId(botId || DEFAULT_BOT_ID)}::${String(chatId)}::${String(messageId)}`;
}

function pruneExpired() {
  const now = Date.now();
  let changed = false;
  for (const key of Object.keys(store)) {
    if (!store[key] || now - (store[key].ts || 0) > TTL_MS) {
      delete store[key];
      changed = true;
    }
  }
  return changed;
}

function load() {
  if (loaded) return;
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, "utf8");
      const parsed = JSON.parse(raw);
      store = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    }
  } catch (e) {
    console.error("No se pudo cargar followups.json", e);
    store = {};
  }
  loaded = true;
  if (pruneExpired()) persist();
}

function ensureDataDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error("No se pudo crear el directorio data", e);
  }
}

function persist() {
  try {
    ensureDataDir();
    fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch (e) {
    // No bloquear la conversación si falla la escritura.
  }
}

function enforceLimit() {
  const keys = Object.keys(store);
  if (keys.length <= MAX_ENTRIES) return;
  // Eliminar las más antiguas por timestamp.
  keys
    .sort((a, b) => (store[a]?.ts || 0) - (store[b]?.ts || 0))
    .slice(0, keys.length - MAX_ENTRIES)
    .forEach((key) => delete store[key]);
}

export function rememberFollowUps({ botId, chatId, messageId, followUps }) {
  if (messageId == null || !Array.isArray(followUps) || !followUps.length) return;
  load();
  store[buildKey(botId, chatId, messageId)] = { followUps, ts: Date.now() };
  enforceLimit();
  persist();
}

export function getFollowUps({ botId, chatId, messageId }) {
  if (messageId == null) return null;
  load();
  const entry = store[buildKey(botId, chatId, messageId)];
  if (!entry) return null;
  if (Date.now() - (entry.ts || 0) > TTL_MS) {
    delete store[buildKey(botId, chatId, messageId)];
    persist();
    return null;
  }
  return Array.isArray(entry.followUps) ? entry.followUps : null;
}
