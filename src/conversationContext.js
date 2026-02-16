/**
 * Sistema de Contexto de Conversación Mejorado
 * Mejora la precisión y naturalidad de las respuestas
 */

import { getMemory } from "./config/memoryStore.js";
import { getHistory } from "./config/historyStore.js";
import { getUserProfile, getUserContext } from "./userProfileStore.js";

/**
 * Enriquece el contexto de la pregunta con información relevante
 */
export function enrichQuestionContext(userId, question, documents) {
  const profile = getUserProfile(userId);
  const memory = getMemory(userId);
  const history = getHistory(userId);
  
  let enrichedContext = {
    question: question,
    userInfo: {
      name: profile.name,
      isFirstTime: profile.messageCount <= 1,
      messageCount: profile.messageCount,
      recentTopics: profile.topics || []
    },
    conversationHistory: null,
    documents: documents
  };
  
  // Agregar resumen de memoria si existe
  if (memory && memory.length > 0) {
    enrichedContext.conversationHistory = memory;
  }
  
  // Detectar referencias a conversaciones previas
  if (hasConversationReference(question)) {
    enrichedContext.referencingPreviousConversation = true;
  }
  
  return enrichedContext;
}

/**
 * Detecta si la pregunta hace referencia a conversaciones anteriores
 */
function hasConversationReference(question) {
  const patterns = [
    /\b(antes|anteriormente|hace rato|dijiste|mencionaste)\b/i,
    /\b(la otra vez|el otro día|ayer)\b/i,
    /\b(volviendo a|retomando|como te comenté)\b/i,
    /\b(en la conversación anterior|en el mensaje anterior)\b/i
  ];
  
  return patterns.some(pattern => pattern.test(question));
}

/**
 * Mejora el prompt agregando contexto conversacional
 */
export function buildEnhancedPrompt(userId, question, documents, memory) {
  const profile = getUserProfile(userId);
  const userContext = getUserContext(userId);
  
  let prompt = "";
  
  // Agregar contexto de usuario
  if (userContext) {
    prompt += `[Información del usuario: ${userContext}]\n\n`;
  }
  
  // Agregar memoria de conversación
  if (memory && memory.length > 100) {
    prompt += `[Contexto de conversación previa:\n${memory}]\n\n`;
  }
  
  // Agregar documentos relevantes
  if (documents && documents.length > 0) {
    prompt += `[Documentos relevantes: ${documents.length} documento(s) disponible(s)]\n\n`;
  }
  
  // Pregunta principal
  prompt += `Pregunta del usuario${profile.name ? ` (${profile.name})` : ''}: ${question}`;
  
  return prompt;
}

/**
 * Genera respuesta a saludos de forma personalizada
 */
export function generateGreetingResponse(userId, message) {
  const profile = getUserProfile(userId);
  const hour = new Date().getHours();
  
  let greeting;
  if (hour < 12) {
    greeting = "Buenos días";
  } else if (hour < 19) {
    greeting = "Buenas tardes";
  } else {
    greeting = "Buenas noches";
  }
  
  // Primera interacción
  if (profile.messageCount <= 1) {
    return `${greeting}! 👋 Bienvenido/a. Soy el asistente virtual de la institución. ¿En qué puedo ayudarte hoy?`;
  }
  
  // Usuario recurrente con nombre
  if (profile.name) {
    return `${greeting}, ${profile.name}! 😊 ¿En qué puedo asistirte?`;
  }
  
  // Usuario recurrente sin nombre
  return `${greeting}! Me alegra verte de nuevo. ¿Qué necesitas?`;
}

/**
 * Analiza el sentimiento/intención del mensaje para ajustar el tono
 */
export function analyzeSentiment(message) {
  const frustrated = /\b(no entiendo|confundido|ayuda|urgente|problema|no funciona)\b/i;
  const grateful = /\b(gracias|agradezco|excelente|perfecto|genial)\b/i;
  const urgent = /\b(urgente|rápido|ya|ahora|hoy mismo)\b/i;
  
  return {
    isFrustrated: frustrated.test(message),
    isGrateful: grateful.test(message),
    isUrgent: urgent.test(message)
  };
}

/**
 * Ajusta el tono de la respuesta basado en el sentimiento
 */
export function adjustResponseTone(baseResponse, sentiment, userId) {
  let adjusted = baseResponse;
  
  if (sentiment.isFrustrated) {
    adjusted = "Entiendo que puede ser confuso. " + adjusted;
  }
  
  if (sentiment.isUrgent) {
    adjusted = adjusted.replace(/\.$/, '') + " (te respondo lo más rápido posible).";
  }
  
  return adjusted;
}

/**
 * Genera sugerencias de seguimiento basadas en la pregunta
 */
export function generateFollowUpSuggestions(question, category) {
  const suggestions = {
    materias: [
      "¿Quieres saber quién dicta esta materia?",
      "¿Necesitas los horarios de clase?",
      "¿Te gustaría conocer los requisitos?"
    ],
    profesores: [
      "¿Quieres saber qué materias dicta?",
      "¿Te interesa su horario de atención?",
      "¿Necesitas su información de contacto?"
    ],
    horarios: [
      "¿Necesitas más detalles sobre algún horario?",
      "¿Quieres saber sobre otros horarios?",
      "¿Te gustaría conocer los horarios de atención?"
    ],
    becas: [
      "¿Quieres conocer más becas disponibles?",
      "¿Te interesa saber los requisitos específicos?",
      "¿Necesitas ayuda con el proceso de aplicación?"
    ]
  };
  
  return suggestions[category] || [];
}

/**
 * Verifica si la respuesta es apropiada (no vacía, no genérica)
 */
export function validateResponseQuality(response) {
  if (!response || response.length < 10) {
    return { valid: false, reason: "Respuesta demasiado corta" };
  }
  
  // Detectar respuestas genéricas/poco útiles
  const genericPhrases = [
    "no tengo información",
    "no puedo ayudarte",
    "no sé",
    "lo siento"
  ];
  
  const isGeneric = genericPhrases.some(phrase => 
    response.toLowerCase().includes(phrase) && response.length < 50
  );
  
  if (isGeneric) {
    return { valid: false, reason: "Respuesta demasiado genérica" };
  }
  
  return { valid: true };
}
