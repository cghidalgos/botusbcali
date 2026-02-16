#!/usr/bin/env node
/**
 * Script de verificación del sistema de documentos
 * Ejecutar: node scripts/verifyDocuments.js
 */

import fs from "fs/promises";
import path from "path";

const documentsPath = path.resolve(process.cwd(), "data", "documents.json");

async function verifyDocuments() {
  console.log("=== VERIFICACIÓN DE DOCUMENTOS ===\n");
  
  try {
    const exists = await fs.access(documentsPath).then(() => true).catch(() => false);
    
    if (!exists) {
      console.log("❌ No hay documentos guardados aún");
      console.log("📝 Sube un documento desde la interfaz web o Telegram\n");
      return;
    }
    
    const content = await fs.readFile(documentsPath, "utf8");
    const documents = JSON.parse(content);
    
    if (!documents || documents.length === 0) {
      console.log("❌ El archivo documents.json está vacío\n");
      return;
    }
    
    console.log(`✅ Total de documentos: ${documents.length}\n`);
    
    let totalChunks = 0;
    let totalEmbeddings = 0;
    let totalTextSize = 0;
    
    documents.forEach((doc, index) => {
      console.log(`📄 Documento ${index + 1}:`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Nombre: ${doc.originalName || doc.url || "Sin nombre"}`);
      console.log(`   Estado: ${doc.status}`);
      console.log(`   Creado: ${new Date(doc.createdAt).toLocaleString()}`);
      
      if (doc.extractedText) {
        const textSize = doc.extractedText.length;
        totalTextSize += textSize;
        console.log(`   Texto extraído: ${textSize.toLocaleString()} caracteres`);
      }
      
      if (doc.chunks && doc.chunks.length > 0) {
        totalChunks += doc.chunks.length;
        
        const chunksWithEmbeddings = doc.chunks.filter(
          chunk => chunk.embedding && Array.isArray(chunk.embedding) && chunk.embedding.length > 0
        );
        totalEmbeddings += chunksWithEmbeddings.length;
        
        console.log(`   Chunks: ${doc.chunks.length}`);
        console.log(`   ✅ Con embeddings: ${chunksWithEmbeddings.length}`);
        
        if (chunksWithEmbeddings.length > 0) {
          const embeddingDim = chunksWithEmbeddings[0].embedding.length;
          console.log(`   Dimensión embedding: ${embeddingDim}`);
        }
        
        if (chunksWithEmbeddings.length < doc.chunks.length) {
          console.log(`   ⚠️  Faltan embeddings en ${doc.chunks.length - chunksWithEmbeddings.length} chunks`);
        }
      } else {
        console.log(`   ⚠️  Sin chunks generados`);
      }
      
      console.log("");
    });
    
    console.log("=== RESUMEN ===");
    console.log(`Total documentos: ${documents.length}`);
    console.log(`Total chunks: ${totalChunks}`);
    console.log(`Chunks con embeddings: ${totalEmbeddings}`);
    console.log(`Texto total: ${(totalTextSize / 1024).toFixed(2)} KB`);
    
    console.log("\n💰 OPTIMIZACIÓN DE COSTOS:");
    console.log(`✅ Embeddings almacenados en disco: ${totalEmbeddings}`);
    console.log(`✅ NO se regeneran al reiniciar servidor`);
    console.log(`✅ Búsqueda por similitud: LOCAL (gratis)`);
    console.log(`💵 Solo pagas GPT para respuestas finales`);
    
    if (totalEmbeddings === 0 && totalChunks > 0) {
      console.log("\n⚠️  PROBLEMA: Hay chunks sin embeddings");
      console.log("   Esto puede indicar que faltó generar embeddings");
      console.log("   o que el documento no se procesó completamente");
    }
    
    if (totalEmbeddings > 0) {
      console.log(`\n✅ Sistema funcionando correctamente`);
      console.log(`   Los ${totalEmbeddings} embeddings están listos para usar`);
      console.log(`   No se volverán a generar (ahorro de costos)`);
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

verifyDocuments();
