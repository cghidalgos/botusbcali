/**
 * Clasificador ML basado en Embeddings de OpenAI
 * Usa similitud semántica para clasificar intenciones
 */

import { getEmbedding } from "./embeddings.js";

// Ejemplos de referencia para cada categoría (training data)
const TRAINING_EXAMPLES = {
  materias: [],
  
  profesores: [],
  
  horarios: [],
  
  becas: [],
  
  coordinadores: []
};

// Cache de embeddings
let embeddingsCache = null;

/**
 * Pre-calcula embeddings para todos los ejemplos
 * Debe llamarse al iniciar el servidor
 */
export async function initializeEmbeddingsClassifier() {
  console.log("[ML] Inicializando clasificador con embeddings...");
  
  embeddingsCache = {};
  
  for (const [category, examples] of Object.entries(TRAINING_EXAMPLES)) {
    embeddingsCache[category] = [];
    
    for (const example of examples) {
      try {
        const embedding = await getEmbedding(example);
        embeddingsCache[category].push({
          text: example,
          embedding: embedding
        });
      } catch (error) {
        console.error(`[ML] Error generando embedding para "${example}":`, error.message);
      }
    }
    
    console.log(`[ML] ${category}: ${embeddingsCache[category].length} ejemplos cargados`);
  }
  
  console.log("[ML] Clasificador inicializado correctamente");
  return embeddingsCache;
}

/**
 * Calcula similitud coseno entre dos vectores
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
 * Clasifica una pregunta usando embeddings semánticos
 * @param {string} question - La pregunta del usuario
 * @param {number} threshold - Similitud mínima para clasificar (0-1, default: 0.6)
 * @returns {Promise<Object|null>} - { type: string, confidence: number, similarity: number } o null
 */
export async function classifyIntentWithEmbeddings(question, threshold = 0.6) {
  if (!question || typeof question !== "string") {
    return null;
  }
  
  // Verificar que el clasificador esté inicializado
  if (!embeddingsCache) {
    console.warn("[ML] Clasificador no inicializado, llamando initialize...");
    await initializeEmbeddingsClassifier();
  }
  
  try {
    // Generar embedding de la pregunta
    const questionEmbedding = await getEmbedding(question);
    
    // Calcular similitud con cada categoría
    const categoryScores = {};
    
    for (const [category, examples] of Object.entries(embeddingsCache)) {
      // Calcular similitud promedio con todos los ejemplos de la categoría
      const similarities = examples.map(ex => 
        cosineSimilarity(questionEmbedding, ex.embedding)
      );
      
      // Usar la similitud máxima (mejor match)
      categoryScores[category] = Math.max(...similarities);
    }
    
    // Encontrar la categoría con mayor similitud
    const sortedCategories = Object.entries(categoryScores)
      .sort(([, a], [, b]) => b - a)
      .filter(([, score]) => score >= threshold);
    
    if (sortedCategories.length === 0) {
      return null; // Ninguna categoría supera el umbral
    }
    
    const [topCategory, topSimilarity] = sortedCategories[0];
    const [, secondSimilarity] = sortedCategories[1] || [null, 0];
    
    // Calcular confianza basada en la diferencia con la segunda opción
    const gap = topSimilarity - secondSimilarity;
    const confidence = Math.min(topSimilarity + (gap * 0.5), 1.0);
    
    return {
      type: topCategory,
      confidence: Math.round(confidence * 100) / 100,
      similarity: Math.round(topSimilarity * 100) / 100
    };
    
  } catch (error) {
    console.error("[ML] Error en clasificación:", error.message);
    return null;
  }
}

/**
 * Agrega un nuevo ejemplo de entrenamiento
 * @param {string} category - Categoría
 * @param {string} example - Ejemplo de pregunta
 */
export async function addTrainingExample(category, example) {
  if (!TRAINING_EXAMPLES[category]) {
    console.error(`[ML] Categoría desconocida: ${category}`);
    return false;
  }
  
  // Verificar si ya existe el ejemplo
  if (TRAINING_EXAMPLES[category].includes(example)) {
    console.log(`[ML] Ejemplo ya existe en ${category}: "${example}"`);
    return true;
  }
  
  try {
    TRAINING_EXAMPLES[category].push(example);
    
    // Re-generar embedding si el cache está inicializado
    if (embeddingsCache && embeddingsCache[category]) {
      const embedding = await getEmbedding(example);
      embeddingsCache[category].push({
        text: example,
        embedding: embedding
      });
      console.log(`[ML] ✓ Nuevo ejemplo agregado a ${category}: "${example}"`);
    }
    
    return true;
  } catch (error) {
    console.error("[ML] Error agregando ejemplo:", error.message);
    return false;
  }
}

export async function removeTrainingExample(category, example) {
  if (!TRAINING_EXAMPLES[category]) {
    return false;
  }

  const index = TRAINING_EXAMPLES[category].indexOf(example);
  if (index === -1) {
    return false;
  }

  TRAINING_EXAMPLES[category].splice(index, 1);

  if (embeddingsCache && embeddingsCache[category]) {
    embeddingsCache[category] = embeddingsCache[category].filter(
      (entry) => entry.text !== example
    );
  }

  return true;
}

/**
 * Retorna estadísticas del clasificador
 */
export function getClassifierStats() {
  if (!embeddingsCache) {
    return { status: "no_inicializado" };
  }
  
  const stats = {};
  for (const [category, examples] of Object.entries(embeddingsCache)) {
    stats[category] = examples.length;
  }
  
  return {
    status: "inicializado",
    categorias: Object.keys(embeddingsCache).length,
    ejemplos_por_categoria: stats,
    total_ejemplos: Object.values(stats).reduce((sum, n) => sum + n, 0)
  };
}
