import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

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
      documentStore.splice(0, documentStore.length, ...parsed);
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

export function listDocuments() {
  return documentStore.map((doc) => ({ ...doc }));
}

export function getDocumentById(id) {
  return documentStore.find((doc) => doc.id === id) ?? null;
}

export function addDocument(metadata) {
  const { summary, ...rest } = metadata;
  const document = {
    id: crypto.randomUUID(),
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

export function updateDocument(id, updates) {
  const document = documentStore.find((doc) => doc.id === id);
  if (!document) {
    return null;
  }

  Object.assign(document, updates, {
    updatedAt: new Date().toISOString(),
  });

  persistDocuments();

  return document;
}

export function removeDocument(id) {
  const index = documentStore.findIndex((doc) => doc.id === id);
  if (index === -1) {
    return null;
  }
  const [removed] = documentStore.splice(index, 1);
  persistDocuments();
  return removed;
}