import { DEFAULT_BOT_ID, normalizeBotId } from "./botContext.js";

// Cache stats store for tracking API call savings
let cacheStats = {};

function getStatsState(botId) {
  const resolved = normalizeBotId(botId || DEFAULT_BOT_ID);
  if (!cacheStats[resolved]) {
    cacheStats[resolved] = {
      totalEntries: 0,
      totalHits: 0,
      usedEntries: 0,
      avgHitsPerEntry: 0,
      estimatedSavings: {
        apiCalls: 0,
        dollars: 0,
      },
    };
  }
  return cacheStats[resolved];
}

export function getCacheStats(botId) {
  const stats = getStatsState(botId);
  return {
    ...stats,
  };
}

export function recordCacheHit(botId) {
  const stats = getStatsState(botId);
  stats.totalHits += 1;
  stats.usedEntries = Math.min(stats.totalHits, stats.totalEntries || 1);
  
  if (stats.totalEntries > 0) {
    stats.avgHitsPerEntry = Math.round(stats.totalHits / stats.totalEntries);
  }
  
  // Estimate: ~$0.10 per 1k requests to GPT
  stats.estimatedSavings.apiCalls = stats.totalHits;
  stats.estimatedSavings.dollars = Math.round((stats.totalHits / 1000) * 0.10 * 100) / 100;
}

export function recordCacheEntry(botId) {
  const stats = getStatsState(botId);
  stats.totalEntries += 1;
  
  if (stats.totalEntries > 0) {
    stats.avgHitsPerEntry = Math.round(stats.totalHits / stats.totalEntries);
  }
}

export function resetCacheStats(botId) {
  if (botId) {
    const resolved = normalizeBotId(botId);
    delete cacheStats[resolved];
    return;
  }
  cacheStats = {};
}

export const cacheReady = Promise.resolve();
