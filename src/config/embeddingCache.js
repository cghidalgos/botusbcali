// Embedding Cache - Evita recalcular embeddings para preguntas similares
import fs from "fs";
import path from "path";

const CACHE_PATH = path.resolve("data/embedding-cache.json");
const DATA_DIR = path.dirname(CACHE_PATH);

let embeddingCache = [];
let loaded = false;

// Stats para monitoreo
const stats = {
  hits: 0,
  misses: 0,
  savings: 0, // Estimado en USD
};

function loadCache() {
  if (loaded) return;
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const raw = fs.readFileSync(CACHE_PATH, "utf8");
      embeddingCache = JSON.parse(raw);
      console.log(`✓ Embedding cache cargado: ${embeddingCache.length} entradas`);
    }
  } catch (e) {
    console.error("Error cargando embedding cache", e);
    embeddingCache = [];
  }
  loaded = true;
}

function ensureDataDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error("Error creando directorio data", e);
  }
}

function persistCache() {
  try {
    ensureDataDir();
    fs.writeFileSync(CACHE_PATH, JSON.stringify(embeddingCache, null, 2), "utf8");
  } catch (e) {
    console.error("Error persistiendo embedding cache", e);
  }
}

/**
 * Normaliza texto para comparación
 */
function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Elimina diacríticos
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calcula similitud básica entre dos textos (Levenshtein simplificado)
 * Retorna 0-1, donde 1 es idéntico
 */
function textSimilarity(str1, str2) {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  
  if (s1 === s2) return 1.0;
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  // Si son muy diferentes en longitud, no vale la pena comparar
  if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.5) {
    return 0;
  }
  
  // Comparación simple por tokens
  const tokens1 = s1.split(" ");
  const tokens2 = s2.split(" ");
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Busca un embedding cacheado para un texto similar
 * @param {string} text - Texto de la pregunta
 * @param {number} threshold - Umbral de similitud (default 0.95)
 * @returns {Array|null} - Embedding cacheado o null
 */
export function getCachedEmbedding(text, threshold = 0.95) {
  if (!text || typeof text !== "string") return null;
  
  loadCache();
  
  const normalized = normalizeText(text);
  
  // Búsqueda exacta primero (O(n) pero muy rápido para matches exactos)
  for (const entry of embeddingCache) {
    if (normalizeText(entry.text) === normalized) {
      stats.hits++;
      stats.savings += 0.00002; // ~$0.00002 por 1K tokens
      entry.hitCount = (entry.hitCount || 0) + 1;
      entry.lastUsedAt = Date.now();
      // No persistir en cada hit (demasiado I/O), hacerlo periódicamente
      console.log(`✓ Embedding Cache HIT (exacto): "${text.slice(0, 60)}..."`);
      return entry.embedding;
    }
  }
  
  // Búsqueda por similitud (más costoso)
  let bestMatch = null;
  let bestSimilarity = 0;
  
  for (const entry of embeddingCache) {
    const similarity = textSimilarity(text, entry.text);
    if (similarity > bestSimilarity && similarity >= threshold) {
      bestSimilarity = similarity;
      bestMatch = entry;
    }
  }
  
  if (bestMatch) {
    stats.hits++;
    stats.savings += 0.00002;
    bestMatch.hitCount = (bestMatch.hitCount || 0) + 1;
    bestMatch.lastUsedAt = Date.now();
    console.log(`✓ Embedding Cache HIT (${(bestSimilarity * 100).toFixed(1)}% similar): "${text.slice(0, 60)}..."`);
    return bestMatch.embedding;
  }
  
  stats.misses++;
  return null;
}

/**
 * Guarda un nuevo embedding en el cache
 * @param {string} text - Texto original
 * @param {Array} embedding - Vector de embedding
 */
export function cacheEmbedding(text, embedding) {
  if (!text || !embedding || !Array.isArray(embedding)) return;
  
  loadCache();
  
  const normalized = normalizeText(text);
  
  // Evitar duplicados exactos
  const existsIndex = embeddingCache.findIndex(
    entry => normalizeText(entry.text) === normalized
  );
  
  const now = Date.now();
  
  if (existsIndex >= 0) {
    // Actualizar existente
    embeddingCache[existsIndex] = {
      ...embeddingCache[existsIndex],
      embedding,
      updatedAt: now,
    };
  } else {
    // Agregar nuevo
    embeddingCache.push({
      text,
      embedding,
      hitCount: 0,
      createdAt: now,
      lastUsedAt: now,
      updatedAt: now,
    });
  }
  
  // Limitar tamaño del cache (mantener los más populares)
  if (embeddingCache.length > 5000) {
    // Ordenar por hitCount descendente
    embeddingCache.sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0));
    // Mantener top 4000
    embeddingCache = embeddingCache.slice(0, 4000);
  }
  
  persistCache();
}

/**
 * Obtiene estadísticas del cache
 */
export function getEmbeddingCacheStats() {
  loadCache();
  
  const totalEntries = embeddingCache.length;
  const totalHits = stats.hits;
  const totalMisses = stats.misses;
  const hitRate = totalHits + totalMisses > 0 
    ? (totalHits / (totalHits + totalMisses) * 100).toFixed(1)
    : 0;
  const estimatedSavings = stats.savings.toFixed(4);
  
  // Top queries
  const topQueries = [...embeddingCache]
    .filter(e => (e.hitCount || 0) > 0)
    .sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0))
    .slice(0, 10)
    .map(e => ({
      text: e.text.slice(0, 100),
      hitCount: e.hitCount || 0,
    }));
  
  return {
    totalEntries,
    totalHits,
    totalMisses,
    hitRate: `${hitRate}%`,
    estimatedSavings: `$${estimatedSavings}`,
    topQueries,
  };
}

/**
 * Limpia entradas antiguas no usadas
 * @param {number} maxAgeMs - Edad máxima en milisegundos (default 90 días)
 */
export function cleanOldEmbeddings(maxAgeMs = 90 * 24 * 60 * 60 * 1000) {
  loadCache();
  
  const now = Date.now();
  const initialCount = embeddingCache.length;
  
  embeddingCache = embeddingCache.filter(entry => {
    const age = now - (entry.lastUsedAt || entry.createdAt || 0);
    return age < maxAgeMs;
  });
  
  const removed = initialCount - embeddingCache.length;
  
  if (removed > 0) {
    persistCache();
    console.log(`✓ Limpieza de embedding cache: ${removed} entradas antiguas eliminadas`);
  }
  
  return { removed, remaining: embeddingCache.length };
}

/**
 * Reset de stats (útil para testing o monitoreo periódico)
 */
export function resetStats() {
  stats.hits = 0;
  stats.misses = 0;
  stats.savings = 0;
}
