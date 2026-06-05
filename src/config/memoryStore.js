import fs from "fs/promises";
import path from "path";
import { DEFAULT_BOT_ID, normalizeBotId } from "./botContext.js";

const dataDir = path.resolve(process.cwd(), "data");
const memoryPath = path.join(dataDir, "memory.json");

const memoryState = {
  chats: {},
  conversations: {},
};

// Máximo de turnos (pares pregunta/respuesta) que se conservan por chat.
const MAX_TURNS = Number.parseInt(process.env.CONVERSATION_MAX_TURNS || "12", 10);

// Largo máximo (caracteres) que se guarda de cada turno para reenviar como
// historial de contexto. La respuesta que ve el usuario NO se recorta: este
// tope solo aplica a la copia que se replay-ea en turnos siguientes, donde solo
// importa la coherencia, no el texto íntegro. Sin esto, una respuesta de "dame
// todo el documento" (hasta 4000 chars) se reenviaba en cada turno posterior.
const USER_TURN_CHARS = Number.parseInt(process.env.CONVERSATION_USER_CHARS || "1500", 10);
const ASSISTANT_TURN_CHARS = Number.parseInt(process.env.CONVERSATION_ASSISTANT_CHARS || "1500", 10);

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function loadMemory() {
  try {
    const raw = await fs.readFile(memoryPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (parsed.chats) memoryState.chats = parsed.chats;
      if (parsed.conversations) memoryState.conversations = parsed.conversations;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("No se pudo cargar memoria", error);
    }
  }
}

async function persistMemory() {
  try {
    await ensureDataDir();
    await fs.writeFile(memoryPath, JSON.stringify(memoryState, null, 2), "utf8");
  } catch (error) {
    console.error("No se pudo guardar memoria", error);
  }
}

export const memoryReady = loadMemory();

export function getMemory(botId, chatId) {
  if (chatId === undefined) {
    const legacyChatId = botId;
    const resolved = DEFAULT_BOT_ID;
    if (!legacyChatId) return "";
    return memoryState.chats?.[resolved]?.[legacyChatId] || "";
  }

  if (!chatId) return "";
  const resolved = normalizeBotId(botId);
  return memoryState.chats?.[resolved]?.[chatId] || "";
}

export function setMemory(botId, chatId, summary) {
  if (summary === undefined) {
    const legacyChatId = botId;
    const legacySummary = chatId;
    if (!legacyChatId) return;
    const resolved = DEFAULT_BOT_ID;
    if (!memoryState.chats[resolved]) memoryState.chats[resolved] = {};
    memoryState.chats[resolved][legacyChatId] = legacySummary || "";
    persistMemory();
    return;
  }

  if (!chatId) return;
  const resolved = normalizeBotId(botId);
  if (!memoryState.chats[resolved]) memoryState.chats[resolved] = {};
  memoryState.chats[resolved][chatId] = summary || "";
  persistMemory();
}

export function clearMemory(botId, chatId) {
  if (chatId === undefined) {
    const legacyChatId = botId;
    if (!legacyChatId) return;
    const resolved = DEFAULT_BOT_ID;
    if (memoryState.chats[resolved]) {
      delete memoryState.chats[resolved][legacyChatId];
    }
    if (memoryState.conversations[resolved]) {
      delete memoryState.conversations[resolved][legacyChatId];
    }
    persistMemory();
    return;
  }

  if (!chatId) return;
  const resolved = normalizeBotId(botId);
  if (memoryState.chats[resolved]) {
    delete memoryState.chats[resolved][chatId];
  }
  if (memoryState.conversations[resolved]) {
    delete memoryState.conversations[resolved][chatId];
  }
  persistMemory();
}

/**
 * Devuelve los turnos recientes de la conversación como array de mensajes
 * en formato { role: "user" | "assistant", content: string }.
 */
export function getConversation(botId, chatId) {
  if (!chatId) return [];
  const resolved = normalizeBotId(botId);
  const turns = memoryState.conversations?.[resolved]?.[chatId];
  return Array.isArray(turns) ? turns : [];
}

/**
 * Agrega un par pregunta/respuesta a la conversación y mantiene solo
 * los últimos MAX_TURNS pares (ventana deslizante).
 */
export function appendConversationTurn(botId, chatId, userText, assistantText) {
  if (!chatId) return;
  const resolved = normalizeBotId(botId);
  if (!memoryState.conversations[resolved]) {
    memoryState.conversations[resolved] = {};
  }
  const current = Array.isArray(memoryState.conversations[resolved][chatId])
    ? memoryState.conversations[resolved][chatId]
    : [];

  current.push({ role: "user", content: String(userText || "").slice(0, USER_TURN_CHARS) });
  current.push({ role: "assistant", content: String(assistantText || "").slice(0, ASSISTANT_TURN_CHARS) });

  // Conservar solo los últimos MAX_TURNS pares (2 mensajes por par).
  const maxMessages = MAX_TURNS * 2;
  const trimmed = current.length > maxMessages ? current.slice(-maxMessages) : current;

  memoryState.conversations[resolved][chatId] = trimmed;
  persistMemory();
}

export function clearConversation(botId, chatId) {
  if (!chatId) return;
  const resolved = normalizeBotId(botId);
  if (memoryState.conversations[resolved]) {
    delete memoryState.conversations[resolved][chatId];
  }
  // También limpiar el resumen de memoria asociado.
  if (memoryState.chats[resolved]) {
    delete memoryState.chats[resolved][chatId];
  }
  persistMemory();
}
