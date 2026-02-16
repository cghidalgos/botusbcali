/**
 * Sistema de Perfiles de Usuario
 * Guarda información personalizada de cada usuario para conversaciones más humanas
 */

import fs from "fs/promises";
import path from "path";

const dataDir = path.resolve(process.cwd(), "data");
const profilesPath = path.join(dataDir, "user-profiles.json");

// Almacén en memoria
let userProfiles = {};

/**
 * Carga perfiles desde disco
 */
export async function loadUserProfiles() {
  try {
    const content = await fs.readFile(profilesPath, "utf8");
    userProfiles = JSON.parse(content);
    console.log(`[PROFILES] ✓ Cargados ${Object.keys(userProfiles).length} perfiles de usuario`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("[PROFILES] Error cargando perfiles:", error.message);
    }
  }
}

/**
 * Guarda perfiles a disco
 */
async function saveUserProfiles() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(profilesPath, JSON.stringify(userProfiles, null, 2), "utf8");
  } catch (error) {
    console.error("[PROFILES] Error guardando perfiles:", error.message);
  }
}

/**
 * Extrae nombres de un mensaje (simple)
 */
function extractNameFromMessage(text) {
  const patterns = [
    /(?:me llamo|soy|mi nombre es)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i,
    /^hola,?\s+soy\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Obtiene o crea perfil de usuario
 */
export function getUserProfile(userId) {
  if (!userProfiles[userId]) {
    userProfiles[userId] = {
      userId: userId,
      name: null,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      messageCount: 0,
      topics: [], // Temas de interés
      preferences: {},
      conversationStyle: "formal", // formal, casual
      blocked: false,
    };
  }

  if (typeof userProfiles[userId].blocked !== "boolean") {
    userProfiles[userId].blocked = false;
  }
  
  // Actualizar última vez visto
  userProfiles[userId].lastSeen = new Date().toISOString();
  userProfiles[userId].messageCount++;
  
  return userProfiles[userId];
}

export function isUserBlocked(userId) {
  const profile = userProfiles[userId];
  return Boolean(profile?.blocked);
}

export function setUserBlocked(userId, blocked) {
  const profile = getUserProfile(userId);
  profile.blocked = Boolean(blocked);
  saveUserProfiles().catch(() => {});
  return profile;
}

export function listUserProfiles() {
  return Object.values(userProfiles).sort((a, b) => {
    const aTime = new Date(a.lastSeen || 0).getTime();
    const bTime = new Date(b.lastSeen || 0).getTime();
    return bTime - aTime;
  });
}

/**
 * Actualiza nombre de usuario
 */
export function updateUserName(userId, name) {
  const profile = getUserProfile(userId);
  
  if (name && !profile.name) {
    profile.name = name;
    console.log(`[PROFILES] 👋 Usuario ${userId} se presentó como "${name}"`);
    saveUserProfiles().catch(() => {});
    return true;
  }
  
  return false;
}

/**
 * Detecta y actualiza nombre si se menciona en el mensaje
 */
export function detectAndUpdateName(userId, message) {
  const name = extractNameFromMessage(message);
  if (name) {
    return updateUserName(userId, name);
  }
  return false;
}

/**
 * Registra tema de interés
 */
export function recordUserTopic(userId, topic) {
  const profile = getUserProfile(userId);
  
  if (!profile.topics.includes(topic)) {
    profile.topics.push(topic);
    
    // Mantener solo los últimos 10 temas
    if (profile.topics.length > 10) {
      profile.topics = profile.topics.slice(-10);
    }
    
    saveUserProfiles().catch(() => {});
  }
}

/**
 * Actualiza estilo de conversación basado en el mensaje
 */
export function updateConversationStyle(userId, message) {
  const profile = getUserProfile(userId);
  
  // Detectar si usa lenguaje casual
  const casualMarkers = /\b(we|ombe|parce|brother|bro|tío|compa|vos)\b/i;
  const formalMarkers = /\b(usted|señor|señora|por favor|disculpe|perdone)\b/i;
  
  if (casualMarkers.test(message)) {
    profile.conversationStyle = "casual";
  } else if (formalMarkers.test(message)) {
    profile.conversationStyle = "formal";
  }
  
  saveUserProfiles().catch(() => {});
}

/**
 * Verifica si es la primera interacción del usuario
 */
export function isFirstInteraction(userId) {
  const profile = userProfiles[userId];
  return !profile || profile.messageCount <= 1;
}

/**
 * Verifica si es un usuario recurrente
 */
export function isReturningUser(userId) {
  const profile = userProfiles[userId];
  if (!profile) return false;
  
  const lastSeen = new Date(profile.lastSeen);
  const now = new Date();
  const hoursSince = (now - lastSeen) / (1000 * 60 * 60);
  
  // Si ha pasado más de 4 horas, considerar como "regreso"
  return profile.messageCount > 5 && hoursSince > 4;
}

/**
 * Genera contexto personalizado para el usuario
 */
export function getUserContext(userId) {
  const profile = getUserProfile(userId);
  
  let context = "";
  
  if (profile.name) {
    context += `El usuario se llama ${profile.name}. `;
  }
  
  if (profile.messageCount === 1) {
    context += "Esta es su primera interacción. Sé amable y acogedor. ";
  } else if (profile.messageCount > 10) {
    context += "Este es un usuario frecuente. Puedes ser más directo y familiar. ";
  }
  
  if (profile.conversationStyle === "casual") {
    context += "El usuario prefiere un tono casual y cercano. ";
  } else {
    context += "Mantén un tono profesional pero amigable. ";
  }
  
  if (profile.topics && profile.topics.length > 0) {
    const recentTopics = profile.topics.slice(-3);
    context += `Temas de interés recientes: ${recentTopics.join(", ")}. `;
  }
  
  return context.trim();
}

/**
 * Genera saludo personalizado
 */
export function generateGreeting(userId) {
  const profile = getUserProfile(userId);
  const hour = new Date().getHours();
  const name = profile.name;
  
  // Saludo según hora del día
  let timeGreeting;
  if (hour < 12) {
    timeGreeting = "Buenos días";
  } else if (hour < 19) {
    timeGreeting = "Buenas tardes";
  } else {
    timeGreeting = "Buenas noches";
  }
  
  // Primera vez vs recurrente
  if (profile.messageCount === 1) {
    return `${timeGreeting}! 👋 Soy el asistente virtual. ¿En qué puedo ayudarte?`;
  } else if (isReturningUser(userId)) {
    if (name) {
      return `${timeGreeting} de nuevo, ${name}! 😊 ¿En qué te puedo ayudar hoy?`;
    } else {
      return `${timeGreeting}! Me alegra verte de nuevo. ¿Qué necesitas?`;
    }
  } else {
    if (name) {
      return `${timeGreeting}, ${name}! ¿En qué puedo asistirte?`;
    }
  }
  
  return null; // No forzar saludo si no es apropiado
}

/**
 * Detecta si el mensaje es un saludo
 */
export function isGreeting(message) {
  const greetings = /^(hola|buenos días|buenas tardes|buenas noches|hey|saludos|qué tal|cómo estás|holi|ola)/i;
  return greetings.test(message.trim());
}

/**
 * Obtiene estadísticas de perfiles
 */
export function getProfileStats() {
  const totalUsers = Object.keys(userProfiles).length;
  const usersWithNames = Object.values(userProfiles).filter(p => p.name).length;
  const activeUsers = Object.values(userProfiles).filter(p => {
    const daysSince = (new Date() - new Date(p.lastSeen)) / (1000 * 60 * 60 * 24);
    return daysSince < 7;
  }).length;
  
  return {
    totalUsers,
    usersWithNames,
    activeUsers,
    profiles: Object.values(userProfiles).slice(0, 10) // Top 10 para preview
  };
}
