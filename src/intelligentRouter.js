/**
 * Router de intención con clasificadores ML
 * Puedes elegir entre 3 estrategias:
 * 1. Regex (actual, rápido, simple)
 * 2. ML Scoring (mejorado, sin API calls)
 * 3. Embeddings (robusto, requiere OpenAI)
 */

// Estrategia actual (regex)
import { detectStructuredIntent as detectWithRegex } from "./router.js";

// Opción 1: Clasificador por scoring
import { classifyIntent as classifyWithScoring } from "./mlClassifier.js";

// Opción 2: Clasificador con embeddings
import { classifyIntentWithEmbeddings } from "./embeddingsClassifier.js";

// Configuración: elige tu estrategia
const STRATEGY = process.env.CLASSIFIER_STRATEGY || "scoring"; // "regex" | "scoring" | "embeddings"

/**
 * Detecta intención usando la estrategia configurada
 * @param {string} question - La pregunta del usuario
 * @returns {Promise<Object|null>} - { type: string, confidence?: number, ... } o null
 */
export async function detectIntent(question) {
  switch (STRATEGY) {
    case "regex":
      console.log("[CLASSIFIER] Usando estrategia: REGEX");
      return detectWithRegex(question);
    
    case "scoring":
      console.log("[CLASSIFIER] Usando estrategia: ML SCORING");
      const scoringResult = classifyWithScoring(question, 1.0); // threshold ajustable
      if (scoringResult) {
        console.log(`[CLASSIFIER] Score: ${scoringResult.score}, Confidence: ${scoringResult.confidence}`);
      }
      return scoringResult;
    
    case "embeddings":
      console.log("[CLASSIFIER] Usando estrategia: EMBEDDINGS");
      const embeddingsResult = await classifyIntentWithEmbeddings(question, 0.65); // threshold ajustable
      if (embeddingsResult) {
        console.log(`[CLASSIFIER] Similarity: ${embeddingsResult.similarity}, Confidence: ${embeddingsResult.confidence}`);
      }
      return embeddingsResult;
    
    default:
      console.warn(`[CLASSIFIER] Estrategia desconocida: ${STRATEGY}, usando regex por defecto`);
      return detectWithRegex(question);
  }
}

/**
 * Estrategia híbrida: combina múltiples clasificadores
 * @param {string} question - La pregunta del usuario
 * @returns {Promise<Object|null>}
 */
export async function detectIntentHybrid(question) {
  console.log("[CLASSIFIER] Usando estrategia: HYBRID");
  
  // 1. Intentar con scoring (rápido, sin API call)
  const scoringResult = classifyWithScoring(question, 1.0);
  
  if (scoringResult && scoringResult.confidence > 0.6) {
    console.log(`[CLASSIFIER] Alta confianza con scoring (${scoringResult.confidence})`);
    return scoringResult;
  }
  
  // 2. Si scoring no es concluyente, usar embeddings
  console.log("[CLASSIFIER] Scoring inconcluyente, consultando embeddings...");
  const embeddingsResult = await classifyIntentWithEmbeddings(question, 0.6);
  
  if (embeddingsResult) {
    console.log(`[CLASSIFIER] Embeddings similarity: ${embeddingsResult.similarity}`);
    return embeddingsResult;
  }
  
  // 3. Fallback a regex
  console.log("[CLASSIFIER] Embeddings inconcluyente, usando regex fallback");
  return detectWithRegex(question);
}

// Exportar función principal basada en configuración
export const detectStructuredIntent = STRATEGY === "hybrid" 
  ? detectIntentHybrid 
  : detectIntent;
