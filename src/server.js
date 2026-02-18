import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import axios from "axios";
import fs from "fs";
import { pipeline } from "stream/promises";
import crypto from "crypto";
import { load } from "cheerio";

import {
  getContextState,
  updatePrompt,
  updateAdditionalNotes,
  contextReady,
} from "./config/contextStore.js";
import {
  listDocuments,
  getDocumentById,
  addDocument,
  removeDocument,
  updateDocument,
  documentsReady,
} from "./config/documentStore.js";
import { memoryReady } from "./config/memoryStore.js";
import { listTelegramUsers, upsertTelegramUser, usersReady, markTelegramUserBlocked, markTelegramUserError, removeTelegramUser } from "./config/userStore.js";

import { composeResponse } from "./openai.js";
import { processDocument } from "./documentProcessor.js";
import { getHistory, clearHistory, getHistoryByChatId, clearHistoryForChatId } from "./config/historyStore.js";
import { chunkText, embedChunks, embedChunkDescriptors } from "./embeddings.js";
import { chunkByStructure, extractHtmlSectionsFromHtml } from "./structuredChunking.js";
import { createTelegramService, classifyTelegramSendError } from "./services/telegramService.js";
import { getLearningPatterns, addLearningPattern, updateLearningPattern, deleteLearningPattern, getLearningStats, learningReady } from "./config/learningStore.js";
import { getCategories, addCategory, deleteCategory, updateCategory, getSuggestedCategories, getSuggestedCategoriesPending, approveSuggestedCategory, rejectSuggestedCategory, updateSuggestedCategory, categoriesReady } from "./config/categoriesStore.js";
import { getCacheStats, recordCacheHit, recordCacheEntry, cacheReady } from "./config/cacheStore.js";
import { getAllFAQs, getFAQsByCategory, getTopFAQs, updateFAQ, deleteFAQ, toggleFAQ, getFAQStats } from "./config/faqStore.js";
import { getCategories as getFAQCategories } from "./config/categoryDetector.js";
import { getEmbeddingCacheStats, cleanOldEmbeddings } from "./config/embeddingCache.js";
import { getIndexStats, rebuildDocumentIndex, removeDocumentFromIndex } from "./config/documentVectorIndex.js";
import { getAllSurveys, getSurveyById, createSurvey, updateSurvey, deleteSurvey, closeSurvey, markSurveyAsSent, getSurveyResponses, getSurveyStats, getQuizLeaderboard, surveysReady } from "./config/surveyStore.js";
import { sendSurveyToUser, startSurvey, handleSurveyAnswer, handleMultipleChoiceToggle, showLeaderboard, handleTextAnswer } from "./services/surveyService.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsPath = path.join(__dirname, "..", "uploads");
try {
  fs.mkdirSync(uploadsPath, { recursive: true });
} catch (error) {
  console.error("No se pudo crear el directorio uploads", error);
}

const DOCUMENT_UPLOAD_MAX_MB = Number.parseInt(process.env.DOCUMENT_UPLOAD_MAX_MB || "60", 10);
const documentUploadMaxBytes = Number.isFinite(DOCUMENT_UPLOAD_MAX_MB) && DOCUMENT_UPLOAD_MAX_MB > 0
  ? DOCUMENT_UPLOAD_MAX_MB * 1024 * 1024
  : null;

