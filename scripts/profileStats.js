#!/usr/bin/env node

/**
 * Script para ver estadísticas de perfiles de usuario
 */

import fs from "fs/promises";
import path from "path";

const profilesPath = path.resolve(process.cwd(), "data", "user-profiles.json");

async function showProfileStats() {
  try {
    const content = await fs.readFile(profilesPath, "utf8");
    const profiles = JSON.parse(content);

    const userIds = Object.keys(profiles);
    
    if (userIds.length === 0) {
      console.log("❌ No hay perfiles de usuario guardados");
      return;
    }

    const usersWithNames = userIds.filter(id => profiles[id].name);
    const totalMessages = userIds.reduce((sum, id) => sum + profiles[id].messageCount, 0);
    
    // Usuarios activos (últimos 7 días)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const activeUsers = userIds.filter(id => {
      const lastSeen = new Date(profiles[id].lastSeen);
      return lastSeen > weekAgo;
    });

    console.log("\n👥 ESTADÍSTICAS DE PERFILES DE USUARIO\n");
    console.log(`Total de usuarios: ${userIds.length}`);
    console.log(`Usuarios con nombre: ${usersWithNames.length} (${Math.round(usersWithNames.length/userIds.length*100)}%)`);
    console.log(`Usuarios activos (7 días): ${activeUsers.length}`);
    console.log(`Total de mensajes: ${totalMessages}`);
    console.log(`Promedio de mensajes por usuario: ${Math.round(totalMessages/userIds.length)}\n`);

    // Top usuarios por actividad
    const sortedUsers = userIds
      .map(id => profiles[id])
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 10);

    console.log("🔥 TOP 10 USUARIOS MÁS ACTIVOS:\n");
    sortedUsers.forEach((profile, idx) => {
      const name = profile.name || "Anónimo";
      const lastSeen = new Date(profile.lastSeen).toLocaleString();
      const style = profile.conversationStyle || "formal";
      
      console.log(`${idx + 1}. ${name} (ID: ${profile.userId})`);
      console.log(`   📊 ${profile.messageCount} mensajes | Estilo: ${style}`);
      console.log(`   📅 Última vez: ${lastSeen}`);
      
      if (profile.topics && profile.topics.length > 0) {
        console.log(`   🏷️  Temas: ${profile.topics.join(", ")}`);
      }
      console.log();
    });

    // Estadísticas de estilo de conversación
    const casual = userIds.filter(id => profiles[id].conversationStyle === "casual").length;
    const formal = userIds.filter(id => profiles[id].conversationStyle === "formal").length;
    
    console.log("💬 ESTILOS DE CONVERSACIÓN:");
    console.log(`   Casual: ${casual} usuarios (${Math.round(casual/userIds.length*100)}%)`);
    console.log(`   Formal: ${formal} usuarios (${Math.round(formal/userIds.length*100)}%)\n`);

    // Temas más populares
    const allTopics = userIds
      .flatMap(id => profiles[id].topics || []);
    
    const topicCounts = {};
    allTopics.forEach(topic => {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });
    
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (topTopics.length > 0) {
      console.log("🏷️  TEMAS MÁS CONSULTADOS:");
      topTopics.forEach(([topic, count]) => {
        console.log(`   ${topic}: ${count} usuarios`);
      });
      console.log();
    }

  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("❌ No se encontró el archivo de perfiles en:", profilesPath);
    } else {
      console.error("❌ Error leyendo perfiles:", error.message);
    }
  }
}

showProfileStats();
