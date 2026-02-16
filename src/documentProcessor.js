import fs from "fs/promises";
import pdfParse from "pdf-parse";
import { spawn } from "child_process";
import { updateDocument } from "./config/documentStore.js";
import { storeSearchIndex } from "./config/searchIndexStore.js";
import os from "os";
import path from "path";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";
import ExcelJS from "exceljs";
import { load } from "cheerio";
import {
  createIntelligentChunks,
  createChunkedIndex,
} from "./chunkedSearchEngine.js";
import { extractAndUpdateDataFromDocument } from "./dataExtractor.js";

const PREVIEW_BYTES = 8192;
const PDF_MIME_TYPES = new Set(["application/pdf"]);
const MAX_EXTRACTED_TEXT = Infinity;
const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const DOC_MIME_TYPES = new Set(["application/msword"]);
const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const CSV_MIME_TYPES = new Set(["text/csv", "application/csv", "text/plain"]);
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

function isHtmlDocument(document) {
  const mimetype = String(document.mimetype ?? "").toLowerCase();
  const ext = getExtension(document);
  return HTML_MIME_TYPES.has(mimetype) || ext === ".html" || ext === ".htm";
}

async function extractPdfText(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const parsed = await pdfParse(buffer);
    const text = String(parsed.text ?? "").trim();
    
    if (!text) {
      console.warn(`[PDF] No se extrajo texto con pdfParse de ${filePath}, intentando información de metadatos`);
      // Intentar extraer información de metadatos
      if (parsed.metadata?.Title) {
        return parsed.metadata.Title + "\n" + (parsed.metadata.Subject || "");
      }
      if (parsed.metadata?.Subject) {
        return parsed.metadata.Subject;
      }
    }
    
    console.log(`[PDF] ✓ Extraídos ${text.length} caracteres de ${filePath}`);
    return text;
  } catch (error) {
    console.error(`[PDF] Error extrayendo texto: ${error.message}`);
    return "";
  }
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

