/**
 * Sistema de aprendizaje automático para preguntas frecuentes
 * Detecta patrones, guarda ejemplos y optimiza el clasificador
 */

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getEmbedding } from "./embeddings.js";
import { addTrainingExample, removeTrainingExample } from "./embeddingsClassifier.js";

const dataPath = path.resolve(process.cwd(), "data", "learned-patterns.json");

// Configuración
const SIMILARITY_THRESHOLD = 0.85; // Qué tan similar debe ser para considerarse igual
const FREQUENCY_THRESHOLD = 3; // Cuántas veces debe repetirse para aprenderla
const MAX_LEARNED_PER_CATEGORY = 50; // Máximo de ejemplos aprendidos por categoría

// Almacenamiento en memoria
let learnedPatterns = {
  materias: [],
  profesores: [],
  horarios: [],
  becas: [],
  coordinadores: [],
  general: [] // Preguntas que no encajan en categorías específicas
};

/**
 * Calcula similitud coseno
 */
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Carga patrones aprendidos desde disco
 */
export async function loadLearnedPatterns() {
  try {
    const content = await fs.readFile(dataPath, "utf8");
    const loaded = JSON.parse(content);
    
    if (loaded && typeof loaded === "object") {
      learnedPatterns = { ...learnedPatterns, ...loaded };

      for (const [category, patterns] of Object.entries(learnedPatterns)) {
        learnedPatterns[category] = patterns.map((pattern) => ({
          id: pattern.id || crypto.randomUUID(),
          category: pattern.category || category,
          ...pattern,
        }));
      }
      
      const total = Object.values(learnedPatterns).reduce(
        (sum, patterns) => sum + patterns.length,
        0
      );
      
      console.log(`[LEARNING] ✓ Cargados ${total} patrones aprendidos`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("[LEARNING] Error cargando patrones:", error.message);
    }
  }
}

/**
 * Guarda patrones aprendidos a disco
 */
async function saveLearnedPatterns() {
  try {
    await fs.writeFile(dataPath, JSON.stringify(learnedPatterns, null, 2), "utf8");
  } catch (error) {
    console.error("[LEARNING] Error guardando patrones:", error.message);
  }
}

/**
 * Registra una pregunta y su categoría detectada
 * @param {string} question - La pregunta del usuario
 * @param {string} category - Categoría detectada (materias, profesores, etc.)
 * @param {string} answer - La respuesta generada (opcional)
 */
export async function recordQuestion(question, category, answer = null) {
  if (!question || typeof question !== "string") {
    return;
  }
  
  const normalizedCategory = category || "general";
  
  if (!learnedPatterns[normalizedCategory]) {
    learnedPatterns[normalizedCategory] = [];
  }
  
  try {
    // Generar embedding de la pregunta
    const questionEmbedding = await getEmbedding(question);
    
    // Buscar si ya existe un patrón similar
    let existingPattern = null;
    let maxSimilarity = 0;
    
    for (const pattern of learnedPatterns[normalizedCategory]) {
      if (!pattern.embedding) continue;
      
      const similarity = cosineSimilarity(questionEmbedding, pattern.embedding);
      
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        if (similarity >= SIMILARITY_THRESHOLD) {
          existingPattern = pattern;
        }
      }
    }
    
    if (existingPattern) {
      // Ya existe, incrementar contador
      existingPattern.frequency += 1;
      existingPattern.lastAsked = new Date().toISOString();
      
      // Si alcanzó el umbral y no está en training, agregarlo
      if (existingPattern.frequency >= FREQUENCY_THRESHOLD && !existingPattern.addedToTraining) {
        console.log(`[LEARNING] ✨ Patrón frecuente detectado (${existingPattern.frequency}x): "${existingPattern.question}"`);
        console.log(`[LEARNING] → Agregando a ejemplos de entrenamiento: ${normalizedCategory}`);
        
        await addTrainingExample(normalizedCategory, existingPattern.question);
        existingPattern.addedToTraining = true;
        
        console.log(`[LEARNING] ✓ Sistema optimizado para esta pregunta`);
      }
      
    } else {
      // Nueva pregunta, crear patrón
      const newPattern = {
        id: crypto.randomUUID(),
        question: question.trim(),
        embedding: questionEmbedding,
        frequency: 1,
        category: normalizedCategory,
        firstAsked: new Date().toISOString(),
        lastAsked: new Date().toISOString(),
        addedToTraining: false,
        answer: answer ? answer.substring(0, 500) : null // Guardar respuesta resumida
      };
      
      learnedPatterns[normalizedCategory].push(newPattern);
      
      // Limitar cantidad de patrones
      if (learnedPatterns[normalizedCategory].length > MAX_LEARNED_PER_CATEGORY) {
        // Ordenar por frecuencia y fecha, eliminar los menos frecuentes/antiguos
        learnedPatterns[normalizedCategory].sort((a, b) => {
          if (b.frequency !== a.frequency) {
            return b.frequency - a.frequency;
          }
          return new Date(b.lastAsked) - new Date(a.lastAsked);
        });
        
        learnedPatterns[normalizedCategory] = learnedPatterns[normalizedCategory].slice(
          0,
          MAX_LEARNED_PER_CATEGORY
        );
      }
    }
    
    // Guardar a disco (async, no bloqueante)
    saveLearnedPatterns().catch(err => 
      console.error("[LEARNING] Error guardando:", err.message)
    );
    
  } catch (error) {
    console.error("[LEARNING] Error registrando pregunta:", error.message);
  }
}

