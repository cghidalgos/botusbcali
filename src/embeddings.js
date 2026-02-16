import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

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

export async function getEmbedding(text) {
  if (!client) return null;
  const input = String(text || "").slice(0, 4000);
  if (!input.trim()) return null;
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });
  return response.data?.[0]?.embedding || null;
}

export async function embedChunks(chunks, onProgress) {
  if (!client) return [];
  const embedded = [];
  const total = chunks.length;
  for (let index = 0; index < total; index += 1) {
    const chunk = chunks[index];
    const embedding = await getEmbedding(chunk);
    if (embedding) {
      embedded.push({ text: chunk, embedding });
    }
    if (onProgress) {
      onProgress(index + 1, total);
    }
  }
  return embedded;
}

export async function embedChunkDescriptors(descriptors) {
  if (!client) return [];
  const embedded = [];
  for (const descriptor of descriptors || []) {
    const text = String(descriptor?.text || "").trim();
    if (!text) continue;
    const embedding = await getEmbedding(text);
    if (embedding) {
      const meta = descriptor?.meta;
      embedded.push(meta ? { text, embedding, meta } : { text, embedding });
    }
  }
  return embedded;
}
