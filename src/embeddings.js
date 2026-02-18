import dotenv from "dotenv";
import OpenAI from "openai";
import { getCachedEmbedding, cacheEmbedding } from "./config/embeddingCache.js";

dotenv.config();

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const BATCH_SIZE = Number.parseInt(process.env.EMBEDDING_BATCH_SIZE || "20", 10);

export function chunkText(text, chunkSize, overlap, maxChunks) {
  const resolvedChunkSize =
    chunkSize ?? Number.parseInt(process.env.EMBEDDING_CHUNK_SIZE || "1400", 10);
  const resolvedOverlap =
    overlap ?? Number.parseInt(process.env.EMBEDDING_CHUNK_OVERLAP || "200", 10);
  const resolvedMaxChunks =
    maxChunks ?? Number.parseInt(process.env.EMBEDDING_MAX_CHUNKS || "600", 10);
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const chunks = [];
  let start = 0;
  while (start < cleaned.length && chunks.length < resolvedMaxChunks) {
    const end = Math.min(start + resolvedChunkSize, cleaned.length);
    const chunk = cleaned.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    if (end >= cleaned.length) break;
    start = Math.max(end - resolvedOverlap, 0);
  }
  return chunks;
}

/**
 * Obtiene embeddings para múltiples textos en batch (más eficiente)
 * @param {string[]} texts - Array de textos
 * @returns {Promise<Array>} - Array de embeddings en el mismo orden
 */
export async function getEmbeddingBatch(texts) {
  if (!client || !texts || texts.length === 0) return [];
  
  const inputs = texts.map(text => String(text || "").slice(0, 4000).trim()).filter(Boolean);
  if (inputs.length === 0) return [];
  
  // Verificar cache para cada texto
  const results = [];
  const uncachedIndices = [];
  const uncachedTexts = [];
  
  for (let i = 0; i < inputs.length; i++) {
    const cached = getCachedEmbedding(inputs[i]);
    if (cached) {
      results[i] = cached;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(inputs[i]);
    }
  }
  
  // Si no hay textos sin cachear, retornar resultados
  if (uncachedTexts.length === 0) {
    return results;
  }
  
  // Calcular embeddings para textos no cacheados
  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: uncachedTexts,
    });
    
    // Asignar embeddings calculados a sus posiciones originales
    response.data.forEach((item, idx) => {
      const originalIndex = uncachedIndices[idx];
      const embedding = item.embedding;
      results[originalIndex] = embedding;
      
      // Guardar en cache
      if (embedding && uncachedTexts[idx]) {
        cacheEmbedding(uncachedTexts[idx], embedding);
      }
    });
  } catch (error) {
    console.error("Error en batch embeddings:", error);
    // En caso de error, intentar uno por uno como fallback
    for (let i = 0; i < uncachedIndices.length; i++) {
      try {
        const embedding = await getEmbedding(uncachedTexts[i]);
        results[uncachedIndices[i]] = embedding;
      } catch (err) {
        console.error(`Error en embedding individual ${i}:`, err);
        results[uncachedIndices[i]] = null;
      }
    }
  }
  
  return results;
}

/**
 * Obtiene un embedding individual (usa cache internamente)
 */
export async function getEmbedding(text) {
  if (!client) return null;
  const input = String(text || "").slice(0, 4000);
  if (!input.trim()) return null;
  
  // Intentar obtener del cache primero
  const cached = getCachedEmbedding(input);
  if (cached) {
    return cached;
  }
  
  // Si no está en cache, calcular nuevo embedding
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });
  
  const embedding = response.data?.[0]?.embedding || null;
  
  // Guardar en cache para futuras consultas
  if (embedding) {
    cacheEmbedding(input, embedding);
  }
  
  return embedding;
}

export async function embedChunks(chunks, onProgress) {
  if (!client || !chunks || chunks.length === 0) return [];
  
  const embedded = [];
  const total = chunks.length;
  let processed = 0;
  
  // Procesar en batches para mayor eficiencia
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = await getEmbeddingBatch(batch);
    
    for (let j = 0; j < batch.length; j++) {
      if (batchEmbeddings[j]) {
        embedded.push({ text: batch[j], embedding: batchEmbeddings[j] });
      }
      processed++;
      
      if (onProgress) {
        onProgress(processed, total);
      }
    }
  }
  
  return embedded;
}

export async function embedChunkDescriptors(descriptors) {
  if (!client || !descriptors || descriptors.length === 0) return [];
  
  // Filtrar descriptores válidos
  const validDescriptors = descriptors.filter(d => {
    const text = String(d?.text || "").trim();
    return text.length > 0;
  });
  
  if (validDescriptors.length === 0) return [];
  
  const embedded = [];
  
  // Procesar en batches
  for (let i = 0; i < validDescriptors.length; i += BATCH_SIZE) {
    const batch = validDescriptors.slice(i, i + BATCH_SIZE);
    const texts = batch.map(d => String(d?.text || "").trim());
    const batchEmbeddings = await getEmbeddingBatch(texts);
    
    for (let j = 0; j < batch.length; j++) {
      if (batchEmbeddings[j]) {
        const descriptor = batch[j];
        const text = texts[j];
        const embedding = batchEmbeddings[j];
        const meta = descriptor?.meta;
        embedded.push(meta ? { text, embedding, meta } : { text, embedding });
      }
    }
  }
  
  return embedded;
}