const upload = multer({
  dest: uploadsPath,
  ...(documentUploadMaxBytes
    ? {
        limits: {
          fileSize: documentUploadMaxBytes,
        },
      }
    : {}),
});
const broadcastUpload = multer({
  dest: uploadsPath,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Support deployment under a subpath: if WEBHOOK_BASE has a pathname (e.g. https://host/botusbcali),
// allow requests that include that prefix by stripping it before routing.
const _APP_BASE_PATH = (function () {
  try {
    const bp = process.env.WEBHOOK_BASE ? new URL(process.env.WEBHOOK_BASE).pathname : "";
    return String(bp || "").replace(/\/$/, "");
  } catch (e) {
    return "";
  }
})();
if (_APP_BASE_PATH) {
  app.use((req, res, next) => {
    if (req.url === _APP_BASE_PATH) {
      req.url = "/";
    } else if (req.url.startsWith(_APP_BASE_PATH + "/")) {
      req.url = req.url.slice(_APP_BASE_PATH.length) || "/";
    }
    return next();
  });
}

// Serve admin-ui build if it exists (MUST be BEFORE public/ to take precedence)
// In production, admin-ui is available at / (after _APP_BASE_PATH strips /botusbcali)
const adminDistPath = path.join(__dirname, "..", "admin-ui", "dist");
const adminIndexPath = path.join(adminDistPath, "index.html");
if (fs.existsSync(adminDistPath)) {
  // Serve assets folder with specific route (prevents catch-all from intercepting)
  app.use("/assets", express.static(path.join(adminDistPath, "assets"), {
    maxAge: "1y",
    immutable: true,
  }));
  
  // Serve other static files from root (with index: false to not auto-serve index.html)
  app.use(express.static(adminDistPath, {
    index: false,
  }));
  
  // SPA fallback for admin-ui routes (must be at the end, after all API routes)
  // This will be registered but should be moved after API routes
}

// API: historial de preguntas y respuestas
app.get("/api/history", (req, res) => {
  res.json(getHistory());
});

app.post("/api/history/clear", (req, res) => {
  clearHistory();
  res.json({ ok: true });
});

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const telegram = createTelegramService({ token: TELEGRAM_TOKEN });

const RECENT_INGEST_MINUTES = Number.parseInt(
  process.env.DOCUMENT_INGEST_RECENT_MINUTES || "15",
  10
);
const DEFAULT_INGEST_WAIT_MS = Number.parseInt(
  process.env.DOCUMENT_INGEST_WAIT_MS || "5000",
  10
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecentlyCreated(doc) {
  const createdAt = doc?.createdAt ? new Date(doc.createdAt).getTime() : 0;
  if (!createdAt || Number.isNaN(createdAt)) return false;
  const windowMs = RECENT_INGEST_MINUTES * 60 * 1000;
  return Date.now() - createdAt <= windowMs;
}

function isPendingIngest(doc) {
  const status = String(doc?.status || "").toLowerCase();
  return status === "uploaded" || status === "processing" || status === "extracting";
}

async function waitForRecentIngestion({ timeoutMs = DEFAULT_INGEST_WAIT_MS, intervalMs = 300 } = {}) {
  const started = Date.now();
  let lastPendingCount = 0;
  while (Date.now() - started < timeoutMs) {
    const docs = listDocuments();
    const pending = docs.filter((doc) => isRecentlyCreated(doc) && isPendingIngest(doc));
    lastPendingCount = pending.length;
    if (!lastPendingCount) {
      return { waitedMs: Date.now() - started, pendingCount: 0 };
    }
    await sleep(intervalMs);
  }
  return { waitedMs: Date.now() - started, pendingCount: lastPendingCount };
}

const EXT_BY_MIME = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/csv": ".csv",
  "application/csv": ".csv",
  "text/plain": ".txt",
  "text/html": ".html",
  "application/xhtml+xml": ".html",
};

function resolveExtension(originalName, mimetype) {
  const ext = path.extname(originalName || "").toLowerCase();
  if (ext) return ext;
  const normalized = String(mimetype || "").toLowerCase().split(";")[0];
  return EXT_BY_MIME[normalized] || "";
}

function telegramNotConfigured(res) {
  res.status(500).json({
    error: "TELEGRAM_BOT_TOKEN is not set",
  });
}

function getTelegramUserInfo(message) {
  const chatId = message?.chat?.id;
  const from = message?.from;
  const chat = message?.chat;
  return {
    chatId: chatId != null ? String(chatId) : "",
    username: from?.username || chat?.username || "",
    firstName: from?.first_name || chat?.first_name || "",
    lastName: from?.last_name || chat?.last_name || "",
    type: chat?.type || "",
  };
}

function extractTextFromHtml(html, baseUrl = null) {
  const $ = load(html);
  $("script, style, noscript, iframe, svg, canvas, nav, footer, header, form").remove();

  const title = $("title").text().trim();
  const description = $("meta[name='description']").attr("content")?.trim();

  const isPasted = baseUrl == null;

  if (isPasted) {
    const preBlocks = $("pre")
      .toArray()
      .map((el) => $(el).text())
      .map((text) => String(text || "").replace(/\r\n/g, "\n").trim())
      .filter(Boolean);

    if (preBlocks.length) {
      const pieces = [
        title ? `Título: ${title}` : "",
        description ? `Descripción: ${description}` : "",
        preBlocks.join("\n\n"),
      ].filter(Boolean);
      return pieces.join("\n\n");
    }
  }

  const containers = $("main, article, .entry-content, .content, #content, .site-content");
  let base = containers.first();
  if (!base.length || base.text().trim().length < 200) {
    base = $("body");
  }

  const lines = [];
  const teacherLines = [];
  base.find("h1, h2, h3, h4, h5, h6, p, li, td, th, strong, b, em, span").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) {
      lines.push(text);
    }
  });

  base
    .find(
      "[class*='docente'], [class*='profesor'], [class*='teacher'], [class*='equipo'], [class*='team'], [class*='faculty']"
    )
    .each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text) {
        teacherLines.push(text);
      }
    });

  const uniqueTeachers = Array.from(new Set(teacherLines));
  const uniqueLines = Array.from(new Set(lines));

  let bodyText = uniqueLines.length
    ? uniqueLines.join("\n")
    : base.text().replace(/\s+/g, " ").trim();

  if (!isPasted && !/docente|profesor|teacher|cuerpo docente/i.test(bodyText)) {
    bodyText = base.text().replace(/\s+/g, " ").trim();
  }

  let filtered = bodyText;
  if (!isPasted) {
    const wordMatches = bodyText.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) || [];
    const wordCounts = new Map();
    for (const word of wordMatches) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
    const stopwords = new Set(
      Array.from(wordCounts.entries())
        .filter(([, count]) => count > 10)
        .map(([word]) => word)
    );
    filtered = bodyText
      .split(/\s+/)
      .filter((token) => {
        const normalized = token.toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, "");
        return normalized && !stopwords.has(normalized);
      })
      .join(" ");
  }

  const teacherBlock = uniqueTeachers.length
    ? `Cuerpo docente:\n${uniqueTeachers.join("\n")}`
    : "";

  const links = [];
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href")?.trim();
    if (!href) return;
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }
    let resolved = href;
    if (baseUrl) {
      try {
        resolved = new URL(href, baseUrl).toString();
      } catch {
        resolved = href;
      }
    }
    const text = $(element).text().replace(/\s+/g, " ").trim();
    links.push(`${text || "Enlace"}: ${resolved}`);
  });
  const uniqueLinks = Array.from(new Set(links)).slice(0, 200);
  const linksBlock = uniqueLinks.length ? `Enlaces:\n${uniqueLinks.join("\n")}` : "";

  const pieces = [
    title ? `Título: ${title}` : "",
    description ? `Descripción: ${description}` : "",
    teacherBlock,
    filtered,
    linksBlock,
  ].filter(Boolean);
  return pieces.join("\n\n");
}

function stripChunksForClient(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const { chunks, ...rest } = doc;

  const limitRaw = process.env.CLIENT_EXTRACTED_TEXT_LIMIT;
  const limit = Number.parseInt(limitRaw || "20000", 10);
  if (
    Number.isFinite(limit) &&
    limit > 0 &&
    typeof rest.extractedText === "string" &&
    rest.extractedText.length > limit
  ) {
    const originalLength = rest.extractedText.length;
    rest.extractedText = `${rest.extractedText.slice(0, limit)}\n\n...(texto extraído truncado para la UI; ${originalLength} caracteres en total)...`;
    rest.extractedTextTruncated = true;
    rest.extractedTextLength = originalLength;
  }
  return rest;
}

function listDocumentsForClient() {
  return listDocuments().map(stripChunksForClient);
}

async function indexDocumentEmbeddings(document, text, options = {}) {
  if (!text) {
    return;
  }
  try {
    const descriptors = chunkByStructure({
      extractedText: text,
      mimetype: document?.mimetype,
      originalName: document?.originalName,
      sourceUrl: document?.sourceUrl,
      htmlSections: options.htmlSections,
      webPages: options.webPages,
    });

    const chunks = Array.isArray(descriptors) && descriptors.length
      ? await embedChunkDescriptors(descriptors)
      : await embedChunks(chunkText(text));

    if (chunks.length) {
      updateDocument(document.id, { chunks });
    }
  } catch (error) {
    console.error("Error generando embeddings", error);
  }
}

function extractLinksFromHtml(html, baseUrl) {
  const $ = load(html);
  const links = new Set();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }
    try {
      const absolute = new URL(href, baseUrl).toString();
      links.add(absolute);
    } catch {
      return;
    }
  });
  return Array.from(links);
}

