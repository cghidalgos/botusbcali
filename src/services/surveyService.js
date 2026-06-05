import {
  getSurveyById,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  getUserActiveSession,
  saveResponse,
  getUserAttemptCount,
  getQuizLeaderboard,
} from "../config/surveyStore.js";

/**
 * Envía una encuesta o quiz a un usuario de Telegram
 */
export async function sendSurveyToUser(telegram, userId, surveyId, botId) {
  const survey = getSurveyById(surveyId, botId);
  if (!survey) {
    throw new Error("Encuesta no encontrada");
  }
  
  const isQuiz = survey.type === "quiz";
  const icon = isQuiz ? "🎓" : "📊";
  const typeText = isQuiz ? "quiz" : "encuesta";
  
  let message = `${icon} <b>Nuevo ${typeText} disponible</b>\n\n`;
  message += `<b>${survey.title}</b>\n`;
  if (survey.description) {
    message += `${survey.description}\n\n`;
  }
  
  if (isQuiz) {
    const settings = survey.quizSettings;
    const totalPoints = survey.questions.reduce((sum, q) => sum + (q.points || 10), 0);
    
    message += `Tiempo límite: ${settings.timeLimit ? `${Math.floor(settings.timeLimit / 60)} minutos` : "Sin límite"}\n`;
    message += `Preguntas: ${survey.questions.length}  |  Puntos totales: ${totalPoints}\n`;
    message += `✅ Aprobación: ${settings.passingScore}%\n`;
    
    if (settings.maxAttempts > 1) {
      const attempts = getUserAttemptCount(surveyId, userId, botId);
      message += `🔄 Intentos: ${attempts}/${settings.maxAttempts}\n`;
    }
    
    const leaderboard = getQuizLeaderboard(surveyId, 1, botId);
    if (leaderboard.length > 0 && settings.showLeaderboard) {
      message += `\n🏆 Mejor puntaje actual: ${leaderboard[0].percentage.toFixed(1)}%`;
    }
  } else {
    const estimatedTime = Math.ceil(survey.questions.length * 0.5);
    message += `Tiempo estimado: ${estimatedTime} minuto${estimatedTime > 1 ? "s" : ""}\n`;
    message += `Preguntas: ${survey.questions.length}\n`;
  }
  
  const keyboard = {
    inline_keyboard: [
      [
        {
          text: isQuiz ? "🎯 Iniciar Quiz" : "📝 Responder Encuesta",
          callback_data: `survey_start_${surveyId}`,
        },
      ],
      ...(isQuiz
        ? [
            [
              {
                text: "Ver Ranking",
                callback_data: `survey_leaderboard_${surveyId}`,
              },
            ],
          ]
        : []),
      [
        {
          text: "⏰ Más Tarde",
          callback_data: `survey_later_${surveyId}`,
        },
      ],
    ],
  };
  
  await telegram.sendMessage(userId, message, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
}

/**
 * Inicia una encuesta/quiz para un usuario
 */
export async function startSurvey(telegram, userId, chatId, surveyId, messageId, botId) {
  const survey = getSurveyById(surveyId, botId);
  if (!survey) {
    await telegram.sendMessage(chatId, "❌ Encuesta no encontrada");
    return;
  }
  
  // Verificar si es quiz y tiene límite de intentos
  if (survey.type === "quiz") {
    const attempts = getUserAttemptCount(surveyId, userId, botId);
    const maxAttempts = survey.quizSettings.maxAttempts;
    
    if (attempts >= maxAttempts) {
      await telegram.sendMessage(chatId, `❌ Has alcanzado el límite de ${maxAttempts} intento${maxAttempts > 1 ? "s" : ""} para este quiz.`);
      return;
    }
  }
  
  // Crear nueva sesión
  const sessionId = createSession(userId, surveyId, botId);
  
  // Mostrar primera pregunta
  await showQuestion(telegram, chatId, sessionId, 0, botId);
}

/**
 * Muestra una pregunta al usuario
 */
async function showQuestion(telegram, chatId, sessionId, questionIndex, botId) {
  const session = getSession(sessionId, botId);
  if (!session) {
    await telegram.sendMessage(chatId, "❌ Sesión expirada. Por favor inicia nuevamente.");
    return;
  }
  
  const survey = getSurveyById(session.surveyId, botId);
  if (!survey || questionIndex >= survey.questions.length) {
    await telegram.sendMessage(chatId, "❌ Error al cargar la pregunta.");
    return;
  }
  
  const question = survey.questions[questionIndex];
  const isQuiz = survey.type === "quiz";
  const totalQuestions = survey.questions.length;
  
  let message = `<b>Pregunta ${questionIndex + 1} de ${totalQuestions}</b>`;
  if (isQuiz && question.points) {
    message += ` (${question.points} puntos)`;
  }
  message += `\n\n${question.question}`;
  
  if (!question.required) {
    message += "\n\n<i>(Opcional)</i>";
  }
  
  const keyboard = { inline_keyboard: [] };
  
  if (question.type === "single_choice") {
    // Botones para selección única
    question.options.forEach((option, index) => {
      keyboard.inline_keyboard.push([
        {
          text: option,
          callback_data: `survey_answer_${sessionId}_${questionIndex}_${index}`,
        },
      ]);
    });
  } else if (question.type === "multiple_choice") {
    // Botones con checkboxes para selección múltiple
    const currentAnswers = session.answers[questionIndex] || [];
    question.options.forEach((option, index) => {
      const isSelected = currentAnswers.includes(index);
      keyboard.inline_keyboard.push([
        {
          text: `${isSelected ? "☑️" : "⬜️"} ${option}`,
          callback_data: `survey_toggle_${sessionId}_${questionIndex}_${index}`,
        },
      ]);
    });
    // Botón de confirmar
    keyboard.inline_keyboard.push([
      {
        text: "✅ Confirmar Respuesta",
        callback_data: `survey_confirm_${sessionId}_${questionIndex}`,
      },
    ]);
  } else if (question.type === "rating") {
    // Botones de rating (1-5 estrellas)
    const max = question.max || 5;
    const min = question.min || 1;
    const row = [];
    for (let i = min; i <= max; i++) {
      row.push({
        text: `${i} ⭐`,
        callback_data: `survey_answer_${sessionId}_${questionIndex}_${i}`,
      });
    }
    keyboard.inline_keyboard.push(row);
  } else if (question.type === "text") {
    message += "\n\n💬 <i>Escribe tu respuesta como texto:</i>";
    // No hay botones, se espera texto del usuario
    // Marcar la sesión para esperar texto
    updateSession(sessionId, {
      waitingForText: true,
      currentQuestionIndex: questionIndex,
    }, botId);
  } else if (question.type === "yes_no") {
    keyboard.inline_keyboard.push([
      {
        text: "✅ Sí",
        callback_data: `survey_answer_${sessionId}_${questionIndex}_yes`,
      },
      {
        text: "❌ No",
        callback_data: `survey_answer_${sessionId}_${questionIndex}_no`,
      },
    ]);
  }
  
  // Botón de omitir si la pregunta es opcional
  if (!question.required && question.type !== "multiple_choice") {
    keyboard.inline_keyboard.push([
      {
        text: "⏭️ Omitir",
        callback_data: `survey_skip_${sessionId}_${questionIndex}`,
      },
    ]);
  }
  
  await telegram.sendMessage(chatId, message, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
}

/**
 * Procesa una respuesta del usuario
 */
export async function handleSurveyAnswer(telegram, userId, chatId, sessionId, questionIndex, answer, botId) {
  const session = getSession(sessionId, botId);
  if (!session) {
    await telegram.sendMessage(chatId, "❌ Sesión expirada. Por favor inicia nuevamente.");
    return;
  }
  
  const survey = getSurveyById(session.surveyId, botId);
  if (!survey) return;
  
  const question = survey.questions[questionIndex];
  const isQuiz = survey.type === "quiz";
  
  // Guardar respuesta
  const answers = session.answers || [];
  
  let answerData = {
    questionId: question.id,
    answer,
  };
  
  // Verificar respuesta si es quiz
  if (isQuiz) {
    let isCorrect = false;
    let pointsEarned = 0;
    
    if (question.type === "single_choice") {
      isCorrect = answer === question.correctAnswer;
      pointsEarned = isCorrect ? question.points : 0;
    } else if (question.type === "multiple_choice") {
      const correctAnswers = Array.isArray(question.correctAnswers) ? question.correctAnswers : [];
      const userAnswers = Array.isArray(answer) ? answer : [];
      
      if (survey.quizSettings.partialCredit && question.partialCredit) {
        // Crédito parcial: puntos proporcionales
        const correctSelected = userAnswers.filter((a) => correctAnswers.includes(a)).length;
        const incorrectSelected = userAnswers.filter((a) => !correctAnswers.includes(a)).length;
        const totalCorrect = correctAnswers.length;
        pointsEarned = Math.max(0, (correctSelected - incorrectSelected) / totalCorrect) * question.points;
        isCorrect = pointsEarned === question.points;
      } else {
        // Todo o nada
        isCorrect = userAnswers.length === correctAnswers.length &&
          userAnswers.every((a) => correctAnswers.includes(a));
        pointsEarned = isCorrect ? question.points : 0;
      }
    } else if (question.type === "yes_no") {
      isCorrect = answer === question.correctAnswer;
      pointsEarned = isCorrect ? question.points : 0;
    }
    
    answerData.correct = isCorrect;
    answerData.pointsEarned = pointsEarned;
  }
  
  answers[questionIndex] = answerData;
  updateSession(sessionId, { answers }, botId);
  
  // Mostrar feedback si es quiz y está configurado
  if (isQuiz && survey.quizSettings.showResults === "immediate") {
    await showImmediateFeedback(telegram, chatId, question, answerData, survey.quizSettings);
  }
  
  // Continuar a la siguiente pregunta o finalizar
  const nextIndex = questionIndex + 1;
  if (nextIndex < survey.questions.length) {
    updateSession(sessionId, { currentQuestionIndex: nextIndex }, botId);
    setTimeout(() => showQuestion(telegram, chatId, sessionId, nextIndex, botId), isQuiz ? 2000 : 500);
  } else {
    // Completar encuesta/quiz
    await completeSurvey(telegram, chatId, sessionId, botId);
  }
}

/**
 * Muestra feedback inmediato después de una respuesta (quiz)
 */
async function showImmediateFeedback(telegram, chatId, question, answerData, settings) {
  let message = answerData.correct
    ? `✅ <b>¡Correcto!</b> +${answerData.pointsEarned} puntos`
    : "❌ <b>Incorrecto</b>";
  
  if (!answerData.correct && settings.showCorrectAnswers) {
    if (question.type === "single_choice") {
      message += `\n\nLa respuesta correcta es: <b>${question.options[question.correctAnswer]}</b>`;
    } else if (question.type === "multiple_choice") {
      const correctOptions = question.correctAnswers.map((idx) => question.options[idx]);
      message += `\n\nLas respuestas correctas son:\n${correctOptions.map((o) => `• ${o}`).join("\n")}`;
    }
  }
  
  if (settings.showExplanations && question.explanation) {
    message += `\n\n📖 ${question.explanation}`;
  }
  
  await telegram.sendMessage(chatId, message, { parse_mode: "HTML" });
}

/**
 * Completa la encuesta/quiz
 */
async function completeSurvey(telegram, chatId, sessionId, botId) {
  const session = getSession(sessionId, botId);
  if (!session) return;
  
  const survey = getSurveyById(session.surveyId, botId);
  if (!survey) return;
  
  const isQuiz = survey.type === "quiz";
  const timeSpent = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
  
  let responseData = {
    surveyId: survey.id,
    userId: session.userId,
    answers: session.answers,
    timeSpent,
    startedAt: session.startedAt,
  };
  
  if (isQuiz) {
    // Calcular puntaje
    const totalPoints = survey.questions.reduce((sum, q) => sum + (q.points || 10), 0);
    const earnedPoints = session.answers.reduce((sum, a) => sum + (a.pointsEarned || 0), 0);
    const percentage = (earnedPoints / totalPoints) * 100;
    const passed = percentage >= survey.quizSettings.passingScore;
    
    responseData.isQuiz = true;
    responseData.score = earnedPoints;
    responseData.totalPoints = totalPoints;
    responseData.percentage = percentage;
    responseData.passed = passed;
    responseData.attemptNumber = getUserAttemptCount(survey.id, session.userId, botId) + 1;
  }
  
  // Guardar respuesta
  saveResponse(responseData, botId);
  
  // Eliminar sesión
  deleteSession(sessionId, botId);
  
  // Mostrar resultados finales
  await showFinalResults(telegram, chatId, survey, responseData);
}

/**
 * Muestra los resultados finales
 */
async function showFinalResults(telegram, chatId, survey, responseData) {
  const isQuiz = survey.type === "quiz";
  
  if (isQuiz) {
    const { score, totalPoints, percentage, passed, timeSpent } = responseData;
    
    let message = passed ? "🎉 <b>¡Quiz Completado!</b>\n\n" : "📊 <b>Quiz Completado</b>\n\n";
    message += `Tu puntaje: <b>${score}/${totalPoints}</b> (${percentage.toFixed(1)}%)\n`;
    message += passed ? "✅ <b>¡Aprobado!</b>" : "❌ <b>No aprobado</b>";
    message += `\n\nTiempo usado: ${formatTime(timeSpent)}\n`;
    
    // Mostrar respuestas
    message += "\n<b>Respuestas:</b>\n";
    responseData.answers.forEach((answer, index) => {
      const icon = answer.correct ? "✅" : "❌";
      message += `${icon} Pregunta ${index + 1} - ${answer.correct ? "Correcto" : "Incorrecto"}\n`;
    });
    
    if (survey.quizSettings.showLeaderboard) {
      const leaderboard = getQuizLeaderboard(survey.id, 10, survey.botId);
      const userRank = leaderboard.findIndex((entry) => entry.userId === responseData.userId) + 1;
      if (userRank > 0) {
        message += `\nTu posición: <b>#${userRank}</b> de ${leaderboard.length}`;
      }
    }
    
    const keyboard = {
      inline_keyboard: [],
    };
    
    if (survey.quizSettings.allowRetake) {
      const attempts = responseData.attemptNumber;
      const maxAttempts = survey.quizSettings.maxAttempts;
      
      if (attempts < maxAttempts) {
        keyboard.inline_keyboard.push([
          {
            text: "🔄 Intentar de Nuevo",
            callback_data: `survey_start_${survey.id}`,
          },
        ]);
      }
    }
    
    if (survey.quizSettings.showLeaderboard) {
      keyboard.inline_keyboard.push([
        {
          text: "📊 Ver Ranking",
          callback_data: `survey_leaderboard_${survey.id}`,
        },
      ]);
    }
    
    await telegram.sendMessage(chatId, message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } else {
    // Encuesta completada
    let message = "✅ <b>¡Gracias por tu respuesta!</b>\n\n";
    message += "Tu feedback nos ayuda a mejorar cada día.";
    
    await telegram.sendMessage(chatId, message, { parse_mode: "HTML" });
  }
}

/**
 * Muestra el leaderboard de un quiz
 */
export async function showLeaderboard(telegram, chatId, surveyId, botId) {
  const survey = getSurveyById(surveyId, botId);
  if (!survey || survey.type !== "quiz") {
    await telegram.sendMessage(chatId, "❌ Quiz no encontrado");
    return;
  }
  
  const leaderboard = getQuizLeaderboard(surveyId, 10, botId);
  
  if (leaderboard.length === 0) {
    await telegram.sendMessage(chatId, "📊 Aún no hay participantes en este quiz.");
    return;
  }
  
  let message = `🏆 <b>Ranking - ${survey.title}</b>\n\n`;
  
  leaderboard.forEach((entry) => {
    const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `${entry.rank}.`;
    const name = entry.username ? `@${entry.username}` : entry.firstName || "Usuario";
    message += `${medal} ${name} - ${entry.percentage.toFixed(1)}% (${formatTime(entry.timeSpent)})\n`;
  });
  
  await telegram.sendMessage(chatId, message, { parse_mode: "HTML" });
}

/**
 * Maneja el toggle de respuesta múltiple
 */
export async function handleMultipleChoiceToggle(telegram, userId, chatId, sessionId, questionIndex, optionIndex, messageId, botId) {
  const session = getSession(sessionId, botId);
  if (!session) return;
  
  const answers = session.answers || [];
  const currentAnswers = answers[questionIndex] || [];
  
  // Toggle la opción
  let newAnswers;
  if (currentAnswers.includes(optionIndex)) {
    newAnswers = currentAnswers.filter((idx) => idx !== optionIndex);
  } else {
    newAnswers = [...currentAnswers, optionIndex];
  }
  
  answers[questionIndex] = newAnswers;
  updateSession(sessionId, { answers }, botId);
  
  // Actualizar el mensaje con los nuevos checkboxes
  const survey = getSurveyById(session.surveyId, botId);
  const question = survey.questions[questionIndex];
  
  const keyboard = { inline_keyboard: [] };
  question.options.forEach((option, index) => {
    const isSelected = newAnswers.includes(index);
    keyboard.inline_keyboard.push([
      {
        text: `${isSelected ? "☑️" : "⬜️"} ${option}`,
        callback_data: `survey_toggle_${sessionId}_${questionIndex}_${index}`,
      },
    ]);
  });
  keyboard.inline_keyboard.push([
    {
      text: "✅ Confirmar Respuesta",
      callback_data: `survey_confirm_${sessionId}_${questionIndex}`,
    },
  ]);
  
  try {
    await telegram.editMessageReplyMarkup(keyboard, {
      chat_id: chatId,
      message_id: messageId,
    });
  } catch (error) {
    // Ignorar errores si el mensaje no cambió
  }
}

/**
 * Formatea tiempo en segundos a formato legible
 */
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

/**
 * Maneja respuestas de texto
 */
export async function handleTextAnswer(telegram, userId, chatId, text, botId) {
  const session = getUserActiveSession(userId, null, botId);
  if (!session || !session.waitingForText) return false;
  
  const sessionId = session.sessionId;
  const questionIndex = session.currentQuestionIndex;
  
  // Guardar respuesta de texto
  updateSession(sessionId, { waitingForText: false }, botId);
  await handleSurveyAnswer(telegram, userId, chatId, sessionId, questionIndex, text, botId);
  
  return true;
}
