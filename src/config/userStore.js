import fs from "fs/promises";
import path from "path";
import { DEFAULT_BOT_ID, normalizeBotId } from "./botContext.js";

const dataDir = path.resolve(process.cwd(), "data");
const usersPath = path.join(dataDir, "telegramUsers.json");

const userStore = [];

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function loadUsers() {
  try {
    const raw = await fs.readFile(usersPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const normalized = parsed.map((user) => ({
        botId: normalizeBotId(user?.botId || DEFAULT_BOT_ID),
        ...user,
      }));
      userStore.splice(0, userStore.length, ...normalized);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("No se pudieron cargar usuarios de Telegram", error);
    }
  }
}

async function persistUsers() {
  try {
    await ensureDataDir();
    await fs.writeFile(usersPath, JSON.stringify(userStore, null, 2), "utf8");
  } catch (error) {
    console.error("No se pudieron guardar usuarios de Telegram", error);
  }
}

export const usersReady = loadUsers();

export function listTelegramUsers(botId) {
  const resolved = normalizeBotId(botId);
  return userStore
    .filter((u) => normalizeBotId(u?.botId) === resolved)
    .map((u) => ({ ...u }));
}

export function getTelegramUser(chatId, botId) {
  const key = String(chatId);
  const resolved = normalizeBotId(botId);
  return userStore.find((u) => String(u.chatId) === key && normalizeBotId(u?.botId) === resolved) ?? null;
}

export function upsertTelegramUser({ chatId, username, firstName, lastName, type, botId } = {}) {
  const key = String(chatId);
  if (!key || key === "undefined" || key === "null") return null;
  const resolved = normalizeBotId(botId);

  const now = new Date().toISOString();
  let user = userStore.find((u) => String(u.chatId) === key && normalizeBotId(u?.botId) === resolved);
  if (!user) {
    user = {
      chatId: key,
      botId: resolved,
      username: username ? String(username) : "",
      firstName: firstName ? String(firstName) : "",
      lastName: lastName ? String(lastName) : "",
      type: type ? String(type) : "",
      firstInteractionAt: now,
      lastInteractionAt: now,
      isBlocked: false,
      blockedAt: null,
      lastError: null,
      updatedAt: now,
      createdAt: now,
    };
    userStore.push(user);
    persistUsers();
    return { ...user };
  }

  user.username = username != null ? String(username) : user.username;
  user.firstName = firstName != null ? String(firstName) : user.firstName;
  user.lastName = lastName != null ? String(lastName) : user.lastName;
  user.type = type != null ? String(type) : user.type;
  user.lastInteractionAt = now;
  user.updatedAt = now;

  persistUsers();
  return { ...user };
}

export function markTelegramUserBlocked(chatId, errorMessage = "", botId) {
  const key = String(chatId);
  const resolved = normalizeBotId(botId);
  const now = new Date().toISOString();
  const user = userStore.find((u) => String(u.chatId) === key && normalizeBotId(u?.botId) === resolved);
  if (!user) return null;
  user.isBlocked = true;
  user.blockedAt = user.blockedAt || now;
  user.lastError = errorMessage ? String(errorMessage) : user.lastError;
  user.updatedAt = now;
  persistUsers();
  return { ...user };
}

export function markTelegramUserError(chatId, errorMessage = "", botId) {
  const key = String(chatId);
  const resolved = normalizeBotId(botId);
  const now = new Date().toISOString();
  const user = userStore.find((u) => String(u.chatId) === key && normalizeBotId(u?.botId) === resolved);
  if (!user) return null;
  user.lastError = errorMessage ? String(errorMessage) : user.lastError;
  user.updatedAt = now;
  persistUsers();
  return { ...user };
}

export function removeTelegramUser(chatId, botId) {
  const key = String(chatId);
  const resolved = normalizeBotId(botId);
  const idx = userStore.findIndex((u) => String(u.chatId) === key && normalizeBotId(u?.botId) === resolved);
  if (idx === -1) return false;
  userStore.splice(idx, 1);
  persistUsers();
  return true;
}