async function crawlWebsite({ startUrl, maxDepth, maxPages }) {
  const visited = new Set();
  const queue = [{ url: startUrl, depth: 0 }];
  const results = [];
  const start = new URL(startUrl);

  while (queue.length && visited.size < maxPages) {
    const { url, depth } = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      const response = await axios.get(url, {
        responseType: "text",
        timeout: 25000,
        maxContentLength: 15 * 1024 * 1024,
        headers: {
          Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "User-Agent": "Mozilla/5.0",
        },
      });
      const contentType = response.headers["content-type"] ?? "";
      const normalizedType = String(contentType).toLowerCase().split(";")[0];
      if (!normalizedType.includes("text/html") && !normalizedType.includes("application/xhtml")) {
        continue;
      }
      const html = String(response.data ?? "");
      const text = extractTextFromHtml(html, url);
      if (text) {
        results.push({ url, text });
      }

      if (depth < maxDepth && visited.size < maxPages) {
        const links = extractLinksFromHtml(html, url);
        for (const link of links) {
          if (visited.size + queue.length >= maxPages) break;
          try {
            const target = new URL(link);
            if (target.origin !== start.origin) continue;
            queue.push({ url: target.toString(), depth: depth + 1 });
          } catch {
            continue;
          }
        }
      }
    } catch (error) {
      console.error("Error extrayendo página", url, error?.message || error);
    }
  }

  return results;
}

app.post("/webhook", async (req, res) => {
  if (!telegram.isConfigured) {
    return telegramNotConfigured(res);
  }

  const update = req.body;
  
  // Manejar callback queries (botones de encuestas/quizzes)
  if (update.callback_query) {
    const callbackQuery = update.callback_query;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    
    try {
      // Respuestas de encuestas/quizzes
      if (data.startsWith("survey_")) {
        console.log("[survey-callback] data:", data);
        if (data.startsWith("survey_start_")) {
          const surveyId = data.slice("survey_start_".length);
          await telegram.answerCallbackQuery(callbackQuery.id, { text: "Iniciando..." });
          await startSurvey(telegram, userId, chatId, surveyId, messageId);
        } else if (data.startsWith("survey_later_")) {
          await telegram.answerCallbackQuery(callbackQuery.id, { text: "Puedes responder cuando quieras" });
        } else if (data.startsWith("survey_leaderboard_")) {
          const surveyId = data.slice("survey_leaderboard_".length);
          await telegram.answerCallbackQuery(callbackQuery.id);
          await showLeaderboard(telegram, chatId, surveyId);
        } else if (data.startsWith("survey_answer_")) {
          // Format: survey_answer_{sessionId}_{questionIndex}_{answer}
          // sessionId puede incluir '_' (ej: session_abcd1234), por eso usamos regex
          const match = data.match(/^survey_answer_(.+)_(\d+)_(.+)$/);
          if (!match) {
            await telegram.answerCallbackQuery(callbackQuery.id, { text: "Respuesta inválida" });
            return res.sendStatus(200);
          }

          const sessionId = match[1];
          const questionIndex = Number.parseInt(match[2], 10);
          const answer = match[3];
          console.log("[survey-answer] sessionId:", sessionId, "questionIndex:", questionIndex, "answer:", answer);
          const parsedAnswer = Number.isNaN(Number(answer)) ? answer : Number.parseInt(answer, 10);

          await telegram.answerCallbackQuery(callbackQuery.id);
          await handleSurveyAnswer(telegram, userId, chatId, sessionId, questionIndex, parsedAnswer);
        } else if (data.startsWith("survey_toggle_")) {
          // Format: survey_toggle_{sessionId}_{questionIndex}_{optionIndex}
          const match = data.match(/^survey_toggle_(.+)_(\d+)_(\d+)$/);
          if (!match) {
            await telegram.answerCallbackQuery(callbackQuery.id, { text: "Selección inválida" });
            return res.sendStatus(200);
          }

          const sessionId = match[1];
          const questionIndex = Number.parseInt(match[2], 10);
          const optionIndex = Number.parseInt(match[3], 10);
          console.log("[survey-toggle] sessionId:", sessionId, "questionIndex:", questionIndex, "optionIndex:", optionIndex);

          await telegram.answerCallbackQuery(callbackQuery.id);
          await handleMultipleChoiceToggle(telegram, userId, chatId, sessionId, questionIndex, optionIndex, messageId);
        } else if (data.startsWith("survey_confirm_")) {
          // Format: survey_confirm_{sessionId}_{questionIndex}
          const match = data.match(/^survey_confirm_(.+)_(\d+)$/);
          if (!match) {
            await telegram.answerCallbackQuery(callbackQuery.id, { text: "Confirmación inválida" });
            return res.sendStatus(200);
          }

          const sessionId = match[1];
          const questionIndex = Number.parseInt(match[2], 10);
          console.log("[survey-confirm] sessionId:", sessionId, "questionIndex:", questionIndex);

          // Obtener las respuestas seleccionadas de la sesión
          const { getSession } = await import("./config/surveyStore.js");
          const session = getSession(sessionId);
          const answers = session?.answers?.[questionIndex] || [];

          await telegram.answerCallbackQuery(callbackQuery.id, { text: "Respuesta guardada" });
          await handleSurveyAnswer(telegram, userId, chatId, sessionId, questionIndex, answers);
        } else if (data.startsWith("survey_skip_")) {
          // Format: survey_skip_{sessionId}_{questionIndex}
          const match = data.match(/^survey_skip_(.+)_(\d+)$/);
          if (!match) {
            await telegram.answerCallbackQuery(callbackQuery.id, { text: "Acción inválida" });
            return res.sendStatus(200);
          }

          const sessionId = match[1];
          const questionIndex = Number.parseInt(match[2], 10);
          console.log("[survey-skip] sessionId:", sessionId, "questionIndex:", questionIndex);

          await telegram.answerCallbackQuery(callbackQuery.id, { text: "Pregunta omitida" });
          await handleSurveyAnswer(telegram, userId, chatId, sessionId, questionIndex, null);
        }
        
        return res.sendStatus(200);
      }
      
      await telegram.answerCallbackQuery(callbackQuery.id);
      return res.sendStatus(200);
    } catch (error) {
      console.error("Callback query error", error);
      try {
        await telegram.answerCallbackQuery(callbackQuery.id, { text: "Error al procesar" });
      } catch (e) {
        // Ignorar
      }
      return res.sendStatus(200);
    }
  }
  
  // Manejar mensajes de texto
  const message = update.message ?? update.edited_message;
  const text = message?.text?.trim();

  if (!message || !message.chat?.id || !text) {
    return res.sendStatus(200);
  }

  try {
    // Persist user info (only users who wrote to the bot are stored).
    upsertTelegramUser(getTelegramUserInfo(message));
    
    const userId = message.from.id;
    const chatId = message.chat.id;
    
    // Verificar si el usuario está respondiendo una pregunta de texto de encuesta
    const handledBySurvey = await handleTextAnswer(telegram, userId, chatId, text);
    if (handledBySurvey) {
      return res.sendStatus(200);
    }

    const ingestStatus = await waitForRecentIngestion();
    const baseContext = getContextState();
    const ingestNote = ingestStatus.pendingCount
      ? `Nota: aún estoy procesando ${ingestStatus.pendingCount} documento(s) subido(s) recientemente. Si la respuesta no incluye información nueva, pide al usuario que reintente en 1-2 minutos.`
      : "";

    const payload = {
      incomingText: text,
      chatId: String(message.chat.id),
      context: {
        ...baseContext,
        additionalNotes: [baseContext?.additionalNotes, ingestNote]
          .filter(Boolean)
          .join("\n"),
      },
      documents: listDocuments(),
    };

    const reply = await composeResponse(payload);
    await telegram.sendMessage(message.chat.id, reply ?? "Got it!");
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error", error);
    try {
      await telegram.sendMessage(message.chat.id, "Lo siento, hubo un problema al generar la respuesta.");
    } catch (sendError) {
      console.error("No se pudo enviar mensaje de error a Telegram", sendError);
    }
    res.sendStatus(200);
  }
});

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
    if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  }
  return Boolean(value);
}

