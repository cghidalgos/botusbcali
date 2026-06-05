import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { DEFAULT_BOT_ID, normalizeBotId } from "./botContext.js";

const dataDir = path.resolve(process.cwd(), "data");
const usersPath = path.join(dataDir, "auth-users.json");
const tokensPath = path.join(dataDir, "auth-tokens.json");

let users = [];
let tokens = [];
let ready = false;

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const derived = crypto.pbkdf2Sync(String(password), salt, 100000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
}

async function loadAuth() {
  try {
    const rawUsers = await fs.readFile(usersPath, "utf8");
    const parsedUsers = JSON.parse(rawUsers);
    if (Array.isArray(parsedUsers)) {
      users = parsedUsers;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("No se pudieron cargar usuarios", error);
    }
  }

  try {
    const rawTokens = await fs.readFile(tokensPath, "utf8");
    const parsedTokens = JSON.parse(rawTokens);
    if (Array.isArray(parsedTokens)) {
      tokens = parsedTokens;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("No se pudieron cargar tokens", error);
    }
  }

  ready = true;
}

async function persistUsers() {
  try {
    await ensureDataDir();
    await fs.writeFile(usersPath, JSON.stringify(users, null, 2), "utf8");
  } catch (error) {
    console.error("No se pudieron guardar usuarios", error);
  }
}

async function persistTokens() {
  try {
    await ensureDataDir();
    await fs.writeFile(tokensPath, JSON.stringify(tokens, null, 2), "utf8");
  } catch (error) {
    console.error("No se pudieron guardar tokens", error);
  }
}

export const authReady = loadAuth();

export async function ensureAdminFromEnv() {
  await authReady;
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "").trim();

  if (!email || !password) return null;
  if (users.some((u) => u.email === email)) return null;

  const { salt, hash } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    email,
    role: "admin",
    botIds: [],
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(user);
  await persistUsers();
  return { ...user, passwordHash: undefined, passwordSalt: undefined };
}

export async function ensureManagerFromEnv() {
  await authReady;
  const email = String(process.env.MANAGER_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.MANAGER_PASSWORD || "").trim();
  const botIdRaw = String(process.env.MANAGER_BOT_ID || "").trim();
  const botId = normalizeBotId(botIdRaw || DEFAULT_BOT_ID);

  if (!email || !password) return null;
  if (users.some((u) => u.email === email)) return null;

  const { salt, hash } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    email,
    role: "manager",
    botIds: [botId],
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(user);
  await persistUsers();
  return { ...user, passwordHash: undefined, passwordSalt: undefined };
}

export function listUsers() {
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    botIds: Array.isArray(u.botIds) ? u.botIds : [],
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));
}

export function getUserById(id) {
  return users.find((u) => u.id === id) || null;
}

export function createUser({ email, password, role = "manager", botIds = [] }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error("Email y password requeridos");
  }
  if (users.some((u) => u.email === normalizedEmail)) {
    throw new Error("Email ya existe");
  }

  const { salt, hash } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    role: role === "admin" ? "admin" : "manager",
    botIds: Array.isArray(botIds) ? botIds : [],
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(user);
  persistUsers();
  return { ...user, passwordHash: undefined, passwordSalt: undefined };
}

export function updateUser(id, updates = {}) {
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return null;

  const current = users[index];
  const next = { ...current };

  if (typeof updates.email === "string" && updates.email.trim()) {
    next.email = updates.email.trim().toLowerCase();
  }

  if (typeof updates.password === "string" && updates.password.trim()) {
    const { salt, hash } = hashPassword(updates.password.trim());
    next.passwordSalt = salt;
    next.passwordHash = hash;
  }

  if (typeof updates.role === "string") {
    next.role = updates.role === "admin" ? "admin" : "manager";
  }

  if (Array.isArray(updates.botIds)) {
    next.botIds = updates.botIds;
  }

  next.updatedAt = new Date().toISOString();
  users[index] = next;
  persistUsers();

  return { ...next, passwordHash: undefined, passwordSalt: undefined };
}

export function deleteUser(id) {
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return false;
  users.splice(index, 1);
  persistUsers();
  return true;
}

export function authenticateUser(email, password) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const user = users.find((u) => u.email === normalizedEmail);
  if (!user) return null;

  if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    botIds: Array.isArray(user.botIds) ? user.botIds : [],
  };
}

export function issueToken(userId, { ttlMs = 30 * 24 * 60 * 60 * 1000 } = {}) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const entry = {
    token,
    userId,
    createdAt: now,
    expiresAt: now + ttlMs,
  };
  tokens.push(entry);
  persistTokens();
  return token;
}

export function revokeToken(token) {
  const index = tokens.findIndex((t) => t.token === token);
  if (index === -1) return false;
  tokens.splice(index, 1);
  persistTokens();
  return true;
}

export function validateToken(token) {
  const now = Date.now();
  const entry = tokens.find((t) => t.token === token);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    revokeToken(token);
    return null;
  }

  const user = getUserById(entry.userId);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    botIds: Array.isArray(user.botIds) ? user.botIds : [],
  };
}

export function isAuthEnabled() {
  return users.length > 0;
}
