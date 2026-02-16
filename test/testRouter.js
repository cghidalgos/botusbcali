/**
 * Script de prueba para la arquitectura híbrida
 * Ejecutar: node test/testRouter.js
 */

import { detectStructuredIntent } from "../src/router.js";
import { handleStructuredQuery } from "../src/structuredService.js";

console.log("=== TEST: Router de Intención ===\n");

const testQueries = [
  // Materias
  "¿Qué materias hay disponibles?",
  "Cuántos créditos tiene Cálculo I?",
  "Dime sobre programación I",
  
  // Profesores
  "¿Quién es el Dr. Carlos Rodríguez?",
  "Dame la lista de profesores",
  "Cuál es el email del profesor de bases de datos?",
  
  // Horarios
  "¿A qué hora es la clase de Álgebra Lineal?",
  "Horarios del lunes",
  "Dónde es la clase de Inteligencia Artificial?",
  
  // Becas
  "¿Qué becas están disponibles?",
  "Cuáles son los requisitos para la beca de excelencia?",
  "Cómo solicitar una beca?",
  
  // Coordinadores
  "Quién es el coordinador de Ingeniería?",
  "Contacto de bienestar estudiantil",
  
  // Consultas ambiguas (debe ir a GPT)
  "¿Cómo puedo mejorar mis notas?",
  "Cuál es la mejor estrategia para estudiar?",
];

testQueries.forEach((query, index) => {
  console.log(`\n[${index + 1}] Pregunta: "${query}"`);
  
  const intent = detectStructuredIntent(query);
  
  if (intent) {
    console.log(`✓ Intent detectado: ${intent.type}`);
    console.log(`  Keywords: ${intent.keywords.join(", ")}`);
    
    const response = handleStructuredQuery(query, intent);
    
    if (response) {
      console.log(`✓ Respuesta STRUCTURED:`);
      console.log(response.substring(0, 150) + "...");
    } else {
      console.log(`→ FALLBACK a GPT (no se encontró respuesta específica)`);
    }
  } else {
    console.log(`→ No detectado, iría a GPT`);
  }
  
  console.log("-".repeat(80));
});

console.log("\n=== FIN DEL TEST ===");