function normalizeChatIds(value) {
  if (Array.isArray(value)) {
    return value.map((id) => String(id).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\s,;]+/g)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return null;
}

function isHttpsUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

app.post("/send-broadcast", broadcastUpload.single("media"), async (req, res) => {
  if (!telegram.isConfigured) {
    return telegramNotConfigured(res);
  }

  // Same-domain panel: if the browser sends Origin, enforce it.
  // This reduces risk of cross-site requests when the endpoint is exposed.
  const originHeader = String(req.headers.origin || "").trim();
  const allowedOriginRaw = process.env.BROADCAST_ALLOWED_ORIGIN || process.env.WEBHOOK_BASE || "";
  const allowedOrigins = String(allowedOriginRaw)
    .split(/[\s,]+/g)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return value;
      }
    });

  if (originHeader && allowedOrigins.length && !allowedOrigins.includes(originHeader)) {
    return res.status(403).json({
      error: "Origen no permitido.",
      origin: originHeader,
    });
  }

  const text =
    typeof req.body?.text === "string"
      ? req.body.text.trim()
      : typeof req.body?.message === "string"
      ? req.body.message.trim()
      : "";
  const sendToAll = parseBoolean(req.body?.sendToAll);
  const requestedChatIds = normalizeChatIds(req.body?.chatIds);

  const mediaType = typeof req.body?.mediaType === "string" ? req.body.mediaType.trim() : "";
  const mediaCaption = typeof req.body?.mediaCaption === "string" ? req.body.mediaCaption.trim() : "";
  const mediaRef = typeof req.body?.mediaRef === "string" ? req.body.mediaRef.trim() : "";
  const mediaRefKindRaw = typeof req.body?.mediaRefKind === "string" ? req.body.mediaRefKind.trim() : "";
  const mediaRefKind = mediaRefKindRaw === "file_id" || mediaRefKindRaw === "url" ? mediaRefKindRaw : "";

  const hasMediaUpload = Boolean(req.file);
  const hasMediaRef = Boolean(mediaType && mediaRef);
  const hasText = Boolean(text);

  if (!hasText && !hasMediaUpload && !hasMediaRef) {
    return res.status(400).json({
      error: "Se requiere 'text/message' y/o multimedia ('mediaType' + 'mediaRef' o archivo 'media').",
    });
  }

  if (!sendToAll && (!requestedChatIds || !requestedChatIds.length)) {
    return res.status(400).json({
      error: "Debes enviar 'sendToAll=true' o una lista 'chatIds'.",
    });
  }

  if (hasMediaRef) {
    const kind = mediaRefKind || (mediaRef.startsWith("http") ? "url" : "file_id");
    if (kind === "url" && !isHttpsUrl(mediaRef)) {
      return res.status(400).json({ error: "mediaRef debe ser una URL https válida." });
    }
  }

  if (mediaType && !["photo", "video", "audio", "document"].includes(mediaType)) {
    return res.status(400).json({
      error: "mediaType inválido. Usa: photo, video, audio, document.",
    });
  }

  // Verificar secreto de broadcast si está configurado
  const secret = process.env.BROADCAST_SECRET;
  if (secret) {
    const provided = req.header("x-broadcast-secret") || "";
    if (provided !== secret) {
      return res.status(401).json({ error: "No autorizado. Secreto de broadcast inválido." });
    }
  }

  const allUsers = listTelegramUsers();
  const usersByChatId = new Map(allUsers.map((u) => [String(u.chatId), u]));

  const targets = sendToAll
    ? allUsers.filter((u) => !u?.isBlocked).map((u) => String(u.chatId))
    : requestedChatIds.filter((id) => usersByChatId.has(String(id)));

  const unknownChatIds = !sendToAll && requestedChatIds
    ? requestedChatIds.filter((id) => !usersByChatId.has(String(id)))
    : [];

  const delayMs = Number.parseInt(process.env.BROADCAST_DELAY_MS || "60", 10);

  const started = Date.now();
  let sent = 0;
  const failures = [];

  const uploadedFileInfo = req.file
    ? {
        filePath: req.file.path,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
      }
    : null;

  try {
    for (const chatId of targets) {
      try {
        if (mediaType && (uploadedFileInfo || hasMediaRef)) {
          const caption = mediaCaption || "";
          if (uploadedFileInfo) {
            if (mediaType === "photo") await telegram.sendPhoto(chatId, uploadedFileInfo, { caption });
            if (mediaType === "video") await telegram.sendVideo(chatId, uploadedFileInfo, { caption });
            if (mediaType === "audio") await telegram.sendAudio(chatId, uploadedFileInfo, { caption });
            if (mediaType === "document") await telegram.sendDocument(chatId, uploadedFileInfo, { caption });
          } else {
            if (mediaType === "photo") await telegram.sendPhoto(chatId, mediaRef, { caption });
            if (mediaType === "video") await telegram.sendVideo(chatId, mediaRef, { caption });
            if (mediaType === "audio") await telegram.sendAudio(chatId, mediaRef, { caption });
            if (mediaType === "document") await telegram.sendDocument(chatId, mediaRef, { caption });
          }
        }

        if (hasText) {
          await telegram.sendMessage(chatId, text);
        }

        sent += 1;
      } catch (error) {
        const classified = classifyTelegramSendError(error);
        const info = {
          chatId,
          reason: classified.reason,
          status: classified.status || null,
          description: classified.description || "",
        };
        failures.push(info);

        if (classified.reason === "blocked") {
          markTelegramUserBlocked(chatId, classified.description);
        } else {
          markTelegramUserError(chatId, classified.description);
        }
      }

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  } finally {
    if (uploadedFileInfo?.filePath) {
      try {
        await fs.promises.unlink(uploadedFileInfo.filePath);
      } catch (error) {
        console.error("No se pudo borrar archivo temporal de broadcast", error);
      }
    }
  }

  for (const chatId of unknownChatIds) {
    failures.push({
      chatId,
      reason: "not_interacted",
      status: null,
      description: "El chat_id no existe en la base (el usuario nunca le escribió al bot).",
    });
  }

  const durationMs = Date.now() - started;

  const byReason = failures.reduce((acc, f) => {
    const key = f.reason || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  res.json({
    totalTargets: targets.length,
    sent,
    failed: failures.length,
    unknownChatIds: unknownChatIds.length,
    failures,
    byReason,
    durationMs,
  });
});

app.get("/api/config", (req, res) => {
  res.json({
    context: getContextState(),
    documents: listDocumentsForClient(),
    limits: {
      documentUploadMaxMB: DOCUMENT_UPLOAD_MAX_MB,
    },
  });
});

// List Telegram users
app.get('/api/users', (req, res) => {
  res.json(listTelegramUsers());
});

// Delete a Telegram user from store
app.delete('/api/users/:chatId', (req, res) => {
  const chatId = req.params.chatId;
  const removed = removeTelegramUser ? removeTelegramUser(chatId) : false;
  if (!removed) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ ok: true });
});

