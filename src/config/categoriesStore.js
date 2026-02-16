// Categories store for AI response categories
import fs from "fs";
import path from "path";

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
      categories = data.categories || [];
      suggestedCategories = data.suggested || [];
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

export function getCategories() {
  loadData();
  return categories.map(c => ({
    name: c.name,
    displayName: c.displayName,
    enabled: c.enabled !== undefined ? c.enabled : true,
    keywords: c.keywords || [],
    keywordsCount: (c.keywords || []).length,
    patternsCount: c.patternsCount || 0,
  }));
}

export function addCategory(name, displayName, keywords = []) {
  loadData();
  
  const existing = categories.find(c => c.name === name);
  if (existing) {
    return existing;
  }
  
  const newCategory = {
    name,
    displayName: displayName || name,
    enabled: true,
    keywords,
    patternsCount: 0,
  };
  
  categories.push(newCategory);
  persistData();
  
  return newCategory;
}

export function deleteCategory(name) {
  loadData();
  const initialLength = categories.length;
  categories = categories.filter(c => c.name !== name);
  
  if (categories.length < initialLength) {
    persistData();
    return true;
  }
  return false;
}

export function updateCategory(name, updates) {
  loadData();
  const categoryIndex = categories.findIndex(c => c.name === name);
  if (categoryIndex === -1) {
    throw new Error(`Categoría ${name} no encontrada`);
  }
  
  categories[categoryIndex] = {
    ...categories[categoryIndex],
    ...updates,
    name: categories[categoryIndex].name, // Preserve name
  };
  
  persistData();
  return categories[categoryIndex];
}

// Suggested categories
export function getSuggestedCategories() {
  loadData();
  return suggestedCategories.map(s => ({
    ...s,
  }));
}

export function getSuggestedCategoriesPending() {
  loadData();
  return suggestedCategories
    .filter(s => s.status !== "approved" && s.status !== "rejected")
    .map(s => ({
      ...s,
    }));
}

export function addSuggestedCategory(category) {
  loadData();
  
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
  };
  
  suggestedCategories.push(newSuggestion);
  persistData();
  
  return newSuggestion;
}

export function approveSuggestedCategory(id, approverUserId) {
  loadData();
  const suggestIndex = suggestedCategories.findIndex(s => s.id === id);
  if (suggestIndex === -1) {
    throw new Error(`Sugerencia ${id} no encontrada`);
  }
  
  const suggestion = suggestedCategories[suggestIndex];
  
  // Add as regular category
  addCategory(suggestion.name, suggestion.displayName, suggestion.keywords);
  
  // Update suggestion status
  suggestedCategories[suggestIndex] = {
    ...suggestion,
    status: "approved",
    approvedAt: new Date().toISOString(),
    approverUserId: approverUserId || null,
  };
  
  persistData();
  
  return suggestedCategories[suggestIndex];
}

export function rejectSuggestedCategory(id) {
  loadData();
  const suggestIndex = suggestedCategories.findIndex(s => s.id === id);
  if (suggestIndex === -1) {
    throw new Error(`Sugerencia ${id} no encontrada`);
  }
  
  suggestedCategories[suggestIndex] = {
    ...suggestedCategories[suggestIndex],
    status: "rejected",
  };
  
  persistData();
  
  return suggestedCategories[suggestIndex];
}

export function updateSuggestedCategory(id, updates) {
  loadData();
  const suggestIndex = suggestedCategories.findIndex(s => s.id === id);
  if (suggestIndex === -1) {
    throw new Error(`Sugerencia ${id} no encontrada`);
  }
  
  suggestedCategories[suggestIndex] = {
    ...suggestedCategories[suggestIndex],
    ...updates,
    id: suggestedCategories[suggestIndex].id, // Preserve ID
  };
  
  persistData();
  
  return suggestedCategories[suggestIndex];
}

export const categoriesReady = Promise.resolve();
