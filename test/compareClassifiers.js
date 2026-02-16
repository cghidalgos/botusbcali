/**
 * Script de comparación entre estrategias de clasificación
 * Ejecutar: node test/compareClassifiers.js
 */

import { detectStructuredIntent as detectWithRegex } from "../src/router.js";
import { classifyIntent as classifyWithScoring } from "../src/mlClassifier.js";
import { 
  classifyIntentWithEmbeddings, 
  initializeEmbeddingsClassifier 
} from "../src/embeddingsClassifier.js";

console.log("=== COMPARACIÓN DE CLASIFICADORES ===\n");

const testQueries = [
  // Materias
  "¿Qué materias hay disponibles?",
  "Cuántos créditos tiene Cálculo I?",
  "Info sobre programación",
  
  // Profesores
  "¿Quién es el Dr. Carlos?",
  "Dame el contacto del profesor de bases de datos",
  
  // Horarios
  "¿Cuándo es la clase de álgebra?",
  "Horario del lunes",
  
  // Becas
  "¿Qué becas puedo solicitar?",
  "Requisitos para obtener ayuda económica",
  
  // Coordinadores
  "Contacto del coordinador de ingeniería",
  
  // Ambiguo (debería ir a GPT)
  "¿Cómo puedo mejorar mis calificaciones?",
  "Dame consejos para estudiar mejor",
];

async function runComparison() {
  // Inicializar clasificador de embeddings
  console.log("Inicializando clasificador de embeddings...\n");
  await initializeEmbeddingsClassifier();
  console.log("\n" + "=".repeat(80) + "\n");
  
  for (const query of testQueries) {
    console.log(`\n📝 Pregunta: "${query}"`);
    console.log("-".repeat(80));
    
    // 1. Regex
    const regexResult = detectWithRegex(query);
    console.log(`\n1️⃣ REGEX:     ${regexResult ? `✓ ${regexResult.type}` : "✗ No detectado → GPT"}`);
    
    // 2. ML Scoring
    const scoringResult = classifyWithScoring(query, 1.0);
    if (scoringResult) {
      console.log(`2️⃣ SCORING:   ✓ ${scoringResult.type} (score: ${scoringResult.score}, conf: ${scoringResult.confidence})`);
    } else {
      console.log(`2️⃣ SCORING:   ✗ No detectado → GPT`);
    }
    
    // 3. Embeddings
    try {
      const embeddingsResult = await classifyIntentWithEmbeddings(query, 0.6);
      if (embeddingsResult) {
        console.log(`3️⃣ EMBEDDINGS: ✓ ${embeddingsResult.type} (sim: ${embeddingsResult.similarity}, conf: ${embeddingsResult.confidence})`);
      } else {
        console.log(`3️⃣ EMBEDDINGS: ✗ No detectado → GPT`);
      }
    } catch (error) {
      console.log(`3️⃣ EMBEDDINGS: ✗ Error: ${error.message}`);
    }
    
    // Análisis
    const results = [regexResult?.type, scoringResult?.type];
    const allAgree = results.every(r => r === results[0]);
    
    if (allAgree && regexResult) {
      console.log(`\n✅ Consenso: Todos clasifican como "${regexResult.type}"`);
    } else if (!regexResult && !scoringResult) {
      console.log(`\n✅ Consenso: Ninguno clasifica → GPT correcto`);
    } else {
      console.log(`\n⚠️  Discrepancia entre clasificadores`);
    }
    
    console.log("=".repeat(80));
  }
  
  console.log("\n\n=== FIN DE LA COMPARACIÓN ===\n");
  
  // Recomendaciones
  console.log("📊 RECOMENDACIONES:\n");
  console.log("• REGEX:      Rápido, simple, bueno para patrones claros");
  console.log("• SCORING:    Mejor precisión, sin costo API, recomendado para producción");
  console.log("• EMBEDDINGS: Máxima precisión semántica, requiere OpenAI, más lento");
  console.log("• HYBRID:     Usa scoring primero, embeddings si hay duda (mejor balance)\n");
}

runComparison().catch(console.error);
