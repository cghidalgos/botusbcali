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
  addDocument,
  removeDocument,
  updateDocument,
  documentsReady,
} from "./config/documentStore.js";
import { memoryReady } from "./config/memoryStore.js";

import { composeResponse } from "./openai.js";
import { processDocument } from "./documentProcessor.js";
import {
  addHistoryEntry,
  getHistory,
  clearHistory,
  getHistoryByChatId,
  clearHistoryForChatId,
} from "./config/historyStore.js";
import { chunkText, embedChunks } from "./embeddings.js";
import { detectStructuredIntent } from "./intelligentRouter.js";
import { handleStructuredQuery } from "./structuredService.js";
import { initializeEmbeddingsClassifier } from "./embeddingsClassifier.js";
import {
  loadLearnedPatterns,
  recordQuestion,
  getLearningStats,
  listLearnedPatterns,
  updateLearnedPattern,
  deleteLearnedPattern,
} from "./learningSystem.js";
import { loadGPTCache, getCacheStats, clearAllCache, cleanOldCache } from "./gptCache.js";
import { 
  loadUserProfiles, 
  getUserProfile,
  listUserProfiles,
  isUserBlocked,
  setUserBlocked,
  detectAndUpdateName, 
  isGreeting,
  generateGreeting,
  recordUserTopic,
  updateConversationStyle,
  getProfileStats 
} from "./userProfileStore.js";
import { 
  generateGreetingResponse,
  analyzeSentiment 
} from "./conversationContext.js";
import { initializeData } from "./dataExtractor.js";
import { 
  loadCategories, 
  getEnabledCategories,
  getCategoryConfig,
  getCategoriesInfo,
  addCategory,
  updateCategory,
  removeCategory 
} from "./categoryManager.js";
import {
  initSuggestedCategories,
  addSuggestedCategory,
  getAllSuggested,
  getPendingSuggested,
  approveSuggested,
  rejectSuggested,
  updateSuggested,
  deleteSuggested
} from "./autoCategoryGenerator.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsPath = path.join(__dirname, "..", "uploads");
try {
  fs.mkdirSync(uploadsPath, { recursive: true });
} catch (error) {
  console.error("No se pudo crear el directorio uploads", error);
}
const upload = multer({ dest: uploadsPath });

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

const adminUiPath = path.join(__dirname, "..", "public", "admin");
if (fs.existsSync(adminUiPath)) {
  app.use("/admin", express.static(adminUiPath));
  app.get("/admin/*", (req, res) => {
    res.sendFile(path.join(adminUiPath, "index.html"));
  });
}

const uiIndexPath = path.join(__dirname, "..", "public", "index.html");
if (fs.existsSync(uiIndexPath)) {
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(uiIndexPath);
  });
}

const adminDistPath = path.join(__dirname, "..", "admin-ui", "dist");
if (fs.existsSync(adminDistPath)) {
  app.use("/admin", express.static(adminDistPath));
  app.get("/admin/*", (req, res) => {
    res.sendFile(path.join(adminDistPath, "index.html"));
  });
}

// Inicializar clasificador ML (para estrategia hybrid o embeddings)
const strategy = process.env.CLASSIFIER_STRATEGY || "hybrid";

// Cargar configuración de categorías
loadCategories()
  .then(() => console.log("[CATEGORIES] Sistema de categorías inicializado"))
  .catch((err) => console.error("[CATEGORIES] Error:", err.message));

// Inicializar sistema de categorías sugeridas
initSuggestedCategories();
console.log("[AUTO-CATEGORIES] Sistema de categorías automáticas inicializado");

if (strategy === "embeddings" || strategy === "hybrid") {
  console.log(`[ML] Inicializando clasificador para estrategia: ${strategy}`);
  initializeEmbeddingsClassifier()
    .then(() => console.log("[ML] ✓ Clasificador inicializado correctamente"))
    .catch((err) => console.error("[ML] ✗ Error inicializando clasificador:", err.message));
}

// Inicializar sistema de aprendizaje automático
loadLearnedPatterns()
  .then(() => console.log("[LEARNING] Sistema de aprendizaje inicializado"))
  .catch((err) => console.error("[LEARNING] Error:", err.message));
