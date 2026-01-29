import fs from "fs/promises";
import path from "path";

const dataDir = path.resolve(process.cwd(), "data");
const memoryPath = path.join(dataDir, "memory.json");

const memoryState = {
  chats: {},
};

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function loadMemory() {
  try {
    const raw = await fs.readFile(memoryPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.chats) {
      memoryState.chats = parsed.chats;
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

export function getMemory(chatId) {
  if (!chatId) return "";
  return memoryState.chats[chatId] || "";
}

export function setMemory(chatId, summary) {
  if (!chatId) return;
  memoryState.chats[chatId] = summary || "";
  persistMemory();
}

export function clearMemory(chatId) {
  if (!chatId) return;
  delete memoryState.chats[chatId];
  persistMemory();
}
