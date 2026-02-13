import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

async function testOpenAI() {
  console.log("Verificando configuración...");
  console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "Configurada (primeros 10 chars: " + process.env.OPENAI_API_KEY.substring(0, 10) + "...)" : "NO CONFIGURADA");
  console.log("OPENAI_MODEL:", process.env.OPENAI_MODEL || "gpt-4o (default)");
  console.log("TELEGRAM_BOT_TOKEN:", process.env.TELEGRAM_BOT_TOKEN ? "Configurado" : "NO CONFIGURADO");
  
  if (!process.env.OPENAI_API_KEY) {
    console.error("\n❌ OPENAI_API_KEY no está configurada");
    process.exit(1);
  }

  try {
    console.log("\nCreando cliente OpenAI...");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    console.log("Enviando petición de prueba...");
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: "Eres un asistente útil." },
        { role: "user", content: "Di 'hola' en español" }
      ],
      temperature: 0.2,
      max_tokens: 50
    });

    console.log("\n✅ Respuesta exitosa de OpenAI:");
    console.log(response.choices?.[0]?.message?.content);
    console.log("\nModelo usado:", response.model);
    console.log("Tokens usados:", response.usage?.total_tokens);
    
  } catch (error) {
    console.error("\n❌ Error al conectar con OpenAI:");
    console.error("Tipo:", error.constructor.name);
    console.error("Mensaje:", error.message);
    if (error.status) console.error("Status HTTP:", error.status);
    if (error.code) console.error("Código:", error.code);
    if (error.type) console.error("Tipo de error:", error.type);
    console.error("\nStack trace completo:");
    console.error(error);
    process.exit(1);
  }
}

testOpenAI();
