// FAQ Cache Store - Sistema de caché inteligente para respuestas frecuentes
import fs from "fs";
import path from "path";
import { DEFAULT_BOT_ID, normalizeBotId } from "./botContext.js";

const DATA_PATH = path.resolve("data/faq-cache.json");
const DATA_DIR = path.dirname(DATA_PATH);

let faqCache = [];
let loaded = false;

function loadCache() {
  if (loaded) return;
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, "utf8");
      const parsed = JSON.parse(raw);
      faqCache = Array.isArray(parsed)
        ? parsed.map((entry) => ({
            botId: normalizeBotId(entry?.botId || DEFAULT_BOT_ID),
            ...entry,
          }))
        : [];
    }
  } catch (e) {
    console.error("No se pudo cargar el FAQ cache", e);
    faqCache = [];
  }
  loaded = true;
}

function ensureDataDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error("No se pudo crear el directorio data", e);
  }
}

function persistCache() {
  try {
    ensureDataDir();
    fs.writeFileSync(DATA_PATH, JSON.stringify(faqCache, null, 2), "utf8");
  } catch (e) {
    console.error("Error persistiendo FAQ cache", e);
  }
}

/**
 * Calcula similitud coseno entre dos vectores de embeddings
 */
export function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
  
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }
  
  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Busca en caché una pregunta similar
 * @param {Array} questionEmbedding - Vector de embedding de la pregunta
 * @param {number} threshold - Umbral de similitud (default 0.85)
 * @returns {Object|null} - FAQ encontrada o null
 */
export function findSimilarFAQ(questionEmbedding, threshold = 0.85, botId) {
  if (!questionEmbedding) return null;
  
  loadCache();
  const resolved = normalizeBotId(botId);
  
  let bestMatch = null;
  let bestSimilarity = 0;
  
  for (const faq of faqCache) {
    if (normalizeBotId(faq?.botId) !== resolved) continue;
    if (!faq.questionEmbedding || !faq.enabled) continue;
    
    const similarity = cosineSimilarity(questionEmbedding, faq.questionEmbedding);
    
    if (similarity > bestSimilarity && similarity >= threshold) {
      bestSimilarity = similarity;
      bestMatch = {
        ...faq,
        similarity,
      };
    }
  }
  
  return bestMatch;
}

/**
 * Agrega o actualiza una FAQ en el caché
 */
export function upsertFAQ({ question, answer, questionEmbedding, category, metadata = {}, botId } = {}) {
  loadCache();
  const resolved = normalizeBotId(botId);
  
  const normalized = String(question || "").toLowerCase().trim();
  if (!normalized || !answer) return null;
  
  // Buscar si ya existe
  const existingIndex = faqCache.findIndex(
    (faq) =>
      normalizeBotId(faq?.botId) === resolved &&
      String(faq.question || "").toLowerCase().trim() === normalized
  );
  
  const now = Date.now();
  
  if (existingIndex >= 0) {
    // Actualizar existente
    const existing = faqCache[existingIndex];
    faqCache[existingIndex] = {
      ...existing,
      botId: resolved,
      answer,
      questionEmbedding: questionEmbedding || existing.questionEmbedding,
      category: category || existing.category,
      hitCount: (existing.hitCount || 0) + 1,
      lastUsedAt: now,
      updatedAt: now,
      metadata: { ...existing.metadata, ...metadata },
    };
    persistCache();
    return faqCache[existingIndex];
  }
  
  // Crear nuevo
  const newFAQ = {
    botId: resolved,
    id: `faq_${now}_${Math.random().toString(36).substr(2, 9)}`,
    question,
    answer,
    questionEmbedding,
    category: category || "general",
    hitCount: 1,
    enabled: true,
    createdAt: now,
    lastUsedAt: now,
    updatedAt: now,
    metadata,
  };
  
  faqCache.push(newFAQ);
  persistCache();
  return newFAQ;
}

/**
 * Incrementa el contador de uso de una FAQ
 */
export function incrementFAQHit(faqId, botId) {
  loadCache();
  const resolved = normalizeBotId(botId);
  const faq = faqCache.find((f) => f.id === faqId && normalizeBotId(f?.botId) === resolved);
  if (faq) {
    faq.hitCount = (faq.hitCount || 0) + 1;
    faq.lastUsedAt = Date.now();
    persistCache();
  }
}

/**
 * Obtiene todas las FAQs
 */
export function getAllFAQs(botId) {
  loadCache();
  const resolved = normalizeBotId(botId);
  return faqCache.filter((faq) => normalizeBotId(faq?.botId) === resolved).slice();
}

/**
 * Obtiene FAQs por categoría
 */
export function getFAQsByCategory(category, botId) {
  loadCache();
  const resolved = normalizeBotId(botId);
  return faqCache.filter(
    (faq) => normalizeBotId(faq?.botId) === resolved && faq.category === category && faq.enabled
  );
}

/**
 * Obtiene las FAQs más populares
 */
export function getTopFAQs(limit = 10, botId) {
  loadCache();
  const resolved = normalizeBotId(botId);
  return faqCache
    .filter((faq) => normalizeBotId(faq?.botId) === resolved && faq.enabled)
    .sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0))
    .slice(0, limit);
}

/**
 * Actualiza una FAQ
 */
export function updateFAQ(faqId, updates, botId) {
  loadCache();
  const resolved = normalizeBotId(botId);
  const index = faqCache.findIndex((f) => f.id === faqId && normalizeBotId(f?.botId) === resolved);
  if (index >= 0) {
    faqCache[index] = {
      ...faqCache[index],
      botId: resolved,
      ...updates,
      updatedAt: Date.now(),
    };
    persistCache();
    return faqCache[index];
  }
  
  return null;
}

/**
 * Elimina una FAQ
 */
export function deleteFAQ(faqId, botId) {
  loadCache();
  const resolved = normalizeBotId(botId);
  const index = faqCache.findIndex((f) => f.id === faqId && normalizeBotId(f?.botId) === resolved);
  if (index >= 0) {
    faqCache.splice(index, 1);
    persistCache();
    return true;
  }
  
  return false;
}

/**
 * Habilita/deshabilita una FAQ
 */
export function toggleFAQ(faqId, enabled, botId) {
  return updateFAQ(faqId, { enabled }, botId);
}

/**
 * Obtiene estadísticas del caché
 */
export function getFAQStats(botId) {
  loadCache();
  const resolved = normalizeBotId(botId);
  const scoped = faqCache.filter((faq) => normalizeBotId(faq?.botId) === resolved);
  const enabled = scoped.filter((faq) => faq.enabled);
  const totalHits = scoped.reduce((sum, faq) => sum + (faq.hitCount || 0), 0);
  
  const categories = {};
  for (const faq of scoped) {
    const cat = faq.category || "general";
    if (!categories[cat]) {
      categories[cat] = { count: 0, hits: 0 };
    }
    categories[cat].count++;
    categories[cat].hits += faq.hitCount || 0;
  }
  
  return {
    total: scoped.length,
    enabled: enabled.length,
    totalHits,
    categories,
  };
}