// Inicializar Cache GPT
loadGPTCache()
  .then(() => console.log("[CACHE] Cache GPT inicializado"))
  .catch((err) => console.error("[CACHE] Error inicializando:", err.message));

// Inicializar Perfiles de Usuario
loadUserProfiles()
  .then(() => console.log("[PROFILES] Perfiles de usuario inicializados"))
  .catch((err) => console.error("[PROFILES] Error inicializando:", err.message));

// Inicializar Extractor de Datos
initializeData()
  .then(() => console.log("[DATA] Extractor de datos inicializado"))
  .catch((err) => console.error("[DATA] Error inicializando:", err.message));

// API: historial de preguntas y respuestas
app.get("/api/history", (req, res) => {
  res.json(getHistory());
});

app.post("/api/history/clear", (req, res) => {
  clearHistory();
  res.json({ ok: true });
});

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = TELEGRAM_TOKEN
  ? `https://api.telegram.org/bot${TELEGRAM_TOKEN}`
  : null;

const EXT_BY_MIME = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/csv": ".csv",
  "application/csv": ".csv",
  "text/plain": ".csv",
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

function extractTextFromHtml(html, baseUrl = null) {
  const $ = load(html);
  $("script, style, noscript, iframe, svg, canvas, nav, footer, header, form").remove();

  const title = $("title").text().trim();
  const description = $("meta[name='description']").attr("content")?.trim();

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

  if (!/docente|profesor|teacher|cuerpo docente/i.test(bodyText)) {
    bodyText = base.text().replace(/\s+/g, " ").trim();
  }

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
  const filtered = bodyText
    .split(/\s+/)
    .filter((token) => {
      const normalized = token.toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, "");
      return normalized && !stopwords.has(normalized);
    })
    .join(" ");

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

async function indexDocumentEmbeddings(document, text, onProgress) {
  if (!text) {
    return;
  }
  try {
    const chunks = await embedChunks(chunkText(text), onProgress);
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

async function crawlWebsite({ startUrl, maxDepth, maxPages, onProgress }) {
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

    if (onProgress) {
      onProgress(visited.size, maxPages);
    }
  }

  return results;
}

function clampProgress(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

async function processWebDocument({ document, normalizedUrl, depthLimit, pagesLimit, summary }) {
  try {
    updateDocument(document.id, {
      status: "extracting",
      progress: 10,
      stage: "Extrayendo web",
      error: null,
    });

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
        throw new Error("La URL no parece ser una página HTML.");
      }

      updateDocument(document.id, { progress: 30, stage: "Extrayendo texto" });
      const html = String(response.data ?? "");
      const extractedText = extractTextFromHtml(html, normalizedUrl.toString());
      if (!extractedText) {
        throw new Error("No se pudo extraer texto de la página.");
      }

      const autoSummary = extractedText.slice(0, 400);
      updateDocument(document.id, {
        autoSummary: autoSummary || summary || "Sin texto legible",
        extractedText,
        usedOcr: false,
        status: "processing",
        progress: 55,
        stage: "Indexando embeddings",
      });

      await indexDocumentEmbeddings(document, extractedText, (current, total) => {
        const pct = total > 0 ? 55 + (current / total) * 40 : 90;
        updateDocument(document.id, { progress: clampProgress(pct) });
      });

      updateDocument(document.id, {
        status: "ready",
        progress: 100,
        stage: "Listo",
        processedAt: new Date().toISOString(),
        error: null,
      });

      return;
    }

    const pages = await crawlWebsite({
      startUrl: normalizedUrl.toString(),
      maxDepth: Math.min(depthLimit, 3),
      maxPages: Math.min(pagesLimit, 50),
      onProgress: (current, total) => {
        const pct = total > 0 ? 10 + (current / total) * 40 : 40;
        updateDocument(document.id, { progress: clampProgress(pct), stage: "Extrayendo web" });
      },
    });

    if (!pages.length) {
      throw new Error("No se pudo extraer texto de la página.");
    }

    const combinedText = pages
      .map((page) => `Página: ${page.url}\n${page.text}`)
      .join("\n\n");

    const trimmedText = combinedText.slice(0, 200000);
    const autoSummary = trimmedText.slice(0, 400);

    updateDocument(document.id, {
      autoSummary: autoSummary || summary || "Sin texto legible",
      extractedText: trimmedText,
      usedOcr: false,
      status: "processing",
      progress: 60,
      stage: "Indexando embeddings",
    });

    await indexDocumentEmbeddings(document, trimmedText, (current, total) => {
      const pct = total > 0 ? 60 + (current / total) * 35 : 90;
      updateDocument(document.id, { progress: clampProgress(pct) });
    });

    updateDocument(document.id, {
      status: "ready",
      progress: 100,
      stage: "Listo",
      processedAt: new Date().toISOString(),
      error: null,
    });
  } catch (error) {
    updateDocument(document.id, {
      status: "error",
      progress: 100,
      stage: "Error",
      error: error?.message || "No se pudo extraer la página.",
    });
    console.error("Error extrayendo página web", error);
  }
}

