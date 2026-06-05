import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { DEFAULT_BOT_ID, normalizeBotId } from "./botContext.js";

const dataDir = path.resolve(process.cwd(), "data");
const documentsPath = path.join(dataDir, "documents.json");

const documentStore = [];

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function loadDocuments() {
  try {
    const raw = await fs.readFile(documentsPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const normalized = parsed.map((doc) => ({
        botId: normalizeBotId(doc?.botId || DEFAULT_BOT_ID),
        ...doc,
      }));
      documentStore.splice(0, documentStore.length, ...normalized);
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("No se pudieron cargar documentos", error);
    }
  }
}

async function persistDocuments() {
  try {
    await ensureDataDir();
    await fs.writeFile(documentsPath, JSON.stringify(documentStore, null, 2), "utf8");
  } catch (error) {
    console.error("No se pudieron guardar documentos", error);
  }
}

export const documentsReady = loadDocuments();

export function listDocuments(botId) {
  const resolved = normalizeBotId(botId);
  return documentStore
    .filter((doc) => normalizeBotId(doc?.botId) === resolved)
    .map((doc) => ({ ...doc }));
}

export function getDocumentById(id, botId) {
  if (botId) {
    const resolved = normalizeBotId(botId);
    return documentStore.find((doc) => doc.id === id && normalizeBotId(doc?.botId) === resolved) ?? null;
  }
  return documentStore.find((doc) => doc.id === id) ?? null;
}

export function addDocument(metadata, botId) {
  const { summary, ...rest } = metadata;
  const document = {
    id: crypto.randomUUID(),
    botId: normalizeBotId(botId || metadata?.botId || DEFAULT_BOT_ID),
    createdAt: new Date().toISOString(),
    status: "uploaded",
    progress: 0,
    stage: "Pendiente",
    manualSummary: summary || "",
    autoSummary: "",
    extractedText: "",
    chunks: [],
    usedOcr: false,
    processedAt: null,
    error: null,
    ...rest,
  };

  documentStore.push(document);
  persistDocuments();
  return document;
}

export function updateDocument(id, updates, botId) {
  const resolved = botId ? normalizeBotId(botId) : null;
  const document = documentStore.find((doc) => {
    if (doc.id !== id) return false;
    if (!resolved) return true;
    return normalizeBotId(doc?.botId) === resolved;
  });
  if (!document) {
    return null;
  }

  Object.assign(document, updates, {
    updatedAt: new Date().toISOString(),
  });

  persistDocuments();

  return document;
}

export function removeDocument(id, botId) {
  const resolved = botId ? normalizeBotId(botId) : null;
  const index = documentStore.findIndex((doc) => {
    if (doc.id !== id) return false;
    if (!resolved) return true;
    return normalizeBotId(doc?.botId) === resolved;
  });
  if (index === -1) {
    return null;
  }
  const [removed] = documentStore.splice(index, 1);
  persistDocuments();
  return removed;
}