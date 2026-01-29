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
  updatePromptTemplate,
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
import { getHistory, clearHistory } from "./config/historyStore.js";
import { chunkText, embedChunks } from "./embeddings.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsPath = path.join(__dirname, "..", "uploads");
const upload = multer({ dest: uploadsPath });

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

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

function extractTextFromHtml(html) {
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

  const pieces = [
    title ? `Título: ${title}` : "",
    description ? `Descripción: ${description}` : "",
    teacherBlock,
    filtered,
  ].filter(Boolean);
  return pieces.join("\n\n");
}

async function indexDocumentEmbeddings(document, text) {
  if (!text) {
    return;
  }
  try {
    const chunks = await embedChunks(chunkText(text));
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
      const text = extractTextFromHtml(html);
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
  if (!TELEGRAM_API) {
    return telegramNotConfigured(res);
  }

  const update = req.body;
  const message = update.message ?? update.edited_message;
  const text = message?.text?.trim();

  if (!message || !message.chat?.id || !text) {
    return res.sendStatus(200);
  }

  try {
    const payload = {
      incomingText: text,
      chatId: String(message.chat.id),
      context: getContextState(),
      documents: listDocuments(),
    };

    const reply = await composeResponse(payload);
    await sendTelegramMessage(message.chat.id, reply ?? "Got it!" );
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

app.post("/api/config/context", (req, res) => {
  const { activePrompt, additionalNotes, promptTemplate } = req.body;

  if (typeof activePrompt === "string") {
    updatePrompt(activePrompt);
  }
  if (typeof additionalNotes === "string") {
    updateAdditionalNotes(additionalNotes);
  }
  if (typeof promptTemplate === "string") {
    updatePromptTemplate(promptTemplate);
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

    res.json(listDocuments());
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
      const extractedText = extractTextFromHtml(html);
      if (!extractedText) {
        return res.status(400).json({ error: "No se pudo extraer texto de la página." });
      }

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

      await indexDocumentEmbeddings(document, extractedText);

      return res.json(listDocuments());
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

    await indexDocumentEmbeddings(document, trimmedText);

    res.json(listDocuments());
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
    const extractedText = extractTextFromHtml(html);
    if (!extractedText) {
      return res.status(400).json({ error: "No se pudo extraer texto del HTML." });
    }

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

    await indexDocumentEmbeddings(document, extractedText);

    res.json(listDocuments());
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