// Send a direct message to a single user
app.post('/api/users/:chatId/message', async (req, res) => {
  if (!telegram.isConfigured) return telegramNotConfigured(res);
  const chatId = req.params.chatId;
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'Se requiere texto' });
  try {
    await telegram.sendMessage(chatId, text);
    res.json({ ok: true });
  } catch (error) {
    const classified = classifyTelegramSendError(error);
    if (classified.reason === 'blocked') markTelegramUserBlocked(chatId, classified.description);
    else markTelegramUserError(chatId, classified.description);
    res.status(500).json({ error: classified.description || String(error?.message || 'Error') });
  }
});

app.post("/api/config/context", (req, res) => {
  const { activePrompt, additionalNotes, promptTemplate } = req.body;

  if (typeof activePrompt === "string") {
    updatePrompt(activePrompt);
  }
  if (typeof additionalNotes === "string") {
    updateAdditionalNotes(additionalNotes);
  }

  res.json(getContextState());
});

app.post(
  "/api/documents",
  upload.single("document"),
  async (req, res) => {
    // debugging/logging: help diagnose proxy vs backend upload problems
    console.log(`[uploads] incoming /api/documents from ip=${req.ip || req.socket?.remoteAddress || 'unknown'} content-length=${req.headers['content-length'] || 'n/a'} content-type=${req.headers['content-type'] || 'n/a'}`);

    if (!req.file) {
      console.log('[uploads] no req.file present after multipart handling — possible proxy buffering/limit or client aborted upload');
      return res.status(400).json({ error: "No document uploaded." });
    }

    const summary = typeof req.body.summary === "string" ? req.body.summary : "";

    let filePath = req.file.path;
    let filename = req.file.filename;
    const extension = resolveExtension(req.file.originalname, req.file.mimetype);
    if (extension && !filename.endsWith(extension)) {
      const renamed = `${filename}${extension}`;
      const renamedPath = path.join(uploadsPath, renamed);
      try {
        await fs.promises.rename(filePath, renamedPath);
        filePath = renamedPath;
        filename = renamed;
      } catch (error) {
        console.error("No se pudo renombrar el archivo subido", error);
      }
    }

    const document = addDocument({
      filename,
      originalName: req.file.originalname,
      path: filePath,
      size: req.file.size,
      mimetype: req.file.mimetype,
      summary,
    });

    processDocument(document).catch((processError) => {
      console.error("Error procesando documento", processError);
    });

    const docsForClient = listDocumentsForClient();
    console.log(`[uploads] finished /api/documents — saved=${document.originalName || document.filename} size=${document.size} documentsReturned=${(Array.isArray(docsForClient) && docsForClient.length) || 0}`);
    res.json(docsForClient);
  }
);

app.post("/api/documents/url", async (req, res) => {
  const { url, summary } = req.body;
  if (typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ error: "Se requiere una URL válida." });
  }

  let destination;
  try {
    const normalizedUrl = new URL(url);
    const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".xlsx", ".csv", ".txt"]);
    const allowedMimeTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/csv",
      "text/plain",
    ]);
    const extension = path.extname(normalizedUrl.pathname);
    const filename = `${crypto.randomUUID()}${extension || ""}`;
    destination = path.join(uploadsPath, filename);

    const response = await axios.get(normalizedUrl.toString(), {
      responseType: "stream",
      timeout: 25000,
      maxContentLength: 200 * 1024 * 1024,
      maxBodyLength: 200 * 1024 * 1024,
      headers: {
        Accept:
          "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,*/*;q=0.8",
      },
    });

    const contentType = response.headers["content-type"] ?? "";
    const normalizedType = String(contentType).toLowerCase().split(";")[0];
    const ext = extension || "";
    const isAllowedType = allowedMimeTypes.has(normalizedType);
    const isAllowedExtension = allowedExtensions.has(ext.toLowerCase());
    if (!isAllowedType && !isAllowedExtension) {
      throw new Error("El recurso no es un PDF, Word, Excel, CSV o TXT válido.");
    }

    const finalExtension = isAllowedExtension
      ? ext
      : normalizedType === "application/msword"
      ? ".doc"
      : normalizedType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ? ".docx"
      : normalizedType ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ? ".xlsx"
      : normalizedType === "text/csv" || normalizedType === "application/csv"
      ? ".csv"
      : normalizedType === "text/plain"
      ? ".txt"
      : ".pdf";

    if ((!extension || !isAllowedExtension) && finalExtension) {
      const renamed = `${crypto.randomUUID()}${finalExtension}`;
      destination = path.join(uploadsPath, renamed);
    }

    await pipeline(response.data, fs.createWriteStream(destination));
    const { size } = await fs.promises.stat(destination);

    const document = addDocument({
      filename: path.basename(destination),
      originalName:
        path.basename(normalizedUrl.pathname) || `documento${finalExtension}`,
      path: destination,
      size,
      mimetype: normalizedType || contentType,
      summary: typeof summary === "string" ? summary : "",
      sourceUrl: normalizedUrl.toString(),
    });

    processDocument(document).catch((processError) => {
      console.error("Error procesando documento", processError);
    });

    res.json(listDocumentsForClient());
  } catch (error) {
    if (destination) {
      try {
        await fs.promises.unlink(destination);
      } catch (unlinkError) {
        console.error("No se pudo eliminar archivo temporal", unlinkError);
      }
    }
    console.error("Descarga fallida", error);
    res
      .status(400)
      .json({ error: error.message || "No se pudo descargar el documento." });
  }
});