async function extractSpreadsheetText(filePath, document, onProgress) {
  const workbook = new ExcelJS.Workbook();
  if (isCsvDocument(document)) {
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }

  const lines = [];
  const totalRows = workbook.worksheets.reduce(
    (sum, worksheet) => sum + (worksheet.rowCount || 0),
    0
  );
  let processedRows = 0;
  workbook.eachSheet((worksheet) => {
    lines.push(`Hoja: ${worksheet.name}`);
    worksheet.eachRow((row) => {
      const values = row.values
        .slice(1)
        .map((cell) => (cell == null ? "" : String(cell)));
      lines.push(values.join("\t"));
      processedRows += 1;
      if (onProgress && totalRows > 0 && (processedRows % 25 === 0 || processedRows === totalRows)) {
        onProgress(processedRows, totalRows);
      }
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

async function runTesseract(pdfPath, onProgress) {
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
        const result = await runOnTarget(pdfPath, lang);
        if (onProgress) onProgress(1, 1);
        return result;
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
    for (let index = 0; index < rendered.images.length; index += 1) {
      const image = rendered.images[index];
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
      if (onProgress) {
        onProgress(index + 1, rendered.images.length);
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
  const clampProgress = (value) => Math.min(100, Math.max(0, Math.round(value)));

  updateDocument(document.id, {
    status: "processing",
    progress: 5,
    stage: "Preparando",
    error: null,
  });

  try {
    let sourceText;
    if (isPdfDocument(document)) {
      updateDocument(document.id, { status: "extracting", progress: 20, stage: "Extrayendo PDF" });
      sourceText = await extractPdfText(document.path);
      console.log(`[PDF] sourceText length después de extractPdfText: ${sourceText.length}`);
    } else if (isDocxDocument(document)) {
      updateDocument(document.id, { status: "extracting", progress: 20, stage: "Extrayendo Word" });
      sourceText = await extractDocxText(document.path);
    } else if (isDocDocument(document)) {
      updateDocument(document.id, { status: "extracting", progress: 20, stage: "Extrayendo Word" });
      sourceText = await extractDocText(document.path);
    } else if (isXlsxDocument(document) || isCsvDocument(document)) {
      updateDocument(document.id, { status: "extracting", progress: 20, stage: "Extrayendo hoja" });
      sourceText = await extractSpreadsheetText(document.path, document, (current, total) => {
        const pct = total > 0 ? 20 + (current / total) * 25 : 30;
        updateDocument(document.id, { progress: clampProgress(pct) });
      });
    } else if (isHtmlDocument(document)) {
      updateDocument(document.id, { status: "extracting", progress: 20, stage: "Extrayendo HTML" });
      sourceText = await extractHtmlText(document.path);
    } else {
      sourceText = await readPreview(document.path);
    }

    updateDocument(document.id, { progress: 45, stage: "Procesando texto" });
    let usedOcr = false;
    if (isPdfDocument(document) && (!sourceText || sourceText.trim().length < 80)) {
      console.log(`[OCR] PDF sin texto suficiente (${sourceText?.length || 0} chars), intentando OCR...`);
      try {
        updateDocument(document.id, { progress: 60 });
        updateDocument(document.id, { stage: "OCR con Tesseract" });
        const ocrResult = await runTesseract(document.path, (current, total) => {
          const pct = total > 0 ? 60 + (current / total) * 12 : 65;
          updateDocument(document.id, { progress: clampProgress(pct) });
        });
        if (ocrResult && ocrResult.trim()) {
          console.log(`[OCR] ✓ OCR extrajo ${ocrResult.length} caracteres`);
          sourceText = ocrResult;
          usedOcr = true;
        } else {
          console.warn(`[OCR] OCR ejecutado pero retornó texto vacío`);
        }
        updateDocument(document.id, { progress: 70 });
      } catch (ocrError) {
        console.warn(`[OCR] Tesseract no disponible (${ocrError.message}). PDF será indexado sin OCR.`);
        // No bloqueamos el procesamiento si OCR falla
      }
    } else if (sourceText && sourceText.trim().length >= 80) {
      console.log(`[PDF] ✓ Texto suficiente extraído sin OCR (${sourceText.length} chars)`);
    }
    const limitedText = sourceText ? sourceText.slice(0, MAX_EXTRACTED_TEXT) : "";
    console.log(`[DOCUMENT] limitedText final: ${limitedText.length} caracteres para ${document.originalName}`);
    const summary =
      buildSummary(limitedText, document) || document.manualSummary || "Sin texto legible";

    // Extraer datos estructurados automáticamente (profesores, horarios, etc.)
    if (limitedText) {
      try {
        updateDocument(document.id, { progress: 75, stage: "Extrayendo datos" });
        const extractionResult = await extractAndUpdateDataFromDocument(limitedText, document.originalName);
        if (extractionResult) {
          const total = Object.values(extractionResult).reduce((a, b) => a + b, 0);
          console.log(`[EXTRACTOR] ${total} registros extraídos y guardados automáticamente`);
        }
      } catch (extractError) {
        console.error(`Extracción de datos fallida para ${document.id}:`, extractError.message);
        // No bloqueamos el procesamiento si falla la extracción
      }
    }

    let chunks = [];
    let searchIndex = null;
    if (limitedText) {
      try {
        updateDocument(document.id, { progress: 80, stage: "Indexando (Chunking inteligente)" });
        // Crear chunks inteligentes detectando estructura
        const intelligentChunks = createIntelligentChunks(
          limitedText,
          document.originalName
        );
        console.log(`[CHUNKING] Chunks inteligentes creados: ${intelligentChunks.length}`);
        
        // Crear índice BM25 por chunks
        searchIndex = createChunkedIndex(
          intelligentChunks,
          document.id,
          document.originalName
        );
        // Para la UI: convertir chunks a formato simple
        chunks = intelligentChunks.slice(0, 50).map((c) => ({
          text: c.text.slice(0, 300),
          type: c.type,
          section: c.section,
          embedding: null,
        }));
        console.log(
          `[CHUNKING] ${searchIndex.totalChunks} chunks creados para ${document.originalName}`
        );
        updateDocument(document.id, { progress: 98, stage: "Finalizando" });
      } catch (indexError) {
        console.error(`Indexación fallida para ${document.id}:`, indexError);
      }
    } else {
      console.warn(`[CHUNKING] No se crean chunks porque limitedText está vacío para ${document.originalName}`);
    }

    updateDocument(document.id, {
      autoSummary: summary,
      extractedText: limitedText,
      chunks,
      searchIndex, // Guardar índice para búsquedas futuras
      usedOcr,
      status: "ready",
      progress: 100,
      stage: "Listo",
      processedAt: new Date().toISOString(),
    });

    // Guardar índice de búsqueda BM25 para el documento
    if (searchIndex) {
      await storeSearchIndex(document.id, document.originalName, searchIndex);
      console.log(
        `[SEARCH-INDEX] Índice BM25 guardado para: ${document.originalName}`
      );
    }
  } catch (error) {
    updateDocument(document.id, {
      status: "error",
      progress: 100,
      stage: "Error",
      error: error?.message || "Error desconocido",
    });
    console.error(`Procesamiento de documento ${document.id} fallido:`, error);
  }
}