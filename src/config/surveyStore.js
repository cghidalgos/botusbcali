import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SURVEYS_FILE = path.join(__dirname, "../../data/surveys.json");

let surveysData = {
  items: [],
  responses: [],
  sessions: {}, // Para tracking de respuestas activas
};

let ready = false;

/**
 * Carga los datos de encuestas y quizzes desde el archivo JSON
 */
export function loadSurveys() {
  try {
    if (fs.existsSync(SURVEYS_FILE)) {
      const raw = fs.readFileSync(SURVEYS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      surveysData = {
        items: parsed.items || [],
        responses: parsed.responses || [],
        sessions: parsed.sessions || {},
      };
    }
    ready = true;
  } catch (error) {
    console.error("Error al cargar surveys:", error);
    surveysData = { items: [], responses: [], sessions: {} };
    ready = true;
  }
}

/**
 * Guarda los datos de encuestas en el archivo JSON
 */
function saveSurveys() {
  try {
    fs.writeFileSync(SURVEYS_FILE, JSON.stringify(surveysData, null, 2), "utf-8");
  } catch (error) {
    console.error("Error al guardar surveys:", error);
  }
}

/**
 * Verifica si el store está listo
 */
export async function surveysReady() {
  if (!ready) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return ready;
}

/**
 * Genera un ID único
 */
function generateId(prefix = "item") {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * Crea una nueva encuesta o quiz
 */
export function createSurvey(data) {
  const survey = {
    id: generateId(data.type === "quiz" ? "quiz" : "survey"),
    type: data.type || "survey",
    title: data.title,
    description: data.description || "",
    status: data.status || "draft",
    createdAt: new Date().toISOString(),
    createdBy: data.createdBy || "admin",
    scheduledFor: data.scheduledFor || null,
    
    sendTo: data.sendTo || {
      type: "all",
      userIds: [],
      filters: {},
    },
    
    questions: data.questions || [],
    
    ...(data.type === "quiz" && {
      quizSettings: {
        passingScore: data.quizSettings?.passingScore || 70,
        showResults: data.quizSettings?.showResults || "immediate",
        showCorrectAnswers: data.quizSettings?.showCorrectAnswers !== false,
        showExplanations: data.quizSettings?.showExplanations !== false,
        allowRetake: data.quizSettings?.allowRetake !== false,
        maxAttempts: data.quizSettings?.maxAttempts || 3,
        timeLimit: data.quizSettings?.timeLimit || null,
        randomizeQuestions: data.quizSettings?.randomizeQuestions || false,
        randomizeOptions: data.quizSettings?.randomizeOptions || false,
        showLeaderboard: data.quizSettings?.showLeaderboard !== false,
        partialCredit: data.quizSettings?.partialCredit || false,
      },
    }),
    
    sentCount: 0,
    responseCount: 0,
    lastSentAt: null,
  };
  
  surveysData.items.push(survey);
  saveSurveys();
  return survey;
}

/**
 * Obtiene todas las encuestas/quizzes
 */
export function getAllSurveys(filters = {}) {
  let items = [...surveysData.items];
  
  if (filters.type) {
    items = items.filter((item) => item.type === filters.type);
  }
  
  if (filters.status) {
    items = items.filter((item) => item.status === filters.status);
  }
  
  // Ordenar por fecha de creación (más reciente primero)
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return items;
}

/**
 * Obtiene una encuesta por ID
 */
export function getSurveyById(id) {
  return surveysData.items.find((item) => item.id === id);
}

/**
 * Actualiza una encuesta
 */
export function updateSurvey(id, updates) {
  const index = surveysData.items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  
  surveysData.items[index] = {
    ...surveysData.items[index],
    ...updates,
    id, // Preservar ID
    updatedAt: new Date().toISOString(),
  };
  
  saveSurveys();
  return surveysData.items[index];
}

/**
 * Elimina una encuesta
 */
export function deleteSurvey(id) {
  const index = surveysData.items.findIndex((item) => item.id === id);
  if (index === -1) return false;
  
  surveysData.items.splice(index, 1);
  
  // Eliminar respuestas asociadas
  surveysData.responses = surveysData.responses.filter((r) => r.surveyId !== id);
  
  saveSurveys();
  return true;
}

/**
 * Marca una encuesta como enviada a usuarios específicos
 */
export function markSurveyAsSent(id, userIds) {
  const survey = getSurveyById(id);
  if (!survey) return null;
  
  const updates = {
    status: "active",
    lastSentAt: new Date().toISOString(),
    sentCount: (survey.sentCount || 0) + userIds.length,
  };
  
  return updateSurvey(id, updates);
}

/**
 * Cierra una encuesta
 */
export function closeSurvey(id) {
  return updateSurvey(id, { status: "closed" });
}

/**
 * Obtiene las respuestas de una encuesta
 */
export function getSurveyResponses(surveyId, filters = {}) {
  let responses = surveysData.responses.filter((r) => r.surveyId === surveyId);
  
  if (filters.userId) {
    responses = responses.filter((r) => r.userId === filters.userId);
  }
  
  // Ordenar por fecha de completado
  responses.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  
  return responses;
}

/**
 * Guarda una respuesta de encuesta/quiz
 */
export function saveResponse(data) {
  const response = {
    id: generateId("resp"),
    surveyId: data.surveyId,
    userId: data.userId,
    username: data.username,
    firstName: data.firstName,
    lastName: data.lastName,
    attemptNumber: data.attemptNumber || 1,
    answers: data.answers,
    
    ...(data.isQuiz && {
      score: data.score,
      totalPoints: data.totalPoints,
      percentage: data.percentage,
      passed: data.passed,
    }),
    
    timeSpent: data.timeSpent,
    startedAt: data.startedAt,
    completedAt: new Date().toISOString(),
  };
  
  surveysData.responses.push(response);
  
  // Actualizar contador de respuestas
  const survey = getSurveyById(data.surveyId);
  if (survey) {
    updateSurvey(data.surveyId, {
      responseCount: (survey.responseCount || 0) + 1,
    });
  }
  
  saveSurveys();
  return response;
}

/**
 * Obtiene el intento más reciente de un usuario para un quiz
 */
export function getUserLatestAttempt(surveyId, userId) {
  const attempts = surveysData.responses.filter(
    (r) => r.surveyId === surveyId && r.userId === userId
  );
  
  if (attempts.length === 0) return null;
  
  // Ordenar por attemptNumber descendente
  attempts.sort((a, b) => b.attemptNumber - a.attemptNumber);
  return attempts[0];
}

/**
 * Cuenta los intentos de un usuario en un quiz
 */
export function getUserAttemptCount(surveyId, userId) {
  return surveysData.responses.filter(
    (r) => r.surveyId === surveyId && r.userId === userId
  ).length;
}

/**
 * Obtiene estadísticas de una encuesta
 */
export function getSurveyStats(surveyId) {
  const survey = getSurveyById(surveyId);
  if (!survey) return null;
  
  const responses = getSurveyResponses(surveyId);
  
  if (survey.type === "survey") {
    // Estadísticas de encuesta
    const stats = {
      totalSent: survey.sentCount || 0,
      totalResponses: responses.length,
      responseRate: survey.sentCount > 0 ? (responses.length / survey.sentCount) * 100 : 0,
      questionStats: {},
    };
    
    // Calcular estadísticas por pregunta
    survey.questions.forEach((q) => {
      const answers = responses.map((r) => r.answers.find((a) => a.questionId === q.id)).filter(Boolean);
      
      stats.questionStats[q.id] = {
        question: q.question,
        type: q.type,
        totalAnswers: answers.length,
        distribution: {},
      };
      
      if (q.type === "single_choice" || q.type === "multiple_choice") {
        // Contar distribución de opciones
        q.options.forEach((opt, index) => {
          stats.questionStats[q.id].distribution[opt] = 0;
        });
        
        answers.forEach((a) => {
          if (Array.isArray(a.answer)) {
            a.answer.forEach((idx) => {
              const opt = q.options[idx];
              if (opt) stats.questionStats[q.id].distribution[opt]++;
            });
          } else {
            const opt = q.options[a.answer];
            if (opt) stats.questionStats[q.id].distribution[opt]++;
          }
        });
      } else if (q.type === "rating") {
        const ratings = answers.map((a) => a.answer).filter((r) => typeof r === "number");
        stats.questionStats[q.id].average = ratings.length > 0
          ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
          : 0;
        stats.questionStats[q.id].distribution = {};
        ratings.forEach((r) => {
          stats.questionStats[q.id].distribution[r] = (stats.questionStats[q.id].distribution[r] || 0) + 1;
        });
      } else if (q.type === "text") {
        stats.questionStats[q.id].textAnswers = answers.map((a) => a.answer);
      }
    });
    
    return stats;
  } else {
    // Estadísticas de quiz
    const scores = responses.map((r) => r.percentage).filter((p) => typeof p === "number");
    const passed = responses.filter((r) => r.passed).length;
    
    const stats = {
      totalSent: survey.sentCount || 0,
      totalResponses: responses.length,
      responseRate: survey.sentCount > 0 ? (responses.length / survey.sentCount) * 100 : 0,
      averageScore: scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0,
      passRate: responses.length > 0 ? (passed / responses.length) * 100 : 0,
      passed,
      failed: responses.length - passed,
      scoreDistribution: {
        "90-100": scores.filter((s) => s >= 90).length,
        "80-89": scores.filter((s) => s >= 80 && s < 90).length,
        "70-79": scores.filter((s) => s >= 70 && s < 80).length,
        "60-69": scores.filter((s) => s >= 60 && s < 70).length,
        "<60": scores.filter((s) => s < 60).length,
      },
      questionStats: {},
    };
    
    // Estadísticas por pregunta
    survey.questions.forEach((q) => {
      const answers = responses.map((r) => r.answers.find((a) => a.questionId === q.id)).filter(Boolean);
      const correctCount = answers.filter((a) => a.correct).length;
      
      stats.questionStats[q.id] = {
        question: q.question,
        totalAnswers: answers.length,
        correctCount,
        correctRate: answers.length > 0 ? (correctCount / answers.length) * 100 : 0,
        distribution: {},
      };
      
      // Distribución de respuestas
      answers.forEach((a) => {
        let answerKey;
        if (Array.isArray(a.answer)) {
          answerKey = a.answer.map((idx) => q.options[idx]).join(", ");
        } else {
          answerKey = q.options[a.answer] || String(a.answer);
        }
        stats.questionStats[q.id].distribution[answerKey] = 
          (stats.questionStats[q.id].distribution[answerKey] || 0) + 1;
      });
    });
    
    return stats;
  }
}

/**
 * Obtiene el leaderboard de un quiz
 */
export function getQuizLeaderboard(surveyId, limit = 10) {
  const responses = getSurveyResponses(surveyId);
  
  // Agrupar por usuario y quedarse con su mejor intento
  const bestAttempts = new Map();
  
  responses.forEach((r) => {
    const current = bestAttempts.get(r.userId);
    if (!current || r.percentage > current.percentage) {
      bestAttempts.set(r.userId, r);
    }
  });
  
  // Convertir a array y ordenar
  const leaderboard = Array.from(bestAttempts.values())
    .sort((a, b) => {
      // Ordenar por porcentaje descendente, luego por tiempo ascendente
      if (b.percentage !== a.percentage) {
        return b.percentage - a.percentage;
      }
      return (a.timeSpent || 0) - (b.timeSpent || 0);
    })
    .slice(0, limit)
    .map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      username: entry.username,
      firstName: entry.firstName,
      lastName: entry.lastName,
      score: entry.score,
      totalPoints: entry.totalPoints,
      percentage: entry.percentage,
      timeSpent: entry.timeSpent,
      completedAt: entry.completedAt,
    }));
  
  return leaderboard;
}

