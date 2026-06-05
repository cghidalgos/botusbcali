import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { DEFAULT_BOT_ID, normalizeBotId } from "./botContext.js";

const dataDir = path.resolve(process.cwd(), "data");
const botsPath = path.join(dataDir, "bots.json");

const botStore = [];
let ready = false;

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

function sanitizeString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function normalizeBotRecord(bot) {
  const id = normalizeBotId(bot?.id || bot?.botId || "");
  return {
    id,
    name: sanitizeString(bot?.name, "Bot"),
    imageUrl: sanitizeString(bot?.imageUrl, ""),
    telegramToken: sanitizeString(bot?.telegramToken, ""),
    claudeApiKey: sanitizeString(bot?.claudeApiKey || bot?.openaiApiKey, ""),
    status: bot?.status === "inactive" ? "inactive" : "active",
    createdAt: bot?.createdAt || new Date().toISOString(),
    updatedAt: bot?.updatedAt || new Date().toISOString(),
  };
}

async function loadBots() {
  try {
    const raw = await fs.readFile(botsPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      botStore.splice(0, botStore.length, ...parsed.map(normalizeBotRecord));
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("No se pudieron cargar bots", error);
    }
  }
  ready = true;
}

async function persistBots() {
  try {
    await ensureDataDir();
    await fs.writeFile(botsPath, JSON.stringify(botStore, null, 2), "utf8");
  } catch (error) {
    console.error("No se pudieron guardar bots", error);
  }
}

export const botsReady = loadBots();

export async function ensureDefaultBot() {
  await botsReady;
  if (botStore.length) return botStore[0];

  const defaultBot = normalizeBotRecord({
    id: DEFAULT_BOT_ID,
    name: "Bot principal",
    imageUrl: "",
    telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
    claudeApiKey: process.env.ANTHROPIC_API_KEY || "",
    status: "active",
  });

  botStore.push(defaultBot);
  await persistBots();
  return defaultBot;
}

export function listBots() {
  return botStore.map((bot) => ({ ...bot }));
}

export function getBotById(botId) {
  const resolved = normalizeBotId(botId);
  return botStore.find((bot) => bot.id === resolved) || null;
}

export function createBot(data) {
  const id = normalizeBotId(data?.id || data?.botId || crypto.randomUUID());
  if (botStore.some((bot) => bot.id === id)) {
    throw new Error("Bot ID ya existe");
  }

  const bot = normalizeBotRecord({
    ...data,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  botStore.push(bot);
  persistBots();
  return { ...bot };
}

export function updateBot(botId, updates) {
  const resolved = normalizeBotId(botId);
  const index = botStore.findIndex((bot) => bot.id === resolved);
  if (index === -1) return null;

  const current = botStore[index];
  const next = normalizeBotRecord({
    ...current,
    ...updates,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  });

  botStore[index] = next;
  persistBots();
  return { ...next };
}

export function deleteBot(botId) {
  const resolved = normalizeBotId(botId);
  const index = botStore.findIndex((bot) => bot.id === resolved);
  if (index === -1) return false;
  botStore.splice(index, 1);
  persistBots();
  return true;
}
