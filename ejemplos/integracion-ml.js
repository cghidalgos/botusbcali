/**
 * EJEMPLO PRÁCTICO: Integración de ML Scoring (más simple)
 * 
 * Este es el cambio exacto que harías en server.js para usar ML en lugar de regex
 */

// ========== ANTES (ACTUAL) ==========

import { detectStructuredIntent } from "./router.js";

app.post("/webhook", async (req, res) => {
  // ... código previo ...
  
  try {
    // 1. ROUTER: Detectar si es consulta estructurada
    const intent = detectStructuredIntent(text);  // ← Usa regex
    let reply = null;
    let routeUsed = "GPT";
    
    // ... resto del código ...
  }
});


// ========== DESPUÉS (CON ML SCORING) ==========

import { classifyIntent as detectStructuredIntent } from "./mlClassifier.js";  // ← Solo cambiar esta línea

app.post("/webhook", async (req, res) => {
  // ... código previo ...
  
  try {
    // 1. ROUTER: Detectar si es consulta estructurada
    const intent = detectStructuredIntent(text, 1.5);  // ← threshold opcional
    let reply = null;
    let routeUsed = "GPT";
    
    if (intent) {
      // Ahora tienes intent.confidence y intent.score
      console.log(`[ROUTER] Intent: ${intent.type} (confidence: ${intent.confidence})`);
      reply = handleStructuredQuery(text, intent);
      
      // ... resto del código ...
    }
  }
});


// ========== DESPUÉS (CON EMBEDDINGS) ==========

import { classifyIntentWithEmbeddings } from "./embeddingsClassifier.js";
import { initializeEmbeddingsClassifier } from "./embeddingsClassifier.js";

// Inicializar al arrancar el servidor (solo una vez)
let classifierReady = false;

async function initializeClassifier() {
  if (!classifierReady) {
    console.log("Inicializando clasificador ML...");
    await initializeEmbeddingsClassifier();
    classifierReady = true;
    console.log("✓ Clasificador ML listo");
  }
}

// Llamar después de las configuraciones de app
initializeClassifier();

app.post("/webhook", async (req, res) => {  // ← Ya es async
  // ... código previo ...
  
  try {
    // Esperar a que el clasificador esté listo
    if (!classifierReady) {
      await initializeClassifier();
    }
    
    // 1. ROUTER: Detectar si es consulta estructurada
    const intent = await classifyIntentWithEmbeddings(text, 0.65);  // ← await porque es async
    let reply = null;
    let routeUsed = "GPT";
    
    if (intent) {
      // Ahora tienes intent.similarity y intent.confidence
      console.log(`[ROUTER] Intent: ${intent.type} (similarity: ${intent.similarity})`);
      reply = handleStructuredQuery(text, intent);
      
      // ... resto del código ...
    }
  }
});


// ========== DESPUÉS (CON INTELLIGENT ROUTER - CONFIGURABLE) ==========

import { detectStructuredIntent } from "./intelligentRouter.js";  // ← Cambiar import

// Si usas embeddings en el router, inicializar:
import { initializeEmbeddingsClassifier } from "./embeddingsClassifier.js";

if (process.env.CLASSIFIER_STRATEGY === "embeddings" || 
    process.env.CLASSIFIER_STRATEGY === "hybrid") {
  initializeEmbeddingsClassifier();
}

app.post("/webhook", async (req, res) => {
  // ... código previo ...
  
  try {
    // 1. ROUTER: Detectar si es consulta estructurada
    const intent = await detectStructuredIntent(text);  // ← await por si usa embeddings
    let reply = null;
    let routeUsed = "GPT";
    
    // El resto del código ES EXACTAMENTE IGUAL
    if (intent) {
      console.log(`[ROUTER] Intent detectado: ${intent.type}`);
      reply = handleStructuredQuery(text, intent);
      
      // ... resto del código ...
    }
  }
});
