// Categories store for AI response categories
import fs from "fs";
import path from "path";
import { DEFAULT_BOT_ID, normalizeBotId } from "./botContext.js";

const DATA_PATH = path.resolve("data/categories.json");
const DATA_DIR = path.dirname(DATA_PATH);
let categories = [];
let suggestedCategories = [];
let loaded = false;

function loadData() {
  if (loaded) return;
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, "utf8");
      const data = JSON.parse(raw);
      categories = (data.categories || []).map((cat) => ({
        botId: normalizeBotId(cat?.botId || DEFAULT_BOT_ID),
        ...cat,
      }));
      suggestedCategories = (data.suggested || []).map((suggestion) => ({
        botId: normalizeBotId(suggestion?.botId || DEFAULT_BOT_ID),
        ...suggestion,
      }));
    }
  } catch (e) {
    console.error("No se pudo cargar categorías", e);
    categories = [];
    suggestedCategories = [];
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

function persistData() {
  try {
    ensureDataDir();
    fs.writeFileSync(
      DATA_PATH,
      JSON.stringify({ categories, suggested: suggestedCategories }, null, 2),
      "utf8"
    );
  } catch (e) {
    console.error("No se pudo persistir categorías", e);
  }
}

export function getCategories(botId) {
  loadData();
  const resolved = normalizeBotId(botId);
  return categories
    .filter((c) => normalizeBotId(c?.botId) === resolved)
    .map(c => ({
      name: c.name,
      displayName: c.displayName,
      enabled: c.enabled !== undefined ? c.enabled : true,
      keywords: c.keywords || [],
      keywordsCount: (c.keywords || []).length,
      patternsCount: c.patternsCount || 0,
    }));
}

export function addCategory(name, displayName, keywords = [], botId) {
  loadData();
  const resolved = normalizeBotId(botId);
  
  const existing = categories.find(c => c.name === name && normalizeBotId(c?.botId) === resolved);
  if (existing) {
    return existing;
  }
  
  const newCategory = {
    name,
    displayName: displayName || name,
    enabled: true,
    keywords,
    patternsCount: 0,
    botId: resolved,
  };
  
  categories.push(newCategory);
  persistData();
  
  return newCategory;
}

export function deleteCategory(name, botId) {
  loadData();
  const resolved = normalizeBotId(botId);
  const initialLength = categories.length;
  categories = categories.filter(c => !(c.name === name && normalizeBotId(c?.botId) === resolved));
  
  if (categories.length < initialLength) {
    persistData();
    return true;
  }
  return false;
}

export function updateCategory(name, updates, botId) {
  loadData();
  const resolved = normalizeBotId(botId);
  const categoryIndex = categories.findIndex(c => c.name === name && normalizeBotId(c?.botId) === resolved);
  if (categoryIndex === -1) {
    throw new Error(`Categoría ${name} no encontrada`);
  }
  
  categories[categoryIndex] = {
    ...categories[categoryIndex],
    ...updates,
    name: categories[categoryIndex].name, // Preserve name
    botId: resolved,
  };
  
  persistData();
  return categories[categoryIndex];
}

// Suggested categories
export function getSuggestedCategories(botId) {
  loadData();
  const resolved = normalizeBotId(botId);
  return suggestedCategories
    .filter((s) => normalizeBotId(s?.botId) === resolved)
    .map(s => ({
      ...s,
    }));
}

export function getSuggestedCategoriesPending(botId) {
  loadData();
  const resolved = normalizeBotId(botId);
  return suggestedCategories
    .filter(s => normalizeBotId(s?.botId) === resolved && s.status !== "approved" && s.status !== "rejected")
    .map(s => ({
      ...s,
    }));
}

export function addSuggestedCategory(category, botId) {
  loadData();
  const resolved = normalizeBotId(botId);
  
  const newSuggestion = {
    id: `suggested_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: category.name,
    displayName: category.displayName || category.name,
    confidence: category.confidence || 0.5,
    keywords: category.keywords || [],
    status: category.status || "pending",
    suggestedAt: new Date().toISOString(),
    approvedAt: null,
    approverUserId: null,
    botId: resolved,
  };
  
  suggestedCategories.push(newSuggestion);
  persistData();
  
  return newSuggestion;
}

export function approveSuggestedCategory(id, approverUserId, botId) {
  loadData();
  const resolved = normalizeBotId(botId);
  const suggestIndex = suggestedCategories.findIndex(s => s.id === id && normalizeBotId(s?.botId) === resolved);
  if (suggestIndex === -1) {
    throw new Error(`Sugerencia ${id} no encontrada`);
  }
  
  const suggestion = suggestedCategories[suggestIndex];
  
  // Add as regular category
  addCategory(suggestion.name, suggestion.displayName, suggestion.keywords, resolved);
  
  // Update suggestion status
  suggestedCategories[suggestIndex] = {
    ...suggestion,
    status: "approved",
    approvedAt: new Date().toISOString(),
    approverUserId: approverUserId || null,
    botId: resolved,
  };
  
  persistData();
  
  return suggestedCategories[suggestIndex];
}

export function rejectSuggestedCategory(id, botId) {
  loadData();
  const resolved = normalizeBotId(botId);
  const suggestIndex = suggestedCategories.findIndex(s => s.id === id && normalizeBotId(s?.botId) === resolved);
  if (suggestIndex === -1) {
    throw new Error(`Sugerencia ${id} no encontrada`);
  }
  
  suggestedCategories[suggestIndex] = {
    ...suggestedCategories[suggestIndex],
    status: "rejected",
    botId: resolved,
  };
  
  persistData();
  
  return suggestedCategories[suggestIndex];
}

export function updateSuggestedCategory(id, updates, botId) {
  loadData();
  const resolved = normalizeBotId(botId);
  const suggestIndex = suggestedCategories.findIndex(s => s.id === id && normalizeBotId(s?.botId) === resolved);
  if (suggestIndex === -1) {
    throw new Error(`Sugerencia ${id} no encontrada`);
  }
  
  suggestedCategories[suggestIndex] = {
    ...suggestedCategories[suggestIndex],
    ...updates,
    id: suggestedCategories[suggestIndex].id, // Preserve ID
    botId: resolved,
  };
  
  persistData();
  
  return suggestedCategories[suggestIndex];
}

export const categoriesReady = Promise.resolve();
