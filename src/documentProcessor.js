import fs from "fs/promises";
import pdfParse from "pdf-parse";
import { spawn } from "child_process";
import { updateDocument } from "./config/documentStore.js";
import os from "os";
import path from "path";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";
import ExcelJS from "exceljs";
import { load } from "cheerio";
import { chunkText, embedChunks, embedChunkDescriptors } from "./embeddings.js";
import { chunkByStructure, extractHtmlSectionsFromHtml } from "./structuredChunking.js";

const PREVIEW_BYTES = 8192;
const PDF_MIME_TYPES = new Set(["application/pdf"]);
const MAX_EXTRACTED_TEXT = (() => {
  const raw = process.env.DOCUMENT_MAX_EXTRACTED_CHARS;
  const parsed = Number.parseInt(raw || "2000000", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Infinity;
})();
const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const DOC_MIME_TYPES = new Set(["application/msword"]);
const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const CSV_MIME_TYPES = new Set(["text/csv", "application/csv"]);
const TEXT_MIME_TYPES = new Set(["text/plain"]);
const HTML_MIME_TYPES = new Set(["text/html", "application/xhtml+xml"]);

function normalizeText(text) {
  return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
}

function buildSummary(text, document) {
  if (!text) return "";
  const cleaned = normalizeText(text);
  if (cleaned.includes("%PDF-")) {
    return `PDF detectado (${document.originalName}). Agrega un resumen manual breve para que GPT lo utilice.`;
  }

  const trimmed = cleaned
    .replace(/\s+/g, " ")
    .split(". ")
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const excerpt = trimmed.slice(0, 4).join(". ");
  return excerpt.length ? excerpt : cleaned.slice(0, 400).trim();
}

async function readPreview(filePath) {
  const fileHandle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(PREVIEW_BYTES);
    const { bytesRead } = await fileHandle.read(buffer, 0, PREVIEW_BYTES, 0);
    return buffer.toString("utf8", 0, bytesRead);
  } finally {
    await fileHandle.close();
  }
}

function isPdfDocument(document) {
  const mimetype = String(document.mimetype ?? "").toLowerCase();
  const filename = String(document.originalName ?? "").toLowerCase();
  return PDF_MIME_TYPES.has(mimetype) || filename.endsWith(".pdf");
}

function getExtension(document) {
  const filename = String(document.originalName ?? "").toLowerCase();
  return path.extname(filename);
}

function isDocxDocument(document) {
  const mimetype = String(document.mimetype ?? "").toLowerCase();
  const ext = getExtension(document);
  return DOCX_MIME_TYPES.has(mimetype) || ext === ".docx";
}

function isDocDocument(document) {
  const mimetype = String(document.mimetype ?? "").toLowerCase();
  const ext = getExtension(document);
  return DOC_MIME_TYPES.has(mimetype) || ext === ".doc";
}

function isXlsxDocument(document) {
  const mimetype = String(document.mimetype ?? "").toLowerCase();
  const ext = getExtension(document);
  return XLSX_MIME_TYPES.has(mimetype) || ext === ".xlsx";
}

function isCsvDocument(document) {
  const mimetype = String(document.mimetype ?? "").toLowerCase();
  const ext = getExtension(document);
  return CSV_MIME_TYPES.has(mimetype) || ext === ".csv";
}

function isPlainTextDocument(document) {
  const mimetype = String(document.mimetype ?? "").toLowerCase();
  const ext = getExtension(document);
  return TEXT_MIME_TYPES.has(mimetype) || ext === ".txt";
}

function isHtmlDocument(document) {
  const mimetype = String(document.mimetype ?? "").toLowerCase();
  const ext = getExtension(document);
  return HTML_MIME_TYPES.has(mimetype) || ext === ".html" || ext === ".htm";
}

async function extractPdfText(filePath) {
  const buffer = await fs.readFile(filePath);
  const { text } = await pdfParse(buffer);
  return String(text ?? "");
}

async function extractDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return String(result?.value ?? "");
}

async function extractDocText(filePath) {
  const extractor = new WordExtractor();
  const document = await extractor.extract(filePath);
  return String(document?.getBody?.() ?? "");
}

async function extractSpreadsheetText(filePath, document) {
  const workbook = new ExcelJS.Workbook();
  if (isCsvDocument(document)) {
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }

  const lines = [];
  workbook.eachSheet((worksheet) => {
    lines.push(`Hoja: ${worksheet.name}`);
    worksheet.eachRow((row) => {
      const values = row.values
        .slice(1)
        .map((cell) => (cell == null ? "" : String(cell)));
      lines.push(values.join("\t"));
    });
    lines.push("");
  });
  return lines.join("\n");
}

async function extractHtmlText(filePath) {
  const html = await fs.readFile(filePath, "utf8");
  const $ = load(html);
  $("script, style, noscript, iframe, svg, canvas, nav, footer, header, form").remove();
  const title = $("title").text().trim();
  const description = $("meta[name='description']").attr("content")?.trim();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const links = [];
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href")?.trim();
    if (!href) return;
    const text = $(element).text().replace(/\s+/g, " ").trim();
    links.push(`${text || "Enlace"}: ${href}`);
  });
  const uniqueLinks = Array.from(new Set(links)).slice(0, 200);
  const linksBlock = uniqueLinks.length ? `Enlaces:\n${uniqueLinks.join("\n")}` : "";
  const pieces = [
    title ? `Título: ${title}` : "",
    description ? `Descripción: ${description}` : "",
    bodyText,
    linksBlock,
  ].filter(Boolean);
  return pieces.join("\n\n");
}

