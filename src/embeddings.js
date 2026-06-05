import dotenv from "dotenv";
import OpenAI from "openai";
import { cacheEmbedding, getCachedEmbedding } from "./config/embeddingCache.js";
import { recordEmbeddingUsage } from "./config/metricsStore.js";
import { recordError } from "./config/errorStore.js";

dotenv.config();

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const BATCH_SIZE = Number.parseInt(process.env.EMBEDDING_BATCH_SIZE || "128", 10);

const defaultClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const clientCache = new Map();

function getClient(apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) return defaultClient;
  if (clientCache.has(key)) return clientCache.get(key);
  const client = new OpenAI({ apiKey: key });
  clientCache.set(key, client);
  return client;
}

export function chunkText(text, chunkSize, overlap, maxChunks) {
  const resolvedChunkSize =
    chunkSize ?? Number.parseInt(process.env.EMBEDDING_CHUNK_SIZE || "1400", 10);
  const resolvedOverlap =
    overlap ?? Number.parseInt(process.env.EMBEDDING_CHUNK_OVERLAP || "200", 10);
  const resolvedMaxChunks =
    maxChunks ?? Number.parseInt(process.env.EMBEDDING_MAX_CHUNKS || "600", 10);

  // Split by paragraph first for semantic boundaries
  const cleaned = String(text || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let buffer = "";

  for (const para of paragraphs) {
    if (chunks.length >= resolvedMaxChunks) break;
    const candidate = buffer ? `${buffer}\n\n${para}` : para;
    if (candidate.length <= resolvedChunkSize) {
      buffer = candidate;
    } else {
      if (buffer) {
        chunks.push(buffer);
        buffer = buffer.slice(-resolvedOverlap);
      }
      if (para.length <= resolvedChunkSize) {
        buffer = buffer ? `${buffer} ${para}` : para;
      } else {
        // split long paragraph by sentences
        const sentences = para.match(/[^.!?]+[.!?]+[\s]*/g) || [para];
        for (const sent of sentences) {
          if (chunks.length >= resolvedMaxChunks) break;
          const sc = buffer ? `${buffer} ${sent.trim()}` : sent.trim();
          if (sc.length <= resolvedChunkSize) {
            buffer = sc;
          } else {
            if (buffer) chunks.push(buffer);
            buffer = sent.trim().slice(0, resolvedChunkSize);
          }
        }
      }
    }
  }
  if (buffer && chunks.length < resolvedMaxChunks) chunks.push(buffer);
  return chunks;
}

export async function getEmbedding(text, options = {}) {
  const client = getClient(options.apiKey);
  if (!client) return null;
  const input = String(text || "").slice(0, 8000).trim();
  if (!input) return null;

  const cached = getCachedEmbedding(input, { botId: options.botId });
  if (cached) return cached;

  try {
    const response = await client.embeddings.create({ model: EMBEDDING_MODEL, input });
    const embedding = response.data?.[0]?.embedding || null;
    if (embedding) {
      cacheEmbedding(input, embedding, { botId: options.botId });
      if (response.usage) await recordEmbeddingUsage(options.botId, response.usage);
    }
    return embedding;
  } catch (error) {
    await recordError("embedding", error?.message || "OpenAI embedding error", {
      botId: options.botId,
      context: { model: EMBEDDING_MODEL },
    });
    return null;
  }
}

// Alias: queries and documents use same model with OpenAI
export async function getQueryEmbedding(text, options = {}) {
  return getEmbedding(text, options);
}

export async function getEmbeddingBatch(texts, options = {}) {
  const client = getClient(options.apiKey);
  if (!client || !texts?.length) return [];

  const inputs = texts.map(t => String(t || "").slice(0, 8000).trim()).filter(Boolean);
  if (!inputs.length) return [];

  const results = new Array(inputs.length).fill(null);
  const uncachedIdx = [];
  const uncachedTexts = [];

  for (let i = 0; i < inputs.length; i++) {
    const cached = getCachedEmbedding(inputs[i], { botId: options.botId });
    if (cached) results[i] = cached;
    else { uncachedIdx.push(i); uncachedTexts.push(inputs[i]); }
  }

  if (!uncachedTexts.length) return results;

  try {
    for (let i = 0; i < uncachedTexts.length; i += BATCH_SIZE) {
      const batch = uncachedTexts.slice(i, i + BATCH_SIZE);
      const response = await client.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
      if (response.usage) await recordEmbeddingUsage(options.botId, response.usage);
      response.data.forEach((item, j) => {
        const origIdx = uncachedIdx[i + j];
        results[origIdx] = item.embedding;
        if (item.embedding) cacheEmbedding(uncachedTexts[i + j], item.embedding, { botId: options.botId });
      });
    }
  } catch (error) {
    await recordError("embedding_batch", error?.message || "OpenAI batch error", {
      botId: options.botId,
      context: { model: EMBEDDING_MODEL },
    });
    for (let i = 0; i < uncachedIdx.length; i++) {
      if (!results[uncachedIdx[i]]) {
        results[uncachedIdx[i]] = await getEmbedding(uncachedTexts[i], options);
      }
    }
  }

  return results;
}

export async function embedChunks(chunks, onProgress, options = {}) {
  const client = getClient(options.apiKey);
  if (!client || !chunks?.length) return [];

  const embedded = [];
  const total = chunks.length;
  let processed = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await getEmbeddingBatch(batch, options);
    for (let j = 0; j < batch.length; j++) {
      if (embeddings[j]) embedded.push({ text: batch[j], embedding: embeddings[j] });
      processed++;
      if (onProgress) onProgress(processed, total);
    }
  }
  return embedded;
}

export async function embedChunkDescriptors(descriptors, options = {}) {
  const client = getClient(options.apiKey);
  if (!client || !descriptors?.length) return [];

  const valid = descriptors.filter(d => String(d?.text || "").trim());
  if (!valid.length) return [];

  const texts = valid.map(d => String(d.text || "").trim());
  const embeddings = await getEmbeddingBatch(texts, options);

  return valid
    .map((d, i) => {
      if (!embeddings[i]) return null;
      return d.meta
        ? { text: texts[i], embedding: embeddings[i], meta: d.meta }
        : { text: texts[i], embedding: embeddings[i] };
    })
    .filter(Boolean);
}
