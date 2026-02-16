/**
 * Clasificador ML Simple basado en Scoring
 * Dinámico: lee categorías desde config/categories.json
 */

import { getEnabledCategories, getCategoryConfig, getAllKeywords } from "./categoryManager.js";

/**
 * Normaliza texto para comparación
 */
function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calcula score de coincidencia para una categoría
 */
function calculateScore(normalizedQuestion, category, config) {
  let score = 0;
  
  // Score por keywords
  if (config.keywords) {
    for (const keyword of config.keywords) {
      const normalizedKeyword = normalize(keyword);
      if (normalizedQuestion.includes(normalizedKeyword)) {
        score += 1;
      }
    }
  }
  
  // Score por patrones (frases completas valen más)
  if (config.patterns) {
    for (const pattern of config.patterns) {
      const normalizedPattern = normalize(pattern);
      if (normalizedQuestion.includes(normalizedPattern)) {
        score += 2; // Patrones valen el doble
      }
    }
  }

  // Score por listPatterns (si pregunta por lista)
  if (config.listPatterns) {
    for (const pattern of config.listPatterns) {
      const normalizedPattern = normalize(pattern);
      if (normalizedQuestion.includes(normalizedPattern)) {
        score += 1.5; // Preguntas por lista valen más
      }
    }
  }

  // Aplicar peso de la categoría
  score *= (config.weight || 1.0);
  
  return score;
}

/**
 * Clasifica una pregunta usando el modelo de scoring dinámico
 * @param {string} question - La pregunta del usuario
 * @param {number} threshold - Score mínimo para clasificar (default: 1)
 * @returns {Object|null} - { type: string, confidence: number } o null
 */
export function classifyIntent(question, threshold = 1) {
  if (!question || typeof question !== "string") {
    return null;
  }

  const normalizedQuestion = normalize(question);
  const scores = {};
  
  // Calcular score para cada categoría habilitada
  const categories = getEnabledCategories();
  
  for (const category of categories) {
    const config = getCategoryConfig(category);
    if (config) {
      scores[category] = calculateScore(normalizedQuestion, category, config);
    }
  }
  
  // Encontrar la categoría con mayor score
  const sortedCategories = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .filter(([, score]) => score >= threshold);
  
  if (sortedCategories.length === 0) {
    return null;
  }
  
  const [topCategory, topScore] = sortedCategories[0];
  const [, secondScore] = sortedCategories[1] || [null, 0];
  
  // Calcular confianza (entre 0 y 1)
  const confidence = Math.min(1, topScore / 5);
  
  return {
    type: topCategory,
    score: topScore,
    confidence: confidence,
    keywords: (getCategoryConfig(topCategory)?.keywords || []).filter(
      kw => normalizedQuestion.includes(normalize(kw))
    ),
  };
}
