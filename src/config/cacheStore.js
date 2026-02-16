// Cache stats store for tracking API call savings
let cacheStats = {
  totalEntries: 0,
  totalHits: 0,
  usedEntries: 0,
  avgHitsPerEntry: 0,
  estimatedSavings: {
    apiCalls: 0,
    dollars: 0,
  },
};

export function getCacheStats() {
  return {
    ...cacheStats,
  };
}

export function recordCacheHit() {
  cacheStats.totalHits += 1;
  cacheStats.usedEntries = Math.min(cacheStats.totalHits, cacheStats.totalEntries || 1);
  
  if (cacheStats.totalEntries > 0) {
    cacheStats.avgHitsPerEntry = Math.round(cacheStats.totalHits / cacheStats.totalEntries);
  }
  
  // Estimate: ~$0.10 per 1k requests to GPT
  cacheStats.estimatedSavings.apiCalls = cacheStats.totalHits;
  cacheStats.estimatedSavings.dollars = Math.round((cacheStats.totalHits / 1000) * 0.10 * 100) / 100;
}

export function recordCacheEntry() {
  cacheStats.totalEntries += 1;
  
  if (cacheStats.totalEntries > 0) {
    cacheStats.avgHitsPerEntry = Math.round(cacheStats.totalHits / cacheStats.totalEntries);
  }
}

export function resetCacheStats() {
  cacheStats = {
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

export const cacheReady = Promise.resolve();
