import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { DEFAULT_BOT_ID, normalizeBotId } from "./botContext.js";

const dataDir = path.resolve(process.cwd(), "data");
const errorsPath = path.join(dataDir, "error-log.json");

const errorState = {
  entries: [],
};

const MAX_ENTRIES = 500;

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function loadErrors() {
  try {
    const raw = await fs.readFile(errorsPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.entries)) {
      errorState.entries = parsed.entries;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("No se pudieron cargar errores", error);
    }
  }
}

async function persistErrors() {
  try {
    await ensureDataDir();
    await fs.writeFile(errorsPath, JSON.stringify(errorState, null, 2), "utf8");
  } catch (error) {
    console.error("No se pudieron guardar errores", error);
  }
}

export const errorsReady = loadErrors();

export async function recordError(type, message, { botId, context } = {}) {
  const entry = {
    id: crypto.randomUUID(),
    botId: normalizeBotId(botId || DEFAULT_BOT_ID),
    type: String(type || "error"),
    message: String(message || "Error desconocido"),
    context: context || null,
    createdAt: new Date().toISOString(),
  };

  errorState.entries.unshift(entry);
  if (errorState.entries.length > MAX_ENTRIES) {
    errorState.entries.length = MAX_ENTRIES;
  }

  await persistErrors();
}

export function getRecentErrors(botId, limit = 100) {
  const resolved = normalizeBotId(botId || DEFAULT_BOT_ID);
  return errorState.entries
    .filter((entry) => normalizeBotId(entry?.botId) === resolved)
    .slice(0, limit);
}

export async function clearErrors(botId) {
  if (botId) {
    const resolved = normalizeBotId(botId);
    errorState.entries = errorState.entries.filter(
      (entry) => normalizeBotId(entry?.botId) !== resolved
    );
  } else {
    errorState.entries = [];
  }
  await persistErrors();
}
