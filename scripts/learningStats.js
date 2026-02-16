#!/usr/bin/env node
/**
 * Muestra estadísticas del sistema de aprendizaje
 * Ejecutar: node scripts/learningStats.js
 */

import fs from "fs/promises";
import path from "path";

const patternsPath = path.resolve(process.cwd(), "data", "learned-patterns.json");

async function showStats() {
  console.log("=== SISTEMA DE APRENDIZAJE AUTOMÁTICO ===\n");
  
  try {
    const exists = await fs.access(patternsPath).then(() => true).catch(() => false);
    
    if (!exists) {
      console.log("📚 El sistema aún no ha aprendido ningún patrón");
      console.log("💡 A medida que uses el bot, aprenderá de preguntas frecuentes\n");
      console.log("Configuración:");
      console.log("  • Umbral de frecuencia: 3 repeticiones");
      console.log("  • Similitud requerida: 85%");
      console.log("  • Máximo por categoría: 50 patrones\n");
      return;
    }
    
    const content = await fs.readFile(patternsPath, "utf8");
    const patterns = JSON.parse(content);
    
    let totalPatterns = 0;
    let totalFrequent = 0;
    let totalInTraining = 0;
    
    console.log("📊 RESUMEN POR CATEGORÍA:\n");
    
    for (const [category, items] of Object.entries(patterns)) {
      if (!items || items.length === 0) continue;
      
      const frequent = items.filter(p => p.frequency >= 3);
      const inTraining = items.filter(p => p.addedToTraining);
      
      totalPatterns += items.length;
      totalFrequent += frequent.length;
      totalInTraining += inTraining.length;
      
      console.log(`📁 ${category.toUpperCase()}`);
      console.log(`   Total patrones: ${items.length}`);
      console.log(`   Frecuentes (3+): ${frequent.length}`);
      console.log(`   En entrenamiento: ${inTraining.length}`);
      
      if (items.length > 0) {
        console.log(`\n   Top 3 preguntas:`);
        const top = items
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 3);
        
        top.forEach((p, i) => {
          const badge = p.addedToTraining ? "✅" : "📝";
          console.log(`   ${i + 1}. ${badge} "${p.question}"`);
          console.log(`      Frecuencia: ${p.frequency}x`);
          console.log(`      Última: ${new Date(p.lastAsked).toLocaleString()}`);
        });
      }
      
      console.log("");
    }
    
    console.log("═".repeat(60));
    console.log(`📈 TOTALES:`);
    console.log(`   Patrones totales: ${totalPatterns}`);
    console.log(`   Frecuentes: ${totalFrequent}`);
    console.log(`   En entrenamiento: ${totalInTraining}`);
    console.log(`   Tasa de aprendizaje: ${totalPatterns > 0 ? Math.round((totalInTraining / totalPatterns) * 100) : 0}%`);
    
    if (totalInTraining > 0) {
      console.log(`\n✨ El sistema ha aprendido ${totalInTraining} patrones`);
      console.log(`   Estos optimizan respuestas futuras y reducen costos`);
    }
    
    if (totalFrequent > totalInTraining) {
      console.log(`\n⏳ ${totalFrequent - totalInTraining} patrones cerca de ser aprendidos`);
      console.log(`   (necesitan alcanzar 3 repeticiones)`);
    }
    
    console.log("");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

showStats();
