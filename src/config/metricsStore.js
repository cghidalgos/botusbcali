import fs from "fs/promises";
import path from "path";
import { DEFAULT_BOT_ID, normalizeBotId } from "./botContext.js";

const dataDir = path.resolve(process.cwd(), "data");
const metricsPath = path.join(dataDir, "metrics.json");

const metricsState = {
  bots: {},
};

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function loadMetrics() {
  try {
    const raw = await fs.readFile(metricsPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.bots) {
      metricsState.bots = parsed.bots;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("No se pudieron cargar métricas", error);
    }
  }
}

async function persistMetrics() {
  try {
    await ensureDataDir();
    await fs.writeFile(metricsPath, JSON.stringify(metricsState, null, 2), "utf8");
  } catch (error) {
    console.error("No se pudieron guardar métricas", error);
  }
}

export const metricsReady = loadMetrics();

function getBotMetrics(botId) {
  const resolved = normalizeBotId(botId || DEFAULT_BOT_ID);
  if (!metricsState.bots[resolved]) {
    metricsState.bots[resolved] = {
      daily: {},
      questions: {},
    };
  }
  return metricsState.bots[resolved];
}

function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getDailyEntry(botId, dateKey) {
  const state = getBotMetrics(botId);
  if (!state.daily[dateKey]) {
    state.daily[dateKey] = {
      openai: {
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
      embeddings: {
        requests: 0,
        totalTokens: 0,
      },
      questions: 0,
      answers: 0,
    };
  }
  return state.daily[dateKey];
}

function normalizeQuestion(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\t\n\r]+/g, " ")
    .trim();
}

function getCostRates() {
  const prompt = Number.parseFloat(process.env.OPENAI_COST_PROMPT_PER_1M || "0");
  const completion = Number.parseFloat(process.env.OPENAI_COST_COMPLETION_PER_1M || "0");
  const embeddings = Number.parseFloat(process.env.OPENAI_COST_EMBEDDING_PER_1M || "0");
  return {
    prompt: Number.isFinite(prompt) ? prompt : 0,
    completion: Number.isFinite(completion) ? completion : 0,
    embeddings: Number.isFinite(embeddings) ? embeddings : 0,
  };
}

export async function recordChatCompletionUsage(botId, usage = {}) {
  const dateKey = getDateKey();
  const entry = getDailyEntry(botId, dateKey);
  const promptTokens = Number(usage.prompt_tokens || 0);
  const completionTokens = Number(usage.completion_tokens || 0);
  const cacheReadTokens = Number(usage.cache_read_tokens || 0);
  const cacheCreationTokens = Number(usage.cache_creation_tokens || 0);
  const totalTokens = Number(
    usage.total_tokens ||
      promptTokens + completionTokens + cacheReadTokens + cacheCreationTokens ||
      0
  );
  const rates = getCostRates();
  // Multiplicadores de prompt caching de Anthropic: escribir a caché cuesta
  // 1.25x el precio de entrada; leer de caché cuesta 0.1x. Incluirlos hace que
  // estimatedCost refleje el efecto real del caché.
  const cost =
    (promptTokens / 1_000_000) * rates.prompt +
    (cacheCreationTokens / 1_000_000) * rates.prompt * 1.25 +
    (cacheReadTokens / 1_000_000) * rates.prompt * 0.1 +
    (completionTokens / 1_000_000) * rates.completion;

  entry.openai.requests += 1;
  entry.openai.promptTokens += promptTokens;
  entry.openai.completionTokens += completionTokens;
  entry.openai.cacheReadTokens = (entry.openai.cacheReadTokens || 0) + cacheReadTokens;
  entry.openai.cacheCreationTokens = (entry.openai.cacheCreationTokens || 0) + cacheCreationTokens;
  entry.openai.totalTokens += totalTokens;
  entry.openai.estimatedCost = Number((entry.openai.estimatedCost + cost).toFixed(6));
  entry.answers += 1;

  await persistMetrics();
}

export async function recordEmbeddingUsage(botId, usage = {}) {
  const dateKey = getDateKey();
  const entry = getDailyEntry(botId, dateKey);
  const totalTokens = Number(usage.total_tokens || 0);
  const rates = getCostRates();
  const cost = (totalTokens / 1_000_000) * rates.embeddings;

  entry.embeddings.requests += 1;
  entry.embeddings.totalTokens += totalTokens;
  entry.openai.estimatedCost = Number((entry.openai.estimatedCost + cost).toFixed(6));

  await persistMetrics();
}

export async function recordQuestion(botId, question) {
  const normalized = normalizeQuestion(question);
  if (!normalized) return;
  const state = getBotMetrics(botId);
  const dateKey = getDateKey();
  const entry = getDailyEntry(botId, dateKey);
  entry.questions += 1;

  if (!state.questions[normalized]) {
    state.questions[normalized] = {
      text: question,
      count: 0,
      lastAskedAt: new Date().toISOString(),
    };
  }
  state.questions[normalized].count += 1;
  state.questions[normalized].lastAskedAt = new Date().toISOString();

  const keys = Object.keys(state.questions);
  if (keys.length > 300) {
    keys
      .sort((a, b) => state.questions[a].count - state.questions[b].count)
      .slice(0, keys.length - 250)
      .forEach((key) => delete state.questions[key]);
  }

  await persistMetrics();
}

export function getMetricsOverview(botId, days = 7) {
  const resolved = normalizeBotId(botId || DEFAULT_BOT_ID);
  const state = getBotMetrics(resolved);
  const results = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = getDateKey(date);
    const entry = state.daily[key] || {
      openai: {
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
      embeddings: {
        requests: 0,
        totalTokens: 0,
      },
      questions: 0,
      answers: 0,
    };
    results.push({ date: key, ...entry });
  }

  return { botId: resolved, days, data: results };
}

export function getTopQuestions(botId, limit = 10) {
  const resolved = normalizeBotId(botId || DEFAULT_BOT_ID);
  const state = getBotMetrics(resolved);
  return Object.values(state.questions)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((item) => ({
      text: item.text,
      count: item.count,
      lastAskedAt: item.lastAskedAt,
    }));
}