app.post("/api/documents/web", async (req, res) => {
  const { url, summary, depth, maxPages } = req.body;
  if (typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ error: "Se requiere una URL válida." });
  }

  try {
    const normalizedUrl = new URL(url);
    const depthLimit = Number.isFinite(Number(depth)) ? Math.max(0, Number(depth)) : 0;
    const pagesLimit = Number.isFinite(Number(maxPages))
      ? Math.max(1, Number(maxPages))
      : 1;

    if (depthLimit === 0 && pagesLimit <= 1) {
      const response = await axios.get(normalizedUrl.toString(), {
        responseType: "text",
        timeout: 25000,
        maxContentLength: 15 * 1024 * 1024,
        headers: {
          Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "User-Agent": "Mozilla/5.0",
        },
      });

      const contentType = response.headers["content-type"] ?? "";
      const normalizedType = String(contentType).toLowerCase().split(";")[0];
      if (!normalizedType.includes("text/html") && !normalizedType.includes("application/xhtml")) {
        return res.status(400).json({ error: "La URL no parece ser una página HTML." });
      }

      const html = String(response.data ?? "");
      const extractedText = extractTextFromHtml(html, normalizedUrl.toString());
      if (!extractedText) {
        return res.status(400).json({ error: "No se pudo extraer texto de la página." });
      }

      const htmlSections = extractHtmlSectionsFromHtml(html, normalizedUrl.toString());

      const originalName = normalizedUrl.hostname + normalizedUrl.pathname;
      const document = addDocument({
        filename: `web-${crypto.randomUUID()}.html`,
        originalName,
        path: null,
        size: Buffer.byteLength(html, "utf8"),
        mimetype: "text/html",
        summary: typeof summary === "string" ? summary : "",
        sourceUrl: normalizedUrl.toString(),
      });

      const autoSummary = extractedText.slice(0, 400);

      updateDocument(document.id, {
        autoSummary: autoSummary || document.manualSummary || "Sin texto legible",
        extractedText,
        usedOcr: false,
        status: "ready",
        processedAt: new Date().toISOString(),
        error: null,
      });

      await indexDocumentEmbeddings(document, extractedText, { htmlSections });

      return res.json(listDocumentsForClient());
    }

    const pages = await crawlWebsite({
      startUrl: normalizedUrl.toString(),
      maxDepth: Math.min(depthLimit, 3),
      maxPages: Math.min(pagesLimit, 50),
    });

    if (!pages.length) {
      return res.status(400).json({ error: "No se pudo extraer texto de la página." });
    }

    const combinedText = pages
      .map((page) => `Página: ${page.url}\n${page.text}`)
      .join("\n\n");

    const trimmedText = combinedText.slice(0, 200000);

    const originalName = normalizedUrl.hostname + normalizedUrl.pathname;
    const document = addDocument({
      filename: `web-${crypto.randomUUID()}.html`,
      originalName,
      path: null,
      size: Buffer.byteLength(trimmedText, "utf8"),
      mimetype: "text/html",
      summary: typeof summary === "string" ? summary : "",
      sourceUrl: normalizedUrl.toString(),
    });

    const autoSummary = trimmedText.slice(0, 400);

    updateDocument(document.id, {
      autoSummary: autoSummary || document.manualSummary || "Sin texto legible",
      extractedText: trimmedText,
      usedOcr: false,
      status: "ready",
      processedAt: new Date().toISOString(),
      error: null,
    });

    await indexDocumentEmbeddings(document, trimmedText, { webPages: pages });

    res.json(listDocumentsForClient());
  } catch (error) {
    console.error("Error extrayendo página web", error);
    res.status(400).json({ error: error.message || "No se pudo extraer la página." });
  }
});

app.post("/api/documents/html", async (req, res) => {
  const { html, summary, title } = req.body;
  if (typeof html !== "string" || !html.trim()) {
    return res.status(400).json({ error: "Se requiere HTML válido." });
  }

  try {
    const extractedText = extractTextFromHtml(html, null);
    if (!extractedText) {
      return res.status(400).json({ error: "No se pudo extraer texto del HTML." });
    }

    const htmlSections = extractHtmlSectionsFromHtml(html, null);

    const originalName = title?.trim() || "HTML pegado";
    const document = addDocument({
      filename: `html-${crypto.randomUUID()}.html`,
      originalName,
      path: null,
      size: Buffer.byteLength(html, "utf8"),
      mimetype: "text/html",
      summary: typeof summary === "string" ? summary : "",
      sourceUrl: null,
    });

    const autoSummary = extractedText.slice(0, 400);

    updateDocument(document.id, {
      autoSummary: autoSummary || document.manualSummary || "Sin texto legible",
      extractedText,
      usedOcr: false,
      status: "ready",
      processedAt: new Date().toISOString(),
      error: null,
    });

    await indexDocumentEmbeddings(document, extractedText, { htmlSections });

    res.json(listDocumentsForClient());
  } catch (error) {
    console.error("Error procesando HTML pegado", error);
    res.status(400).json({ error: error.message || "No se pudo procesar el HTML." });
  }
});

app.get("/api/documents", (req, res) => {
  res.json(listDocumentsForClient());
});

app.post("/api/documents/:id/reprocess", async (req, res) => {
  const { id } = req.params;
  const document = getDocumentById(id);
  if (!document) {
    return res.status(404).json({ error: "Documento no encontrado." });
  }

  if (!document.path) {
    return res
      .status(400)
      .json({ error: "Este documento no tiene archivo para reprocesar." });
  }

  processDocument(document).catch((processError) => {
    console.error("Error reprocesando documento", processError);
  });

  res.json(listDocumentsForClient());
});

app.delete("/api/documents/:id", async (req, res) => {
  const { id } = req.params;
  const removed = removeDocument(id);
  if (!removed) {
    return res.status(404).json({ error: "Documento no encontrado." });
  }

  try {
    if (removed.path) {
      await fs.promises.unlink(removed.path);
    }
  } catch (error) {
    console.error("No se pudo eliminar archivo", error);
  }
  
  // Eliminar del índice de vectores si está habilitado
  if (process.env.USE_VECTOR_INDEX === 'true') {
    try {
      removeDocumentFromIndex(id);
      console.log(`✓ Documento ${id} eliminado del índice de vectores`);
    } catch (indexError) {
      console.error(`Error eliminando documento ${id} del índice:`, indexError);
    }
  }

  res.json(listDocumentsForClient());
});

// API: Cache stats
app.get("/api/cache/stats", (req, res) => {
  res.json(getCacheStats());
});

