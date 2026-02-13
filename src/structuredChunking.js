import { load } from "cheerio";

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseHeadingLevel(tagName) {
  const match = /^h([1-6])$/i.exec(String(tagName || ""));
  return match ? Number(match[1]) : null;
}

function splitLongText(text, maxLen) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return [];
  const resolvedMax =
    maxLen ?? Number.parseInt(process.env.STRUCTURED_CHUNK_MAX_CHARS || "3200", 10);
  if (cleaned.length <= resolvedMax) return [cleaned];

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const pieces = [];
  let buffer = "";
  for (const p of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${p}` : p;
    if (candidate.length <= resolvedMax) {
      buffer = candidate;
      continue;
    }
    if (buffer) {
      pieces.push(buffer);
      buffer = "";
    }
    if (p.length <= resolvedMax) {
      pieces.push(p);
      continue;
    }
    let start = 0;
    while (start < p.length) {
      pieces.push(p.slice(start, start + resolvedMax));
      start += resolvedMax;
    }
  }
  if (buffer) pieces.push(buffer);
  return pieces;
}

export function extractHtmlSectionsFromHtml(html, baseUrl = null) {
  const raw = String(html || "");
  if (!raw.trim()) return [];

  const $ = load(raw);
  $(
    "script, style, noscript, iframe, svg, canvas, nav, footer, header, form"
  ).remove();

  const body = $("body");
  const base = body.length ? body : $.root();

  const headingNodes = base.find("h1, h2, h3").toArray();
  const sections = [];

  if (!headingNodes.length) {
    const text = normalizeWhitespace(base.text());
    return text
      ? [
          {
            headingPath: [],
            text,
            url: baseUrl || null,
          },
        ]
      : [];
  }

  const stack = [];
  for (const node of headingNodes) {
    const heading = $(node);
    const headingText = normalizeWhitespace(heading.text());
    if (!headingText) continue;

    const level = parseHeadingLevel(node.tagName) ?? 3;
    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    stack.push({ level, text: headingText });

    const content = heading
      .nextUntil("h1, h2, h3")
      .find("p, li, td, th, strong, b, em, span")
      .addBack()
      .map((_, el) => normalizeWhitespace($(el).text()))
      .get()
      .filter(Boolean);

    const merged = normalizeWhitespace(content.join("\n"));
    if (merged.length < 80) continue;

    sections.push({
      headingPath: stack.map((s) => s.text),
      text: merged,
      url: baseUrl || null,
    });
  }

  const seen = new Set();
  return sections.filter((s) => {
    const key = s.text;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function chunkHtmlSections(sections, options = {}) {
  const maxChunks =
    options.maxChunks ?? Number.parseInt(process.env.EMBEDDING_MAX_CHUNKS || "600", 10);

  const descriptors = [];
  for (const section of sections || []) {
    if (!section?.text) continue;
    const prefix = section.headingPath?.length
      ? `Sección: ${section.headingPath.join(" > ")}`
      : "";
    const urlLine = section.url ? `Fuente: ${section.url}` : "";
    const header = [prefix, urlLine].filter(Boolean).join("\n");
    const body = String(section.text || "").trim();
    const combined = header ? `${header}\n${body}` : body;

    for (const piece of splitLongText(combined)) {
      descriptors.push({
        text: piece,
        meta: {
          kind: "html_section",
          headingPath: section.headingPath || [],
          url: section.url || null,
        },
      });
      if (descriptors.length >= maxChunks) return descriptors;
    }
  }

  return descriptors;
}

export function chunkSpreadsheetExtractedText(extractedText, options = {}) {
  const rowsPerChunk = options.rowsPerChunk ?? 30;
  const maxChunks =
    options.maxChunks ?? Number.parseInt(process.env.EMBEDDING_MAX_CHUNKS || "600", 10);

  const text = String(extractedText || "");
  if (!text.trim()) return [];

  const lines = text.split(/\r?\n/);
  const descriptors = [];

  let sheetName = "";
  let rowIndex = 0;
  let buffer = [];
  let blockStart = 1;

  const flush = () => {
    const rows = buffer.filter(Boolean);
    if (!rows.length) return;

    const rowStart = blockStart;
    const rowEnd = blockStart + rows.length - 1;
    const header = sheetName ? `Hoja: ${sheetName}` : "";
    const chunkText = header ? `${header}\n${rows.join("\n")}` : rows.join("\n");

    descriptors.push({
      text: chunkText,
      meta: {
        kind: "table_rows",
        sheetName: sheetName || null,
        rowStart,
        rowEnd,
      },
    });

    buffer = [];
    blockStart = rowEnd + 1;
  };

  for (const rawLine of lines) {
    const line = String(rawLine || "").trim();
    if (!line) continue;

    if (/^Hoja:\s*/i.test(line)) {
      flush();
      sheetName = line.replace(/^Hoja:\s*/i, "").trim();
      rowIndex = 0;
      blockStart = 1;
      continue;
    }

    rowIndex += 1;
    buffer.push(line);

    if (buffer.length >= rowsPerChunk) {
      flush();
      if (descriptors.length >= maxChunks) return descriptors;
    }
  }

  flush();
  return descriptors.slice(0, maxChunks);
}

export function chunkWebPages(pages, options = {}) {
  const maxChunks =
    options.maxChunks ?? Number.parseInt(process.env.EMBEDDING_MAX_CHUNKS || "600", 10);

  const descriptors = [];
  for (const page of pages || []) {
    const url = page?.url ? String(page.url) : null;
    const text = String(page?.text || "").trim();
    if (!text) continue;

    const header = url ? `Fuente: ${url}` : "";
    const combined = header ? `${header}\n${text}` : text;

    for (const piece of splitLongText(combined)) {
      descriptors.push({
        text: piece,
        meta: {
          kind: "web_page",
          url,
        },
      });
      if (descriptors.length >= maxChunks) return descriptors;
    }
  }
  return descriptors;
}

export function chunkByStructure({ extractedText, mimetype, originalName, sourceUrl, htmlSections, webPages }) {
  const mime = String(mimetype || "").toLowerCase();
  const name = String(originalName || "").toLowerCase();

  const isSpreadsheet =
    mime.includes("spreadsheet") || name.endsWith(".xlsx") || name.endsWith(".csv");
  if (isSpreadsheet) {
    return chunkSpreadsheetExtractedText(extractedText);
  }

  const isHtml = mime.includes("text/html") || name.endsWith(".html") || name.endsWith(".htm");
  if (isHtml && Array.isArray(htmlSections) && htmlSections.length) {
    return chunkHtmlSections(
      htmlSections.map((s) => ({ ...s, url: s.url || sourceUrl || null }))
    );
  }

  if (Array.isArray(webPages) && webPages.length) {
    return chunkWebPages(webPages);
  }

  return null;
}
