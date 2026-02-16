/**
 * Sistema de Cache para respuestas de GPT
 * Guarda respuestas y las reutiliza para preguntas similares
 */

import fs from "fs/promises";
import path from "path";
import { getEmbedding } from "./embeddings.js";
import crypto from "crypto";

const cachePath = path.resolve(process.cwd(), "data", "gpt-cache.json");

// Configuración
const SIMILARITY_THRESHOLD = 0.90; // Similitud mínima para usar cache
const MAX_CACHE_ENTRIES = 500; // Máximo de respuestas cacheadas
const CACHE_TTL_DAYS = 30; // Días antes de expirar cache no usado
const MIN_QUESTION_LENGTH = 10; // No cachear preguntas muy cortas

// Cache en memoria
let cacheStore = [];

/**
 * Calcula similitud coseno
 */
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Genera hash de documentos para invalidación
 */
function generateDocumentsHash(documents) {
  if (!documents || documents.length === 0) {
    return "no-docs";
  }
  
  const docIds = documents
    .map(d => `${d.id}-${d.updatedAt || d.createdAt}`)
    .sort()
    .join("|");
  
  return crypto.createHash("md5").update(docIds).digest("hex");
}

/**
 * Carga cache desde disco
 */
export async function loadGPTCache() {
  try {
    const content = await fs.readFile(cachePath, "utf8");
    const loaded = JSON.parse(content);
    
    if (Array.isArray(loaded)) {
      cacheStore = loaded;
      console.log(`[CACHE] ✓ Cargadas ${cacheStore.length} respuestas`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("[CACHE] Error cargando:", error.message);
    }
  }
}

/**
 * Guarda cache a disco
 */
async function saveGPTCache() {
  try {
    await fs.writeFile(cachePath, JSON.stringify(cacheStore, null, 2), "utf8");
  } catch (error) {
    console.error("[CACHE] Error guardando:", error.message);
  }
}

/**
 * Busca una respuesta en cache
 * @param {string} question - Pregunta del usuario
 * @param {Array} documents - Documentos actuales
 * @param {number} threshold - Umbral de similitud (0-1)
 * @returns {Promise<Object|null>} - { answer, similarity, hits } o null
 */
export async function findCachedGPTResponse(question, documents = [], threshold = SIMILARITY_THRESHOLD) {
  if (!question || question.length < MIN_QUESTION_LENGTH) {
    return null;
  }
  
  if (cacheStore.length === 0) {
    return null;
  }
  
  try {
    const questionEmbedding = await getEmbedding(question);
    const docsHash = generateDocumentsHash(documents);
    
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const entry of cacheStore) {
      // Solo considerar si los documentos son los mismos
      if (entry.documentsHash !== docsHash) {
        continue;
      }
      
      if (!entry.questionEmbedding) {
        continue;
      }
      
      const similarity = cosineSimilarity(questionEmbedding, entry.questionEmbedding);
      
      if (similarity > bestSimilarity && similarity >= threshold) {
        bestSimilarity = similarity;
        bestMatch = entry;
      }
    }
    
    if (bestMatch) {
      // Actualizar estadísticas
      bestMatch.hits += 1;
      bestMatch.lastUsed = new Date().toISOString();
      
      console.log(`[CACHE] 🎯 HIT (similarity: ${bestSimilarity.toFixed(2)}, hits: ${bestMatch.hits})`);
      console.log(`[CACHE]    Original: "${bestMatch.question.substring(0, 60)}..."`);
      
      // Guardar asincrónicamente
      saveGPTCache().catch(() => {});
      
      return {
        answer: bestMatch.answer,
        similarity: bestSimilarity,
        hits: bestMatch.hits,
        originalQuestion: bestMatch.question
      };
    }
    
    console.log(`[CACHE] ✗ MISS - No hay respuesta similar en cache`);
    return null;
    
  } catch (error) {
    console.error("[CACHE] Error buscando:", error.message);
    return null;
  }
}

/**
 * Guarda una respuesta en cache
 * @param {string} question - Pregunta del usuario
 * @param {string} answer - Respuesta de GPT
 * @param {Array} documents - Documentos usados
 */