/**
 * Gestión de sesiones activas (para tracking de respuestas en progreso)
 */
export function createSession(userId, surveyId) {
  const sessionId = generateId("session");
  surveysData.sessions[sessionId] = {
    userId,
    surveyId,
    currentQuestionIndex: 0,
    answers: [],
    startedAt: new Date().toISOString(),
  };
  console.log("[survey-session] created:", sessionId, "userId:", userId, "surveyId:", surveyId);
  saveSurveys();
  return sessionId;
}

export function getSession(sessionId) {
  const session = surveysData.sessions[sessionId] || null;
  if (!session) {
    console.log("[survey-session] not-found:", sessionId, "available:", Object.keys(surveysData.sessions));
  }
  return session;
}

export function updateSession(sessionId, updates) {
  if (!surveysData.sessions[sessionId]) return null;
  surveysData.sessions[sessionId] = {
    ...surveysData.sessions[sessionId],
    ...updates,
  };
  saveSurveys();
  return surveysData.sessions[sessionId];
}

export function deleteSession(sessionId) {
  console.log("[survey-session] deleted:", sessionId);
  delete surveysData.sessions[sessionId];
  saveSurveys();
}

export function getUserActiveSession(userId, surveyId) {
  const sessions = Object.entries(surveysData.sessions);
  const found = sessions.find(
    ([_, session]) => {
      if (session.userId !== userId) return false;
      // Si surveyId es null, buscar cualquier sesión del usuario
      if (surveyId === null || surveyId === undefined) return true;
      return session.surveyId === surveyId;
    }
  );
  return found ? { sessionId: found[0], ...found[1] } : null;
}

// Inicializar al cargar el módulo
loadSurveys();
