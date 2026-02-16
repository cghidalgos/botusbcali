/**
 * Router dinámico de intención
 * Lee categorías desde config/categories.json
 */

import { getEnabledCategories, getCategoryConfig } from "./categoryManager.js";

/**
 * Detecta si la pregunta se refiere a datos estructurados
 * Dinámico: usa configuración de categorías
 * @param {string} question - La pregunta del usuario
 * @returns {Object|null} - { type: string, keywords: string[] } o null
 */
export function detectStructuredIntent(question) {
  if (!question || typeof question !== "string") {
    return null;
  }

  const normalizedQuestion = question.toLowerCase().trim();
  const categories = getEnabledCategories();

  // Evaluar cada categoría habilitada
  for (const category of categories) {
    const config = getCategoryConfig(category);
    if (!config || !config.enabled) continue;

    // Construir patrón de keywords
    if (config.keywords && config.keywords.length > 0) {
      const keywordPattern = new RegExp(
        `\\b(${config.keywords.join("|")})\\b`,
        "i"
      );
      if (keywordPattern.test(normalizedQuestion)) {
        return {
          type: category,
          keywords: extractKeywords(normalizedQuestion, config.keywords),
        };
      }
    }

    // Evaluar patrones regex específicos
    if (config.patterns && config.patterns.length > 0) {
      for (const pattern of config.patterns) {
        try {
          const regex = new RegExp(pattern, "i");
          if (regex.test(normalizedQuestion)) {
            return {
              type: category,
              keywords: extractKeywords(normalizedQuestion, config.keywords || []),
            };
          }
        } catch (error) {
          console.error(`[ROUTER] Error en patrón "${pattern}":`, error.message);
        }
      }
    }
  }

  // No se detectó intención estructurada
  return null;
}

/**
 * Extrae palabras clave encontradas en la pregunta
 */
function extractKeywords(question, keywords) {
  if (!keywords || !Array.isArray(keywords)) return [];
  
  return keywords.filter((keyword) => {
    const pattern = new RegExp(`\\b${keyword}\\b`, "i");
    return pattern.test(question);
  });
}
