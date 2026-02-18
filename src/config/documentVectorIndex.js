// Document Vector Index - Índice optimizado para búsqueda en documentos
import fs from "fs";
import path from "path";
import { VectorIndex } from "./vectorIndex.js";

const INDEX_PATH = path.resolve("data/document-vector-index.json");
const DATA_DIR = path.dirname(INDEX_PATH);

let documentIndex = null;
let loaded = false;

/**
 * Inicializa el índice de documentos
 */
function initIndex() {
  if (loaded) return;
  
  try {
    if (fs.existsSync(INDEX_PATH)) {
      console.log("Cargando índice de vectores de documentos...");
      const data = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
      documentIndex = VectorIndex.fromJSON(data);
      console.log(`✓ Índice cargado: ${documentIndex.vectors.length} chunks`);
    } else {
      console.log("Creando nuevo índice de vectores de documentos...");
      documentIndex = new VectorIndex({
        metric: 'cosine',
        M: 16,
        efConstruction: 200,
        useIndex: true, // Activar índice HNSW
      });
    }
  } catch (e) {
    console.error("Error cargando índice de documentos:", e);
    documentIndex = new VectorIndex({ metric: 'cosine', M: 16 });
  }
  
  loaded = true;
}

/**
 * Guarda el índice en disco
 */
function persistIndex() {
  if (!documentIndex) return;
  
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(INDEX_PATH, JSON.stringify(documentIndex.toJSON()), "utf8");
  } catch (e) {
    console.error("Error persistiendo índice de documentos:", e);
  }
}

/**
 * Agrega chunks de un documento al índice
 */
export function indexDocumentChunks(documentId, chunks) {
  initIndex();
  
  if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
    return;
  }
  
  let indexed = 0;
  for (const chunk of chunks) {
    if (!chunk.embedding || !Array.isArray(chunk.embedding)) {
      continue;
    }
    
    try {
      documentIndex.add(chunk.embedding, {
        documentId,
        text: chunk.text,
        meta: chunk.meta,
      });
      indexed++;
    } catch (err) {
      console.error(`Error indexando chunk de documento ${documentId}:`, err);
    }
  }
  
  // Reconstruir índice si agregamos muchos chunks (cada 1000)
  if (documentIndex.vectors.length % 1000 === 0 && documentIndex.vectors.length >= 1000) {
    console.log("Reconstruyendo índice de documentos...");
    documentIndex.rebuild();
  }
  
  persistIndex();
  return indexed;
}

/**
 * Busca chunks similares usando el índice
 */
export function searchSimilarChunks(queryEmbedding, k = 10, options = {}) {
  initIndex();
  
  if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
    return [];
  }
  
  if (documentIndex.vectors.length === 0) {
    return [];
  }
  
  try {
    const results = documentIndex.search(queryEmbedding, k, {
      ef: options.ef || Math.max(k * 2, 50),
    });
    
    return results.map(result => ({
      text: result.metadata.text,
      documentId: result.metadata.documentId,
      meta: result.metadata.meta,
      score: result.score,
      similarity: result.score, // Compatibilidad con código existente
    }));
  } catch (err) {
    console.error("Error en búsqueda de índice:", err);
    return [];
  }
}

/**
 * Elimina chunks de un documento del índice
 */
export function removeDocumentFromIndex(documentId) {
  initIndex();
  
  // Crear nuevo índice sin los chunks del documento eliminado
  const newIndex = new VectorIndex({
    metric: documentIndex.metric,
    M: documentIndex.M,
    efConstruction: documentIndex.efConstruction,
    useIndex: documentIndex.useIndex,
  });
  
  for (const item of documentIndex.vectors) {
    if (item.metadata.documentId !== documentId) {
      newIndex.add(item.vector, item.metadata);
    }
  }
  
  documentIndex = newIndex;
  
  // Reconstruir si tiene suficientes vectores
  if (documentIndex.vectors.length >= 100) {
    documentIndex.rebuild();
  }
  
  persistIndex();
}

/**
 * Reconstruye el índice completo
 */
export function rebuildDocumentIndex() {
  initIndex();
  
  if (documentIndex.vectors.length === 0) {
    console.log("No hay vectores para reconstruir el índice");
    return;
  }
  
  documentIndex.rebuild();
  persistIndex();
}

/**
 * Obtiene estadísticas del índice
 */
export function getIndexStats() {
  initIndex();
  
  const stats = documentIndex.getStats();
  
  // Contar documentos únicos
  const documentIds = new Set();
  for (const item of documentIndex.vectors) {
    if (item.metadata?.documentId) {
      documentIds.add(item.metadata.documentId);
    }
  }
  
  return {
    ...stats,
    uniqueDocuments: documentIds.size,
    totalChunks: documentIndex.vectors.length,
    indexSize: documentIndex.vectors.length > 0 
      ? `~${(JSON.stringify(documentIndex.toJSON()).length / 1024 / 1024).toFixed(2)} MB`
      : "0 MB",
  };
}

/**
 * Limpia el índice completo
 */
export function clearIndex() {
  initIndex();
  documentIndex.clear();
  persistIndex();
}

export default {
  indexDocumentChunks,
  searchSimilarChunks,
  removeDocumentFromIndex,
  rebuildDocumentIndex,
  getIndexStats,
  clearIndex,
};