// API: Learning patterns
app.get("/api/learning/stats", (req, res) => {
  res.json(getLearningStats());
});

app.get("/api/learning/patterns", (req, res) => {
  res.json(getLearningPatterns());
});

app.put("/api/learning/patterns/:id", (req, res) => {
  try {
    const updated = updateLearningPattern(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.delete("/api/learning/patterns/:id", (req, res) => {
  const deleted = deleteLearningPattern(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Patrón no encontrado" });
  }
  res.json({ ok: true });
});

// API: Profile stats
app.get("/api/profiles/stats", (req, res) => {
  const users = listTelegramUsers();
  res.json({
    totalUsers: users.length,
    usersWithNames: users.filter(u => u.name).length,
    activeUsers: users.filter(u => {
      const lastActivity = u.lastSeen || u.firstSeen;
      const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
      return new Date(lastActivity).getTime() > dayAgo;
    }).length,
  });
});

// API: User history
app.get("/api/users/:userId/history", (req, res) => {
  const { userId } = req.params;
  const history = getHistoryByChatId(userId);
  res.json(history);
});

app.post("/api/users/:userId/history/clear", (req, res) => {
  const { userId } = req.params;
  clearHistoryForChatId(userId);
  res.json({ ok: true });
});

// API: User block status
app.post("/api/users/:userId/block", (req, res) => {
  const { blocked } = req.body;
  try {
    const user = listTelegramUsers().find(u => String(u.id) === String(req.params.userId));
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    
    if (blocked) {
      markTelegramUserBlocked(req.params.userId, true);
    }
    
    res.json({
      userId: req.params.userId,
      blocked: blocked || false,
      name: user.name,
      firstSeen: user.firstSeen,
      lastSeen: user.lastSeen,
      messageCount: user.messageCount || 0,
      topics: user.topics || [],
      preferences: user.preferences || {},
      conversationStyle: "casual",
      blocked: blocked || false,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// API: FAQ Cache - Sistema de preguntas frecuentes con caché inteligente
// ============================================================================

// Obtener todas las FAQs
app.get("/api/faqs", (req, res) => {
  try {
    const faqs = getAllFAQs();
    res.json(faqs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener estadísticas del FAQ cache
app.get("/api/faqs/stats", (req, res) => {
  try {
    const stats = getFAQStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener FAQs más populares
app.get("/api/faqs/top", (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topFAQs = getTopFAQs(limit);
    res.json(topFAQs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener FAQs por categoría
app.get("/api/faqs/category/:category", (req, res) => {
  try {
    const { category } = req.params;
    const faqs = getFAQsByCategory(category);
    res.json(faqs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar una FAQ
app.put("/api/faqs/:id", (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updated = updateFAQ(id, updates);
    if (!updated) {
      return res.status(404).json({ error: "FAQ no encontrada" });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar una FAQ
app.delete("/api/faqs/:id", (req, res) => {
  try {
    const { id } = req.params;
    const deleted = deleteFAQ(id);
    if (!deleted) {
      return res.status(404).json({ error: "FAQ no encontrada" });
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Habilitar/deshabilitar una FAQ
app.patch("/api/faqs/:id/toggle", (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const updated = toggleFAQ(id, enabled);
    if (!updated) {
      return res.status(404).json({ error: "FAQ no encontrada" });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener lista de categorías de FAQ
app.get("/api/faq-categories", (req, res) => {
  try {
    const categories = getFAQCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener estadísticas del embedding cache
app.get("/api/embedding-cache/stats", (req, res) => {
  try {
    const stats = getEmbeddingCacheStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Limpiar embeddings antiguos no usados
app.post("/api/embedding-cache/clean", (req, res) => {
  try {
    const { maxAgeDays = 90 } = req.body;
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const result = cleanOldEmbeddings(maxAgeMs);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener estadísticas del índice de vectores
app.get("/api/vector-index/stats", (req, res) => {
  try {
    const stats = getIndexStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reconstruir índice de vectores
app.post("/api/vector-index/rebuild", async (req, res) => {
  try {
    rebuildDocumentIndex();
    res.json({ success: true, message: "Índice reconstruido exitosamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// API: Categories
// ============================================================================

app.get("/api/categories", (req, res) => {
  const categories = getCategories();
  res.json({
    categories,
    total: categories.length,
  });
});

app.delete("/api/categories/:name", (req, res) => {
  const deleted = deleteCategory(req.params.name);
  if (!deleted) {
    return res.status(404).json({ error: "Categoría no encontrada" });
  }
  res.json({ ok: true });
});

// API: Suggested categories
app.get("/api/suggested-categories", (req, res) => {
  const suggested = getSuggestedCategories();
  res.json({
    suggested,
    total: suggested.length,
  });
});

app.get("/api/suggested-categories/pending", (req, res) => {
  const pending = getSuggestedCategoriesPending();
  res.json({
    suggested: pending,
    total: pending.length,
  });
});

app.post("/api/suggested-categories/:id/approve", (req, res) => {
  try {
    const { approverUserId } = req.body;
    const approved = approveSuggestedCategory(req.params.id, approverUserId);
    res.json({
      ok: true,
      category: approved.name,
      message: `Categoría ${approved.name} aprobada`,
    });
  } catch (error) {
    res.status(404).json({
      ok: false,
      error: error.message,
    });
  }
});

app.post("/api/suggested-categories/:id/reject", (req, res) => {
  try {
    rejectSuggestedCategory(req.params.id);
    res.json({
      ok: true,
      message: "Sugerencia rechazada",
    });
  } catch (error) {
    res.status(404).json({
      ok: false,
      message: error.message,
    });
  }
});

app.put("/api/suggested-categories/:id", (req, res) => {
  try {
    const updated = updateSuggestedCategory(req.params.id, req.body);
    res.json({
      ok: true,
      category: updated,
    });
  } catch (error) {
    res.status(404).json({
      ok: false,
      error: error.message,
    });
  }
});

// ====== SURVEYS & QUIZZES ======

// Crear nueva encuesta o quiz
app.post("/api/surveys", (req, res) => {
  try {
    const survey = createSurvey(req.body);
    res.json({
      ok: true,
      survey,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message,
    });
  }
});

// Listar todas las encuestas/quizzes
app.get("/api/surveys", (req, res) => {
  try {
    const filters = {};
    if (req.query.type) filters.type = req.query.type;
    if (req.query.status) filters.status = req.query.status;
    
    const surveys = getAllSurveys(filters);
    res.json({
      ok: true,
      surveys,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// Obtener una encuesta específica
app.get("/api/surveys/:id", (req, res) => {
  try {
    const survey = getSurveyById(req.params.id);
    if (!survey) {
      return res.status(404).json({
        ok: false,
        error: "Encuesta no encontrada",
      });
    }
    res.json({
      ok: true,
      survey,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// Actualizar encuesta
app.put("/api/surveys/:id", (req, res) => {
  try {
    const survey = updateSurvey(req.params.id, req.body);
    if (!survey) {
      return res.status(404).json({
        ok: false,
        error: "Encuesta no encontrada",
      });
    }
    res.json({
      ok: true,
      survey,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message,
    });
  }
});

// Eliminar encuesta
app.delete("/api/surveys/:id", (req, res) => {
  try {
    const deleted = deleteSurvey(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: "Encuesta no encontrada",
      });
    }
    res.json({
      ok: true,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// Enviar encuesta a usuarios
app.post("/api/surveys/:id/send", async (req, res) => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return telegramNotConfigured(res);
  }
  
  try {
    const survey = getSurveyById(req.params.id);
    if (!survey) {
      return res.status(404).json({
        ok: false,
        error: "Encuesta no encontrada",
      });
    }
    
    const telegram = createTelegramService(process.env.TELEGRAM_BOT_TOKEN);
    const { userIds, sendToAll } = req.body;
    
    let targetUsers = [];
    
    if (sendToAll) {
      // Enviar a todos los usuarios
      targetUsers = listTelegramUsers().map(u => u.chatId);
    } else if (userIds && Array.isArray(userIds)) {
      targetUsers = userIds;
    } else {
      return res.status(400).json({
        ok: false,
        error: "Debe especificar userIds o sendToAll",
      });
    }
    
    // Enviar a cada usuario
    const results = {
      sent: 0,
      failed: 0,
      errors: [],
    };
    
    for (const userId of targetUsers) {
      try {
        await sendSurveyToUser(telegram, userId, survey.id);
        results.sent++;
      } catch (error) {
        results.failed++;
        results.errors.push({ userId, error: error.message });
      }
    }
    
    // Actualizar contador de envíos
    markSurveyAsSent(survey.id, targetUsers);
    
    res.json({
      ok: true,
      results,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// Cerrar encuesta
app.post("/api/surveys/:id/close", (req, res) => {
  try {
    const survey = closeSurvey(req.params.id);
    if (!survey) {
      return res.status(404).json({
        ok: false,
        error: "Encuesta no encontrada",
      });
    }
    res.json({
      ok: true,
      survey,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// Obtener respuestas de una encuesta
app.get("/api/surveys/:id/responses", (req, res) => {
  try {
    const filters = {};
    if (req.query.userId) filters.userId = parseInt(req.query.userId);
    
    const responses = getSurveyResponses(req.params.id, filters);
    res.json({
      ok: true,
      responses,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// Obtener estadísticas de una encuesta
app.get("/api/surveys/:id/stats", (req, res) => {
  try {
    const stats = getSurveyStats(req.params.id);
    if (!stats) {
      return res.status(404).json({
        ok: false,
        error: "Encuesta no encontrada",
      });
    }
    res.json({
      ok: true,
      stats,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// Obtener leaderboard de un quiz
app.get("/api/surveys/:id/leaderboard", (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const leaderboard = getQuizLeaderboard(req.params.id, limit);
    res.json({
      ok: true,
      leaderboard,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// Exportar respuestas a CSV
app.get("/api/surveys/:id/export", (req, res) => {
  try {
    const survey = getSurveyById(req.params.id);
    if (!survey) {
      return res.status(404).json({
        ok: false,
        error: "Encuesta no encontrada",
      });
    }
    
    const responses = getSurveyResponses(req.params.id);
    
    // Generar CSV
    let csv = "";
    
    // Headers
    const headers = ["ID Respuesta", "Usuario ID", "Username", "Fecha"];
    if (survey.type === "quiz") {
      headers.push("Puntaje", "Porcentaje", "Aprobado", "Intento", "Tiempo");
    }
    survey.questions.forEach((q, idx) => {
      headers.push(`P${idx + 1}: ${q.question}`);
    });
    csv += headers.join(",") + "\n";
    
    // Rows
    responses.forEach((response) => {
      const row = [
        response.id,
        response.userId,
        response.username || "",
        response.completedAt,
      ];
      
      if (survey.type === "quiz") {
        row.push(
          response.score,
          response.percentage.toFixed(2),
          response.passed ? "Sí" : "No",
          response.attemptNumber,
          response.timeSpent
        );
      }
      
      survey.questions.forEach((q) => {
        const answer = response.answers.find((a) => a.questionId === q.id);
        if (!answer) {
          row.push("");
        } else if (Array.isArray(answer.answer)) {
          row.push(answer.answer.map((idx) => q.options[idx]).join("; "));
        } else if (typeof answer.answer === "number" && q.options) {
          row.push(q.options[answer.answer] || answer.answer);
        } else {
          row.push(String(answer.answer).replace(/,/g, ";"));
        }
      });
      
      csv += row.map((cell) => `"${cell}"`).join(",") + "\n";
    });
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${survey.title.replace(/\s+/g, "_")}_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// SPA fallback — serve admin-ui index.html for non-API routes
app.get('*', (req, res, next) => {
  const wantsJson =
    req.path.startsWith('/api/') || req.path === '/send-broadcast' || req.path === '/webhook' || req.path.startsWith('/uploads/') || req.path.endsWith('.map');
  if (wantsJson) return next();
  
  // Serve admin-ui index.html if it exists (for SPA routing)
  const adminIndexPath = path.join(__dirname, '..', 'admin-ui', 'dist', 'index.html');
  if (fs.existsSync(adminIndexPath)) {
    return res.sendFile(adminIndexPath);
  }
  
  // Fallback: return 404 if admin-ui is not built
  return res.status(404).send('Admin UI not found. Please build admin-ui.');
});

app.use((error, req, res, next) => {
  if (!error) return next();

  const wantsJson =
    req.path.startsWith("/api/") || req.path === "/send-broadcast" || req.path === "/webhook";
  if (!wantsJson) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      const limitLabel = documentUploadMaxBytes
        ? `${DOCUMENT_UPLOAD_MAX_MB} MB`
        : "el límite configurado";
      return res.status(413).json({
        error: `Archivo demasiado grande. Máximo permitido: ${limitLabel}.`,
      });
    }
    return res.status(400).json({
      error: error.message || "Error procesando el archivo.",
    });
  }

  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      error: "Payload demasiado grande.",
    });
  }

  console.error("Unhandled API error", error);
  return res.status(500).json({
    error: "Error interno del servidor.",
  });
});

const port = process.env.PORT || 3000;

async function startServer() {
  await Promise.all([contextReady, documentsReady, memoryReady, usersReady, learningReady, categoriesReady, cacheReady]);
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();