export async function saveCachedGPTResponse(question, answer, documents = []) {
  if (!question || question.length < MIN_QUESTION_LENGTH || !answer) {
    return;
  }
  
  try {
    const questionEmbedding = await getEmbedding(question);
    const docsHash = generateDocumentsHash(documents);
    
    const entry = {
      id: crypto.randomUUID(),
      question: question.trim(),
      questionEmbedding: questionEmbedding,
      answer: answer.trim(),
      documentsHash: docsHash,
      documentsCount: documents.length,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      hits: 0
    };
    
    cacheStore.push(entry);
    console.log(`[CACHE] 💾 Guardada nueva respuesta (total: ${cacheStore.length})`);
    
    // Limpiar cache si excede el límite
    if (cacheStore.length > MAX_CACHE_ENTRIES) {
      await cleanCache();
    }
    
    // Guardar asincrónicamente
    saveGPTCache().catch(() => {});
    
  } catch (error) {
    console.error("[CACHE] Error guardando respuesta:", error.message);
  }
}

/**
 * Limpia entradas antiguas o poco usadas
 */
async function cleanCache() {
  const before = cacheStore.length;
  
  // Ordenar por hits (descendente) y fecha de uso
  cacheStore.sort((a, b) => {
    if (b.hits !== a.hits) {
      return b.hits - a.hits;
    }
    return new Date(b.lastUsed) - new Date(a.lastUsed);
  });
  
  // Mantener solo las mejores entradas
  cacheStore = cacheStore.slice(0, MAX_CACHE_ENTRIES);
  
  const cleaned = before - cacheStore.length;
  if (cleaned > 0) {
    console.log(`[CACHE] 🧹 Limpiadas ${cleaned} entradas (límite: ${MAX_CACHE_ENTRIES})`);
    await saveGPTCache();
  }
}

/**
 * Limpia cache por antigüedad
 */
export async function cleanOldCache(days = CACHE_TTL_DAYS) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const before = cacheStore.length;
  
  cacheStore = cacheStore.filter(entry => {
    const lastUsed = new Date(entry.lastUsed);
    // Mantener si fue usado recientemente O tiene muchos hits
    return lastUsed > cutoffDate || entry.hits >= 5;
  });
  
  const cleaned = before - cacheStore.length;
  
  if (cleaned > 0) {
    console.log(`[CACHE] 🧹 Limpiadas ${cleaned} entradas antiguas (>${days} días)`);
    await saveGPTCache();
  }
  
  return cleaned;
}

/**
 * Invalida cache cuando se actualizan documentos
 */
export async function invalidateCacheForDocuments(documents) {
  const docsHash = generateDocumentsHash(documents);
  const before = cacheStore.length;
  
  cacheStore = cacheStore.filter(entry => entry.documentsHash !== docsHash);
  
  const invalidated = before - cacheStore.length;
  
  if (invalidated > 0) {
    console.log(`[CACHE] 🔄 Invalidadas ${invalidated} entradas (documentos actualizados)`);
    await saveGPTCache();
  }
  
  return invalidated;
}

/**
 * Obtiene estadísticas del cache
 */
export function getCacheStats() {
  const totalHits = cacheStore.reduce((sum, e) => sum + e.hits, 0);
  const avgHits = cacheStore.length > 0 ? totalHits / cacheStore.length : 0;
  
  const withHits = cacheStore.filter(e => e.hits > 0);
  const popularEntries = cacheStore
    .filter(e => e.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 10)
    .map(e => ({
      question: e.question.substring(0, 80),
      hits: e.hits,
      lastUsed: e.lastUsed
    }));
  
  // Calcular ahorro estimado
  const savedCalls = totalHits;
  const costPerCall = 0.002; // Estimado para GPT-4o-mini
  const estimatedSavings = savedCalls * costPerCall;
  
  return {
    totalEntries: cacheStore.length,
    totalHits: totalHits,
    usedEntries: withHits.length,
    avgHitsPerEntry: Math.round(avgHits * 100) / 100,
    popularEntries: popularEntries,
    estimatedSavings: {
      apiCalls: savedCalls,
      dollars: Math.round(estimatedSavings * 1000) / 1000
    }
  };
}

/**
 * Limpia todo el cache
 */
export async function clearAllCache() {
  const before = cacheStore.length;
  cacheStore = [];
  await saveGPTCache();
  console.log(`[CACHE] 🗑️  Cache completamente limpiado (${before} entradas)`);
  return before;
}
