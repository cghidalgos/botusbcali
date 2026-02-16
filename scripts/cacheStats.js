#!/usr/bin/env node

/**
 * Script para ver estadísticas del Cache GPT
 */

import fs from "fs/promises";
import path from "path";

const cachePath = path.resolve(process.cwd(), "data", "gpt-cache.json");

async function showCacheStats() {
  try {
    const content = await fs.readFile(cachePath, "utf8");
    const cache = JSON.parse(content);

    if (!Array.isArray(cache) || cache.length === 0) {
      console.log("❌ No hay entradas en el cache");
      return;
    }

    const totalHits = cache.reduce((sum, e) => sum + e.hits, 0);
    const avgHits = totalHits / cache.length;
    const withHits = cache.filter(e => e.hits > 0);
    const costPerCall = 0.002; // Estimado para GPT-4o-mini
    const estimatedSavings = totalHits * costPerCall;

    console.log("\n📊 ESTADÍSTICAS DEL CACHE GPT\n");
    console.log(`Total de respuestas cacheadas: ${cache.length}`);
    console.log(`Respuestas usadas al menos 1 vez: ${withHits.length}`);
    console.log(`Total de hits (reutilizaciones): ${totalHits}`);
    console.log(`Promedio de hits por entrada: ${avgHits.toFixed(2)}`);
    console.log(`\n💰 AHORRO ESTIMADO:`);
    console.log(`   Llamadas API evitadas: ${totalHits}`);
    console.log(`   Ahorro estimado: $${estimatedSavings.toFixed(3)} USD\n`);

    // Top 10 preguntas más reutilizadas
    const popular = cache
      .filter(e => e.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    if (popular.length > 0) {
      console.log("🔥 TOP 10 RESPUESTAS MÁS REUTILIZADAS:\n");
      popular.forEach((entry, idx) => {
        const question = entry.question.length > 70 
          ? entry.question.substring(0, 70) + "..." 
          : entry.question;
        console.log(`${idx + 1}. [${entry.hits} hits] ${question}`);
        console.log(`   Última vez: ${new Date(entry.lastUsed).toLocaleString()}\n`);
      });
    }

    // Estadísticas por antigüedad
    const now = new Date();
    const last24h = cache.filter(e => (now - new Date(e.lastUsed)) < 86400000).length;
    const last7d = cache.filter(e => (now - new Date(e.lastUsed)) < 604800000).length;
    const last30d = cache.filter(e => (now - new Date(e.lastUsed)) < 2592000000).length;

    console.log("📅 ACTIVIDAD DEL CACHE:");
    console.log(`   Últimas 24 horas: ${last24h} respuestas`);
    console.log(`   Últimos 7 días: ${last7d} respuestas`);
    console.log(`   Últimos 30 días: ${last30d} respuestas\n`);

  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("❌ No se encontró el archivo de cache en:", cachePath);
    } else {
      console.error("❌ Error leyendo cache:", error.message);
    }
  }
}

showCacheStats();
