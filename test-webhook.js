import dotenv from "dotenv";
import { composeResponse } from "./src/openai.js";
import { getContextState } from "./src/config/contextStore.js";
import { listDocuments } from "./src/config/documentStore.js";

dotenv.config();

async function testWebhookFlow() {
  console.log("=== Test de flujo del webhook ===\n");
  
  try {
    console.log("1. Cargando contexto...");
    const context = getContextState();
    console.log("✓ Contexto cargado");
    console.log("   Prompt activo:", context.activePrompt ? "Sí" : "No");
    
    console.log("\n2. Cargando documentos...");
    const documents = listDocuments();
    console.log(`✓ ${documents.length} documentos encontrados`);
    
    console.log("\n3. Preparando payload...");
    const testPayload = {
      incomingText: "Hola, ¿qué programas de ingeniería tienen?",
      chatId: "test-user-123",
      context,
      documents
    };
    console.log("✓ Payload preparado");
    
    console.log("\n4. Llamando a composeResponse...");
    console.log("   Esto puede tomar unos segundos...\n");
    
    const startTime = Date.now();
    const response = await composeResponse(testPayload);
    const duration = Date.now() - startTime;
    
    console.log(`✓ Respuesta generada en ${duration}ms\n`);
    console.log("=== RESPUESTA ===");
    console.log(response);
    console.log("=================\n");
    
    console.log("✅ Test completado exitosamente");
    
  } catch (error) {
    console.error("\n❌ Error durante el test:");
    console.error("Tipo:", error.constructor.name);
    console.error("Mensaje:", error.message);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    if (error.response) {
      console.error("\nResponse data:", error.response.data);
      console.error("Response status:", error.response.status);
    }
    process.exit(1);
  }
}

// Esperar a que los stores estén listos
setTimeout(() => {
  testWebhookFlow();
}, 1000);