async function extractPlainText(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    return await readPreview(filePath);
  }
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    let stdout = "";
    let stderr = "";

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`${command} falló con código ${code}: ${stderr.trim()}`));
      }
      resolve({ stdout, stderr });
    });
  });
}

async function renderPdfToImages(pdfPath) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "botelegram-ocr-"));
  const outputPrefix = path.join(tempDir, "page");
  await runCommand("pdftoppm", ["-r", "300", "-png", pdfPath, outputPrefix]);
  const files = await fs.readdir(tempDir);
  const images = files
    .filter((name) => name.endsWith(".png"))
    .sort()
    .map((name) => path.join(tempDir, name));
  return { tempDir, images };
}

async function runTesseract(pdfPath) {
  const langs = (process.env.TESSERACT_LANG || "spa")
    .split(/[\s,]+/)
    .filter(Boolean);
  const candidates = [...new Set([...langs, "eng"])];

  let lastError;
  const runOnTarget = async (targetPath, lang) => {
    const { stdout } = await runCommand("tesseract", [targetPath, "stdout", "-l", lang, "--dpi", "300"]);
    return stdout;
  };

  const tryDirectPdf = async () => {
    for (const lang of candidates) {
      try {
        return await runOnTarget(pdfPath, lang);
      } catch (error) {
        lastError = error;
        if (String(error.message).includes("Failed loading language")) {
          continue;
        }
        if (String(error.message).includes("Pdf reading is not supported")) {
          throw error;
        }
      }
    }
    throw lastError;
  };

  try {
    return await tryDirectPdf();
  } catch (error) {
    if (!String(error.message).includes("Pdf reading is not supported")) {
      throw error;
    }
  }

  let tempDir;
  try {
    const rendered = await renderPdfToImages(pdfPath);
    tempDir = rendered.tempDir;
    if (!rendered.images.length) {
      throw new Error("No se pudieron generar imágenes del PDF");
    }
    let combined = "";
    for (const image of rendered.images) {
      let pageText = "";
      for (const lang of candidates) {
        try {
          pageText = await runOnTarget(image, lang);
          break;
        } catch (error) {
          lastError = error;
          if (String(error.message).includes("Failed loading language")) {
            continue;
          }
        }
      }
      if (pageText) {
        combined += `${pageText}\n`;
      }
    }
    if (!combined.trim()) {
      throw lastError || new Error("OCR sin texto");
    }
    return combined;
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}

export async function processDocument(document) {
  updateDocument(document.id, {
    status: "processing",
    error: null,
  });

  try {
    let sourceText;
    if (isPdfDocument(document)) {
      updateDocument(document.id, { status: "extracting" });
      sourceText = await extractPdfText(document.path);
    } else if (isDocxDocument(document)) {
      updateDocument(document.id, { status: "extracting" });
      sourceText = await extractDocxText(document.path);
    } else if (isDocDocument(document)) {
      updateDocument(document.id, { status: "extracting" });
      sourceText = await extractDocText(document.path);
    } else if (isPlainTextDocument(document)) {
      updateDocument(document.id, { status: "extracting" });
      sourceText = await extractPlainText(document.path);
    } else if (isXlsxDocument(document) || isCsvDocument(document)) {
      updateDocument(document.id, { status: "extracting" });
      sourceText = await extractSpreadsheetText(document.path, document);
    } else if (isHtmlDocument(document)) {
      updateDocument(document.id, { status: "extracting" });
      sourceText = await extractHtmlText(document.path);
    } else {
      sourceText = await readPreview(document.path);
    }
    let usedOcr = false;
    if (isPdfDocument(document) && (!sourceText || sourceText.trim().length < 80)) {
      try {
        const ocrResult = await runTesseract(document.path);
        if (ocrResult && ocrResult.trim()) {
          sourceText = ocrResult;
          usedOcr = true;
        }
      } catch (ocrError) {
        console.error(`OCR Tesseract fallido para ${document.id}:`, ocrError);
      }
    }
    const limitedText = sourceText ? sourceText.slice(0, MAX_EXTRACTED_TEXT) : "";
    const summary =
      buildSummary(limitedText, document) || document.manualSummary || "Sin texto legible";

    let chunks = [];
    if (limitedText) {
      try {
        let descriptors = null;
        if (isHtmlDocument(document) && document.path) {
          try {
            const rawHtml = await fs.readFile(document.path, "utf8");
            const sections = extractHtmlSectionsFromHtml(rawHtml, null);
            descriptors = chunkByStructure({
              extractedText: limitedText,
              mimetype: document.mimetype,
              originalName: document.originalName,
              sourceUrl: document.sourceUrl,
              htmlSections: sections,
            });
          } catch (sectionError) {
            descriptors = null;
          }
        } else {
          descriptors = chunkByStructure({
            extractedText: limitedText,
            mimetype: document.mimetype,
            originalName: document.originalName,
            sourceUrl: document.sourceUrl,
          });
        }

        if (Array.isArray(descriptors) && descriptors.length) {
          chunks = await embedChunkDescriptors(descriptors);
        } else {
          chunks = await embedChunks(chunkText(limitedText));
        }
      } catch (embedError) {
        console.error(`Embeddings fallidos para ${document.id}:`, embedError);
      }
    }

    updateDocument(document.id, {
      autoSummary: summary,
      extractedText: limitedText,
      chunks,
      usedOcr,
      status: "ready",
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    updateDocument(document.id, {
      status: "error",
      error: error?.message || "Error desconocido",
    });
    console.error(`Procesamiento de documento ${document.id} fallido:`, error);
  }
}