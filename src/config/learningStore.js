// Learning patterns store for AI patterns and common questions
import fs from "fs";
import path from "path";

const DATA_PATH = path.resolve("data/learning.json");
const DATA_DIR = path.dirname(DATA_PATH);
let learningPatterns = [];
let loaded = false;

function loadPatterns() {
  if (loaded) return;
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, "utf8");
      learningPatterns = JSON.parse(raw);
    }
  } catch (e) {
    console.error("No se pudo cargar patrones de aprendizaje", e);
    learningPatterns = [];
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

function persistPatterns() {
  try {
    ensureDataDir();
    fs.writeFileSync(DATA_PATH, JSON.stringify(learningPatterns, null, 2), "utf8");
  } catch (e) {
    console.error("No se pudo persistir patrones de aprendizaje", e);
  }
}

export function getLearningPatterns() {
  loadPatterns();
  return learningPatterns.map(p => ({
    ...p,
  }));
}

export function addLearningPattern(pattern) {
  loadPatterns();
  const newPattern = {
    id: pattern.id || `pattern_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    question: pattern.question,
    frequency: pattern.frequency || 1,
    category: pattern.category || "general",
    firstAsked: pattern.firstAsked || new Date().toISOString(),
    lastAsked: pattern.lastAsked || new Date().toISOString(),
    addedToTraining: pattern.addedToTraining || false,
    answer: pattern.answer || null,
  };
  
  const existing = learningPatterns.find(p => p.id === newPattern.id);
  if (!existing) {
    learningPatterns.push(newPattern);
    persistPatterns();
  }
  
  return newPattern;
}

export function updateLearningPattern(id, updates) {
  loadPatterns();
  const patternIndex = learningPatterns.findIndex(p => p.id === id);
  if (patternIndex === -1) {
    throw new Error(`Patrón ${id} no encontrado`);
  }
  
  learningPatterns[patternIndex] = {
    ...learningPatterns[patternIndex],
    ...updates,
    id: learningPatterns[patternIndex].id, // Preserve ID
  };
  
  persistPatterns();
  return learningPatterns[patternIndex];
}

export function deleteLearningPattern(id) {
  loadPatterns();
  const initialLength = learningPatterns.length;
  learningPatterns = learningPatterns.filter(p => p.id !== id);
  
  if (learningPatterns.length < initialLength) {
    persistPatterns();
    return true;
  }
  return false;
}

export function getLearningStats() {
  loadPatterns();
  const byCategory = {};
  
  learningPatterns.forEach(p => {
    const cat = p.category || "general";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });
  
  return {
    totalPatterns: learningPatterns.length,
    byCategory,
  };
}

export const learningReady = Promise.resolve();