async function processHtmlDocument({ document, html, summary }) {
  try {
    updateDocument(document.id, {
      status: "extracting",
      progress: 20,
      stage: "Extrayendo HTML",
      error: null,
    });

    const extractedText = extractTextFromHtml(html, null);
    if (!extractedText) {
      throw new Error("No se pudo extraer texto del HTML.");
    }

    const autoSummary = extractedText.slice(0, 400);
    updateDocument(document.id, {
      autoSummary: autoSummary || summary || "Sin texto legible",
      extractedText,
      usedOcr: false,
      status: "processing",
      progress: 60,
      stage: "Indexando embeddings",
    });

    await indexDocumentEmbeddings(document, extractedText, (current, total) => {
      const pct = total > 0 ? 60 + (current / total) * 35 : 90;
      updateDocument(document.id, { progress: clampProgress(pct) });
    });

    updateDocument(document.id, {
      status: "ready",
      progress: 100,
      stage: "Listo",
      processedAt: new Date().toISOString(),
      error: null,
    });
  } catch (error) {
    updateDocument(document.id, {
      status: "error",
      progress: 100,
      stage: "Error",
      error: error?.message || "No se pudo procesar el HTML.",
    });
    console.error("Error procesando HTML pegado", error);
  }
}

app.post("/webhook", async (req, res) => {
  if (!TELEGRAM_API) {
    return telegramNotConfigured(res);
  }

  const update = req.body;
  const message = update.message ?? update.edited_message;
  const text = message?.text?.trim();
  const userId = message?.chat?.id;

  if (!message || !userId || !text) {
    return res.sendStatus(200);
  }

  try {
    console.log(`\n[WEBHOOK] Mensaje de usuario ${userId}: "${text.substring(0, 60)}..."`);
    
    // 0. ACTUALIZAR PERFIL DE USUARIO
    const userProfile = getUserProfile(userId);
    
    // SEGURIDAD: Verificar si el usuario está bloqueado
    if (isUserBlocked(userId)) {
      console.log(`[BLOCKED] Usuario ${userId} bloqueado. Ignorando mensaje.`);
      return res.sendStatus(200);
    }
    
    updateConversationStyle(userId, text);
    
    // Detectar si el usuario se presenta
    const nameDetected = detectAndUpdateName(userId, text);
    if (nameDetected) {
      console.log(`[PROFILES] 👋 Usuario se presentó como "${userProfile.name}"`);
    }
    
    // 1. DETECTAR SALUDOS (se responden via GPT con el contexto configurado)
    if (isGreeting(text) && text.length < 30) {
      console.log("[GREETING] Saludo detectado, se responde via GPT");
    }
    
    // 2. ROUTER: Detectar si es consulta estructurada (ML Hybrid)
    const intent = await detectStructuredIntent(text);
    let reply = null;
    let routeUsed = "GPT";

    if (intent) {
      // Registrar tema de interés
      if (intent.type && intent.type !== "UNKNOWN") {
        recordUserTopic(userId, intent.type);
      }
      
      // 3. STRUCTURED: Intentar responder con datos locales
      console.log(`[ROUTER] Intent detectado: ${intent.type}`);
      reply = handleStructuredQuery(text, intent);
      
      if (reply) {
        routeUsed = "STRUCTURED";
        console.log(`[✓ STRUCTURED] Respondiendo desde datos locales (${intent.type})`);
      } else {
        console.log(`[→ FALLBACK] No se encontró respuesta estructurada, pasando a GPT`);
      }
    } else {
      // Si no hay intent detectado, sugerir una nueva categoría
      console.log(`[AUTO-CATEGORIES] Pregunta sin clasificación, sugiriendo nueva categoría`);
      const suggestedCatId = addSuggestedCategory(text, String(userId));
      if (suggestedCatId) {
        console.log(`[AUTO-CATEGORIES] ✓ Categoría sugerida: ${suggestedCatId}`);
      }
    }

    // 4. GPT: Si no hay respuesta estructurada, usar flujo original
    if (!reply) {
      console.log(`[GPT] Procesando con OpenAI`);
      const payload = {
        incomingText: text,
        chatId: String(message.chat.id),
        context: getContextState(),
        documents: listDocuments(),
      };
      reply = await composeResponse(payload);
    }

    // 5. Enviar respuesta
    console.log(`[${routeUsed}] Enviando respuesta`);
    await sendTelegramMessage(message.chat.id, reply ?? "Got it!" );
    
    // 6. Registrar en historial (si es respuesta con contenido)
    if (reply) {
      addHistoryEntry({
        question: text,
        answer: reply,
        context: getContextState(),
        usedDocuments: routeUsed === "STRUCTURED" ? [] : listDocuments().map(d => d.originalName),
        chatId: String(message.chat.id),
      });
    }
    
    // 7. Aprendizaje: registrar pregunta y respuesta (async, no bloqueante)
    if (intent && intent.type && routeUsed === "STRUCTURED") {
      recordQuestion(text, intent.type, reply).catch(() => {});
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error", error);
    await sendTelegramMessage(
      message.chat.id,
      "Lo siento, hubo un problema al generar la respuesta."
    );
    res.sendStatus(200);
  }
});

app.get("/api/config", (req, res) => {
  res.json({
    context: getContextState(),
    documents: listDocuments(),
  });
});

app.get("/api/learning/stats", (req, res) => {
  res.json(getLearningStats());
});

app.get("/api/learning/patterns", (req, res) => {
  res.json(listLearnedPatterns());
});

app.patch("/api/learning/patterns/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await updateLearnedPattern(id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: "Patron no encontrado." });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/learning/patterns/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await deleteLearnedPattern(id);
    if (!deleted) {
      return res.status(404).json({ error: "Patron no encontrado." });
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para estadísticas del cache GPT
app.get("/api/cache/stats", (req, res) => {
  try {
    const stats = getCacheStats();
    res.json(stats);
  } catch (error) {
    console.error("Error obteniendo stats del cache:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para limpiar cache antiguo
app.post("/api/cache/clean", async (req, res) => {
  try {
    const days = parseInt(req.query.days || "30", 10);
    const cleaned = await cleanOldCache(days);
    res.json({ cleaned, message: `${cleaned} entradas limpiadas` });
  } catch (error) {
    console.error("Error limpiando cache:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para limpiar todo el cache
app.post("/api/cache/clear", async (req, res) => {
  try {
    const cleared = await clearAllCache();
    res.json({ cleared, message: "Cache limpiado completamente" });
  } catch (error) {
    console.error("Error limpiando cache:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para estadisticas de perfiles de usuario
app.get("/api/profiles/stats", (req, res) => {
  try {
    const stats = getProfileStats();
    res.json(stats);
  } catch (error) {
    console.error("Error obteniendo stats de perfiles:", error);
    res.status(500).json({ error: error.message });
  }
});

// USUARIOS: listar todos los usuarios
app.get("/api/users", (req, res) => {
  try {
    res.json(listUserProfiles());
  } catch (error) {
    console.error("Error listando usuarios:", error);
    res.status(500).json({ error: error.message });
  }
});

// USUARIOS: obtener historial de un usuario específico
app.get("/api/users/:id/history", (req, res) => {
  try {
    res.json(getHistoryByChatId(req.params.id));
  } catch (error) {
    console.error("Error obteniendo historial por usuario:", error);
    res.status(500).json({ error: error.message });
  }
});

// USUARIOS: limpiar historial de un usuario específico
app.post("/api/users/:id/history/clear", (req, res) => {
  try {
    clearHistoryForChatId(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error("Error limpiando historial por usuario:", error);
    res.status(500).json({ error: error.message });
  }
});

// USUARIOS: bloquear/desbloquear un usuario
app.post("/api/users/:id/block", (req, res) => {
  try {
    const blocked = Boolean(req.body?.blocked);
    const updated = setUserBlocked(req.params.id, blocked);
    res.json(updated);
  } catch (error) {
    console.error("Error bloqueando usuario:", error);
    res.status(500).json({ error: error.message });
  }
});

// USUARIOS: enviar mensaje directo a un usuario vía Telegram
app.post("/api/users/:id/message", async (req, res) => {
  if (!TELEGRAM_API) {
    return telegramNotConfigured(res);
  }
  const text = String(req.body?.text || "").trim();
  if (!text) {
    return res.status(400).json({ error: "Mensaje vacio." });
  }
  try {
    await sendTelegramMessage(req.params.id, text);
    res.json({ ok: true });
  } catch (error) {
    console.error("Error enviando mensaje a usuario:", error);
    res.status(500).json({ error: error.message });
  }
});

// CATEGORÍAS: endpoints dinámicos para gestionar categorías
app.get("/api/categories", (req, res) => {
  try {
    res.json(getCategoriesInfo());
  } catch (error) {
    console.error("Error obteniendo categorías:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/categories", async (req, res) => {
  try {
    const { name, config } = req.body;
    if (!name || !config) {
      return res.status(400).json({ error: "Nombre y configuración requeridos" });
    }
    const success = await addCategory(name, config);
    if (success) {
      res.json({ ok: true, category: name });
    } else {
      res.status(500).json({ error: "No se pudo crear la categoría" });
    }
  } catch (error) {
    console.error("Error creando categoría:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/categories/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const config = getCategoryConfig(name);
    if (!config) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }
    const success = await updateCategory(name, req.body);
    if (success) {
      res.json({ ok: true, category: name });
    } else {
      res.status(500).json({ error: "No se pudo actualizar la categoría" });
    }
  } catch (error) {
    console.error("Error actualizando categoría:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/categories/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const config = getCategoryConfig(name);
    if (!config) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }
    const success = await removeCategory(name);
    if (success) {
      res.json({ ok: true });
    } else {
      res.status(500).json({ error: "No se pudo eliminar la categoría" });
    }
  } catch (error) {
    console.error("Error eliminando categoría:", error);
    res.status(500).json({ error: error.message });
  }
});

//---------- AUTO-GENERATED CATEGORIES ENDPOINTS ----------

// GET all suggested categories
app.get("/api/suggested-categories", (req, res) => {
  try {
    const suggested = getAllSuggested();
    res.json({ suggested });
  } catch (error) {
    console.error("Error obteniendo categorías sugeridas:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET pending suggested categories
app.get("/api/suggested-categories/pending", (req, res) => {
  try {
    const pending = getPendingSuggested();
    res.json({ pending });
  } catch (error) {
    console.error("Error obteniendo categorías pendientes:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Approve a suggested category (convert to real category)
app.post("/api/suggested-categories/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { approverUserId } = req.body || {};
    
    const approved = approveSuggested(id, approverUserId || "admin");
    if (!approved) {
      return res.status(404).json({ error: "Categoría sugerida no encontrada" });
    }
    
    // Convert to real category in categories.json
    const newCat = {
      name: approved.name,
      displayName: approved.displayName,
      keywords: approved.keywords || [],
      patterns: approved.keywords?.map(k => `/${k}/gi`) || [],
      listPatterns: [approved.pattern || "lista"],
      schema: approved.schema || { name: "string", description: "string" },
      enabled: true
    };
    
    const success = await addCategory(approved.name, newCat);
    if (success) {
      res.json({ ok: true, category: approved.name, message: "Categoría aprobada y activada" });
    } else {
      res.status(500).json({ error: "Categoría aprobada pero no se pudo agregar al sistema" });
    }
  } catch (error) {
    console.error("Error aprobando categoría:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Reject a suggested category
app.post("/api/suggested-categories/:id/reject", (req, res) => {
  try {
    const { id } = req.params;
    const rejected = rejectSuggested(id);
    if (!rejected) {
      return res.status(404).json({ error: "Categoría sugerida no encontrada" });
    }
    res.json({ ok: true, message: "Categoría rechazada" });
  } catch (error) {
    console.error("Error rechazando categoría:", error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH - Update a suggested category
app.patch("/api/suggested-categories/:id", (req, res) => {
  try {
    const { id } = req.params;
    const updated = updateSuggested(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Categoría sugerida no encontrada" });
    }
    res.json({ ok: true, category: updated });
  } catch (error) {
    console.error("Error actualizando categoría sugerida:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete a suggested category
app.delete("/api/suggested-categories/:id", (req, res) => {
  try {
    const { id } = req.params;
    const success = deleteSuggested(id);
    if (success) {
      res.json({ ok: true });
    } else {
      res.status(404).json({ error: "Categoría sugerida no encontrada" });
    }
  } catch (error) {
    console.error("Error eliminando categoría sugerida:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/config/context", (req, res) => {
  const { activePrompt, additionalNotes } = req.body;

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
    if (!req.file) {
      return res.status(400).json({ error: "No document uploaded." });
    }

    // Validar tamaño (máximo 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (req.file.size > MAX_FILE_SIZE) {
      // Eliminar archivo
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(413).json({
        error: `Archivo demasiado grande. Máximo permitido: 10MB. Tamaño: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`,
      });
    }

    // Advertencia si se acerca al límite
    const WARNING_THRESHOLD = 8 * 1024 * 1024; // 8MB
    let warning = null;
    if (req.file.size > WARNING_THRESHOLD) {
      warning = `Archivo grande (${(req.file.size / 1024 / 1024).toFixed(2)}MB). El procesamiento puede ser lento.`;
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

    const response = listDocuments();
    if (warning) {
      response.warning = warning;
    }
    res.json(response);
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
    const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".xlsx", ".csv"]);
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
      throw new Error("El recurso no es un PDF, Word, Excel o CSV válido.");
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

    res.json(listDocuments());
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
    const originalName = normalizedUrl.hostname + normalizedUrl.pathname;
    const document = addDocument({
      filename: `web-${crypto.randomUUID()}.html`,
      originalName,
      path: null,
      size: 0,
      mimetype: "text/html",
      summary: typeof summary === "string" ? summary : "",
      sourceUrl: normalizedUrl.toString(),
    });

    updateDocument(document.id, {
      status: "processing",
      progress: 5,
      stage: "Preparando web",
      error: null,
    });

    res.json(listDocuments());

    processWebDocument({
      document,
      normalizedUrl,
      depthLimit,
      pagesLimit,
      summary: typeof summary === "string" ? summary : "",
    }).catch(() => {});
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

    updateDocument(document.id, {
      status: "processing",
      progress: 10,
      stage: "Preparando HTML",
      error: null,
    });

    res.json(listDocuments());

    processHtmlDocument({
      document,
      html,
      summary: typeof summary === "string" ? summary : "",
    }).catch(() => {});
  } catch (error) {
    console.error("Error procesando HTML pegado", error);
    res.status(400).json({ error: error.message || "No se pudo procesar el HTML." });
  }
});

app.get("/api/documents", (req, res) => {
  res.json(listDocuments());
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

  res.json(listDocuments());
});

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTelegramHtml(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/^#{1,6}\s*(.+)$/gm, "<b>$1</b>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/__(.+?)__/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

async function sendTelegramMessage(chatId, text) {
  if (!TELEGRAM_API) {
    throw new Error("Telegram API not configured");
  }

  const MAX_LENGTH = 3800;
  const raw = String(text ?? "");
  const parts = [];
  let remaining = raw;
  while (remaining.length) {
    let chunk = remaining.slice(0, MAX_LENGTH);
    const lastBreak = chunk.lastIndexOf("\n");
    if (lastBreak > 500) {
      chunk = chunk.slice(0, lastBreak);
    }
    parts.push(chunk);
    remaining = remaining.slice(chunk.length).trimStart();
  }

  for (const part of parts) {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: formatTelegramHtml(part),
      parse_mode: "HTML",
    });
  }
}

const port = process.env.PORT || 3000;

async function startServer() {
  await Promise.all([contextReady, documentsReady, memoryReady]);
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();