export function listLearnedPatterns() {
  const flattened = [];
  for (const [category, patterns] of Object.entries(learnedPatterns)) {
    for (const pattern of patterns) {
      flattened.push({
        id: pattern.id,
        question: pattern.question,
        frequency: pattern.frequency,
        category: pattern.category || category,
        firstAsked: pattern.firstAsked,
        lastAsked: pattern.lastAsked,
        addedToTraining: Boolean(pattern.addedToTraining),
        answer: pattern.answer || null,
      });
    }
  }
  return flattened;
}

export async function updateLearnedPattern(id, updates) {
  let found = null;
  for (const [category, patterns] of Object.entries(learnedPatterns)) {
    const index = patterns.findIndex((pattern) => pattern.id === id);
    if (index === -1) continue;

    const current = patterns[index];
    const nextCategory = updates.category && learnedPatterns[updates.category]
      ? updates.category
      : current.category || category;

    const updated = {
      ...current,
      question: typeof updates.question === "string" ? updates.question.trim() : current.question,
      frequency: Number.isFinite(Number(updates.frequency)) ? Number(updates.frequency) : current.frequency,
      answer: typeof updates.answer === "string" ? updates.answer.trim().slice(0, 500) : current.answer,
      category: nextCategory,
      lastAsked: new Date().toISOString(),
    };

    if (nextCategory !== category) {
      learnedPatterns[category].splice(index, 1);
      learnedPatterns[nextCategory] = learnedPatterns[nextCategory] || [];
      learnedPatterns[nextCategory].push(updated);
    } else {
      learnedPatterns[category][index] = updated;
    }

    found = updated;
    break;
  }

  if (found) {
    await saveLearnedPatterns();
  }

  return found;
}

export async function deleteLearnedPattern(id) {
  let deleted = null;
  for (const [category, patterns] of Object.entries(learnedPatterns)) {
    const index = patterns.findIndex((pattern) => pattern.id === id);
    if (index === -1) continue;
    const [removed] = learnedPatterns[category].splice(index, 1);
    deleted = removed;
    break;
  }

  if (deleted) {
    if (deleted.addedToTraining && deleted.category) {
      await removeTrainingExample(deleted.category, deleted.question);
    }
    await saveLearnedPatterns();
  }

  return deleted;
}

/**
 * Obtiene estadísticas de aprendizaje
 */
export function getLearningStats() {
  const stats = {};
  
  for (const [category, patterns] of Object.entries(learnedPatterns)) {
    const frequent = patterns.filter(p => p.frequency >= FREQUENCY_THRESHOLD);
    const addedToTraining = patterns.filter(p => p.addedToTraining);
    
    stats[category] = {
      total: patterns.length,
      frequent: frequent.length,
      inTraining: addedToTraining.length,
      topQuestions: patterns
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5)
        .map(p => ({
          question: p.question,
          frequency: p.frequency,
          inTraining: p.addedToTraining
        }))
    };
  }
  
  return stats;
}

/**
 * Busca una respuesta cacheada para una pregunta similar
 * @param {string} question - La pregunta del usuario
 * @returns {Promise<Object|null>} - { answer: string, similarity: number } o null
 */
export async function findCachedAnswer(question, minFrequency = 5) {
  if (!question) return null;
  
  try {
    const questionEmbedding = await getEmbedding(question);
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const patterns of Object.values(learnedPatterns)) {
      for (const pattern of patterns) {
        if (!pattern.answer || !pattern.embedding) continue;
        if (pattern.frequency < minFrequency) continue; // Solo respuestas muy frecuentes
        
        const similarity = cosineSimilarity(questionEmbedding, pattern.embedding);
        
        if (similarity > bestSimilarity && similarity >= 0.92) { // Muy alta similitud
          bestSimilarity = similarity;
          bestMatch = pattern;
        }
      }
    }
    
    if (bestMatch) {
      console.log(`[LEARNING] 🎯 Respuesta cacheada encontrada (${bestMatch.frequency}x, sim: ${bestSimilarity.toFixed(2)})`);
      return {
        answer: bestMatch.answer,
        similarity: bestSimilarity,
        frequency: bestMatch.frequency
      };
    }
    
    return null;
  } catch (error) {
    console.error("[LEARNING] Error buscando cache:", error.message);
    return null;
  }
}

/**
 * Limpia patrones antiguos no utilizados
 */
export async function cleanOldPatterns(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  let cleaned = 0;
  
  for (const [category, patterns] of Object.entries(learnedPatterns)) {
    const before = patterns.length;
    
    learnedPatterns[category] = patterns.filter(p => {
      const lastAsked = new Date(p.lastAsked);
      return lastAsked > cutoffDate || p.addedToTraining || p.frequency >= FREQUENCY_THRESHOLD;
    });
    
    cleaned += before - learnedPatterns[category].length;
  }
  
  if (cleaned > 0) {
    console.log(`[LEARNING] 🧹 Limpiados ${cleaned} patrones antiguos`);
    await saveLearnedPatterns();
  }
  
  return cleaned;
}
