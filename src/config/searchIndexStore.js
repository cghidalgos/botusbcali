/**
 * Almacenar y gestionar índices de búsqueda BM25 de documentos
 * Evita regenerar índices en cada consulta
 */

import fs from "fs/promises";
import path from "path";

const dataDir = new URL("../data", import.meta.url).pathname;
const searchIndexPath = path.join(dataDir, "search-indices.json");

let searchIndices = {};

/**
 * Cargar índices almacenados
 */
async function loadSearchIndices() {
  try {
    const exists = await fs
      .access(searchIndexPath)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      const data = await fs.readFile(searchIndexPath, "utf-8");
      searchIndices = JSON.parse(data) || {};
      console.log(`[SEARCH-STORE] Cargados ${Object.keys(searchIndices).length} índices`);
    }
  } catch (error) {
    console.error("Error cargando índices de búsqueda:", error);
    searchIndices = {};
  }
}

/**
 * Guardar índices
 */
async function saveSearchIndices() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(searchIndexPath, JSON.stringify(searchIndices, null, 2));
  } catch (error) {
    console.error("Error guardando índices de búsqueda:", error);
  }
}

/**
 * Guardar índice de documento
 */
export async function storeSearchIndex(docId, docName, index) {
  searchIndices[docId] = {
    docId,
    docName,
    index,
    storedAt: new Date().toISOString(),
  };
  await saveSearchIndices();
}

/**
 * Obtener todos los índices
 */
export function getAllSearchIndices() {
  return Object.values(searchIndices).map((item) => item.index);
}

/**
 * Obtener índice de documento específico
 */
export function getSearchIndex(docId) {
  return searchIndices[docId]?.index || null;
}

/**
 * Eliminar índice
 */
export async function removeSearchIndex(docId) {
  delete searchIndices[docId];
  await saveSearchIndices();
}

/**
 * Listar índices
 */
export function listSearchIndices() {
  return Object.values(searchIndices).map((item) => ({
    docId: item.docId,
    docName: item.docName,
    tokenCount: item.index?.metadata?.token_count || 0,
    uniqueTokens: item.index?.metadata?.unique_tokens || 0,
  }));
}

// Cargar índices al iniciar
await loadSearchIndices();
