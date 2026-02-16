
import dotenv from "dotenv";
import OpenAI from "openai";
import { addHistoryEntry } from "./config/historyStore.js";
import { getMemory, setMemory } from "./config/memoryStore.js";
import { getEmbedding } from "./embeddings.js";
import { findCachedGPTResponse, saveCachedGPTResponse } from "./gptCache.js";
import { hierarchicalSearch, extractContextWithAdjacent } from "./chunkedSearchEngine.js";
import { getAllSearchIndices } from "./config/searchIndexStore.js";

dotenv.config();

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function buildMemorySummary({ previous, question, answer, model }) {
  const entry = `Q: ${question}\nA: ${answer}`.trim();
  const combined = previous ? `${previous}\n${entry}` : entry;
  if (!client) {
    return combined.slice(-4000);
  }
  if (combined.length < 2500) {
    return combined;
  }
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "Resume la conversación en español, máximo 1200 caracteres. Conserva nombres, cargos, correos y datos clave.",
      },
      { role: "user", content: combined },
    ],
    temperature: 0.2,
    max_tokens: 500, // Para resumen de memoria
  });
  return response.choices?.[0]?.message?.content?.trim()?.slice(0, 2000) || combined.slice(-4000);
}

function normalizeForSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCourseFromLine(line) {
  if (!line) return "";
  const fields = String(line)
    .split("\t")
    .map((field) => field.trim())
    .filter(Boolean);
  if (!fields.length) return "";
  const looksLikeTime = (value) => /^\d{1,2}[.:]\d{2}$/.test(value);
  const isLikelyCourse = (value) => {
    if (!value) return false;
    if (value.includes("@")) return false;
    if (looksLikeTime(value)) return false;
    if (/^\d+$/.test(value)) return false;
    if (/^\d{4,}-\w+$/i.test(value)) return false;
    if (/^(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)$/i.test(value)) {
      return false;
    }
    const hasLetters = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(value);
    const hasDigits = /\d/.test(value);
    return hasLetters && !hasDigits;
  };
  const withSpaces = fields.find((field) => isLikelyCourse(field) && field.includes(" "));
  if (withSpaces) return withSpaces;
  const firstCandidate = fields.find(isLikelyCourse);
  return firstCandidate || "";
}

function parseSpreadsheetRows(text) {
  if (!text) return [];
  const rows = [];
  let headers = null;
  let headerIndex = null;
  const normalizeHeader = (value) =>
    normalizeForSearch(value).replace(/\s+/g, " ").trim();

  const buildHeaderIndex = (fields) => {
    const index = new Map();
    fields.forEach((field, i) => {
      if (!field) return;
      const key = normalizeHeader(field);
      if (key) index.set(key, i);
    });
    return index;
  };

  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.toLowerCase().startsWith("hoja:")) {
      headers = null;
      headerIndex = null;
      continue;
    }
    if (!line.includes("\t")) continue;
    const fields = line.split("\t").map((field) => field.trim());
    const normalizedLine = normalizeHeader(line);

    if (!headers) {
      if (normalizedLine.includes("nombre catalogo") && normalizedLine.includes("hora inicial clase")) {
        headers = fields;
        headerIndex = buildHeaderIndex(fields);
      }
      continue;
    }

    if (!headerIndex) continue;
    rows.push({ fields, headerIndex });
  }

  return rows;
}

function parseScholarships(text) {
  if (!text) return [];
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const genericDescription =
    lines.find((line) =>
      normalizeForSearch(line).includes(
        "estudiar en la universidad de san buenaventura cali es posible"
      )
    ) || "";
  const posgradoDescription =
    lines.find((line) =>
      normalizeForSearch(line).includes("conoce las becas que tenemos")
    ) || genericDescription;

  const slugToTitle = (slug) => {
    const cleaned = slug
      .replace(/^beca(s)?-/, "")
      .replace(/[-_]+/g, " ")
      .trim();
    if (!cleaned) return "Beca";
    const lowerWords = new Set(["de", "la", "y", "o", "para", "al", "del"]);
    return cleaned
      .split(" ")
      .map((word, index) => {
        if (!word) return "";
        if (index > 0 && lowerWords.has(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  };

  const urls = new Set();
  for (const line of lines) {
    const matchUrls = line.match(/https?:\/\/\S+/g) || [];
    for (const url of matchUrls) {
      if (url.includes("/beca/")) {
        urls.add(url.replace(/[),.;]+$/, ""));
      }
    }
  }

  const entries = [];
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const slug = parsed.pathname.split("/").filter(Boolean).pop() || "beca";
      const title = slugToTitle(slug);
      const description = normalizeForSearch(title).includes("posgrado")
        ? posgradoDescription
        : genericDescription;
      entries.push({ name: title, description, link: url });
    } catch {
      continue;
    }
  }

  return entries;
}

function getFieldValue(row, ...candidates) {
  if (!row?.headerIndex) return "";
  for (const candidate of candidates) {
    const key = normalizeForSearch(candidate);
    const index = row.headerIndex.get(key);
    if (index != null && row.fields[index] != null) {
      const value = String(row.fields[index]).trim();
      if (value) return value;
    }
  }
  return "";
}

export async function composeResponse({ incomingText, context, documents, chatId }) {
  // Buscar en cache primero (si está habilitado)
  const useCache = process.env.GPT_CACHE_ENABLED !== "false";
  if (useCache) {
    const cached = await findCachedGPTResponse(incomingText, documents);
    if (cached) {
      console.log(`[CACHE] 🎯 Respuesta desde cache (similarity: ${cached.similarity.toFixed(2)}, hits: ${cached.hits})`);
      return cached.answer;
    }
  }
  
  const { activePrompt, additionalNotes } = context ?? {};
  const rawQuestion = String(incomingText || "");
  const normalizedQuestion = normalizeForSearch(rawQuestion);
  const memory = chatId ? getMemory(chatId) : "";
  
  // ==================== BÚSQUEDA BM25 ====================
  console.log(`[QUERY] Procesando pregunta: "${rawQuestion}"`);
  
  // Detectar consultas de listado (requieren más resultados)
  const isListQuery = /^\s*(qué|cuáles?|cuántos?|cuántas?|todos?|todas?|dame|muestra|lista|listado|enumera)/i.test(rawQuestion);
  
  const MIN_BM25_SCORE = 0.4; // 40% de relevancia mínima
  const docIndices = getAllSearchIndices();
  
  console.log(`[BM25] Índices disponibles: ${docIndices.length} documento(s) indexado(s)`);
  
  if (docIndices.length > 0) {
    const topK = isListQuery ? 10 : 5;
    console.log(`[BM25] Buscando en ${docIndices.length} documentos indexados...`);
    console.log(`[BM25] Query type: ${isListQuery ? 'LISTADO (top-10)' : 'ESPECÍFICA (top-5)'}`);
    
    const searchResults = hierarchicalSearch(rawQuestion, docIndices, topK);
    
    if (searchResults && searchResults.length > 0) {
      const preview = searchResults.map((r, i) => 
        `${i+1}. Score=${Math.round(r.score*100)}% "${r.chunk.text.slice(0, 50)}..."`
      ).join(' | ');
      console.log(`[BM25] Encontrados ${searchResults.length} resultado(s): ${preview}`);

const bestResult = searchResults[0];
      const scorePercent = Math.round(bestResult.score * 100);
      
      if (bestResult.score >= MIN_BM25_SCORE) {
        console.log(`[BM25] ✓ Encontrado con relevancia ${scorePercent}%, procesando con GPT...`);
        
        // Extraer contexto ampliado (chunks vecinos)
        const contextText = extractContextWithAdjacent(searchResults, 2);
        console.log(`[BM25+GPT] Contexto extraído: ${contextText.length} caracteres`);
        
        // Construir prompt para GPT con contexto BM25
        const processingPrompt = `Contexto relevante:\n${contextText}\n\nPregunta: ${rawQuestion}`;
        
        const messages = [
          {
            role: "system",
            content: activePrompt || "Eres un asistente académico útil.",
          },
          {
            role: "user",
            content: processingPrompt,
          },
        ];
        
        try {
          const response = await client.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages,
            temperature: 0.2,
            max_tokens: 1000,
          });
          
          const answer = response.choices?.[0]?.message?.content?.trim() || "No tengo esa información.";
          
          console.log(`[BM25+GPT] ✓ Respuesta generada (${answer.length} chars)`);
          
          // Guardar en cache si está habilitado
          if (useCache) {
            await saveCachedGPTResponse(incomingText, documents, answer);
            console.log(`[CACHE] 💾 Guardada nueva respuesta (total: ${await (async () => {
              const { countCachedResponses } = await import("./gptCache.js");
              return countCachedResponses();
            })()})`);
          }
          
          return answer;
        } catch (error) {
          console.error(`[BM25+GPT] ❌ Error llamando a GPT:`, error);
          // Continuar con método tradicional si falla GPT
        }
      } else {
        console.log(`[BM25] ⚠️  Relevancia baja (${scorePercent}%), usando GPT puro...`);
      }
    } else {
      console.log(`[BM25] ❌ No se encontraron resultados`);
    }
  } else {
    console.log(`[BM25] ⚠️  No hay índices disponibles, fallback a método tradicional`);
  }
  
  // ==================== MÉTODO TRADICIONAL ====================
  console.log(`[GPT-PURE] Usando método tradicional (embeddings + keywords)`);
  
  const stopTokens = new Set([
    "quien",
    "quién",
    "es",
    "de",
    "la",
    "el",
    "los",
    "las",
    "un",
    "una",
    "que",
    "y",
    "en",
    "por",
    "para",
    "del",
    "al",
    "sobre",
    "cual",
    "cuál",
  ]);
  const normalizedTokens = normalizeForSearch(incomingText)
    .split(" ")
    .filter(Boolean);
  const questionTerms = normalizedTokens
    .filter((term) => term.length > 2 && !stopTokens.has(term));
  let targetTerms = questionTerms.slice(0, 3);
  const dictaIndex = normalizedTokens.indexOf("dicta");
  if (dictaIndex >= 0) {
    const afterDicta = normalizedTokens
      .slice(dictaIndex + 1)
      .filter((term) => term.length > 2 && !stopTokens.has(term));
    if (afterDicta.length) {
      targetTerms = afterDicta.slice(0, 3);
    }
  }
  const wantsFullInfo =
    /toda\s+la\s+informacion|mostrar\s+toda|todo\s+el\s+contenido|contenido\s+completo/.test(
      normalizedQuestion
    ) ||
    (questionTerms.length === 1 && rawQuestion.length <= 20);

  const isTeachingQuery =
    ((/\b(dicta|imparte|da|ensena|enseña)\b/.test(normalizedQuestion) &&
      /\b(materia|materias|clase|clases)\b/.test(normalizedQuestion)) ||
      (/\b(clase|clases)\b/.test(normalizedQuestion) &&
        /\b(queda|asigna|asignada|asignado)\b/.test(normalizedQuestion)));

  const isCourseInfoQuery =
    (/\b(lugar|aula|salon|salón|horario|hora|dia|dias|donde|dónde)\b/.test(
      normalizedQuestion
    ) && /\b(clase|materia|curso|asignatura)\b/.test(normalizedQuestion)) ||
    (/\b(quien|quién)\b/.test(normalizedQuestion) &&
      /\b(da|dicta|imparte|ensena|enseña)\b/.test(normalizedQuestion));

  const isScholarshipQuery = /\bbeca(s)?\b/.test(normalizedQuestion);

  if (isTeachingQuery) {
    const fillerWords = new Set([
      "clase",
      "clases",
      "materia",
      "materias",
      "dicta",
      "imparte",
      "da",
      "ensena",
      "ensenar",
      "enseña",
      "queda",
      "asigna",
      "asignada",
      "asignado",
      "profesor",
      "docente",
      "docentes",
      "de",
    ]);
    const nameTerms = normalizedTokens
      .filter((term) => term.length > 2 && !stopTokens.has(term) && !fillerWords.has(term));
    if (nameTerms.length >= 2) {
      targetTerms = nameTerms.slice(0, 4);
    }
  }

  if (isCourseInfoQuery) {
    const fillerWords = new Set([
      "clase",
      "clases",
      "materia",
      "materias",
      "curso",
      "cursos",
      "asignatura",
      "asignaturas",
      "quien",
      "quien",
      "quién",
      "lugar",
      "aula",
      "salon",
      "salon",
      "salon",
      "salón",
      "donde",
      "dónde",
      "dan",
      "da",
      "dicta",
      "imparte",
      "da",
      "horario",
      "hora",
      "horas",
      "dia",
      "dias",
      "día",
      "días",
      "id",
      "catalogo",
      "catalogo",
      "catálogo",
      "grupo",
      "seccion",
      "sección",
      "profesor",
      "docente",
      "docentes",
      "de",
    ]);
    const quotedMatch = rawQuestion.match(/["“”'«»]([^"“”'«»]+)["“”'«»]/);
    if (quotedMatch?.[1]) {
      const quotedTerms = normalizeForSearch(quotedMatch[1])
        .split(" ")
        .filter((term) => term.length > 2 && !stopTokens.has(term));
      if (quotedTerms.length) {
        targetTerms = quotedTerms.slice(0, 6);
      }
    } else {
      const courseTerms = normalizedTokens
        .filter((term) => term.length > 2 && !stopTokens.has(term) && !fillerWords.has(term));
      if (courseTerms.length) {
        targetTerms = courseTerms.slice(0, 6);
      }
    }
  }

  const wantsAllDocuments =
    process.env.INCLUDE_ALL_DOCUMENTS === "true" ||
    /base\s+de\s+conocimiento|toda\s+la\s+base|conocimiento\s+completo|toda\s+la\s+informacion|informacion\s+completa/.test(
      normalizedQuestion
    );
  const perDocLimitDefault = Number.parseInt(
    process.env.DOCUMENT_PER_DOC_LIMIT || "120000",
    10
  );
  const perDocLimitAll = Number.parseInt(
    process.env.DOCUMENT_PER_DOC_LIMIT_ALL || String(perDocLimitDefault),
    10
  );
  const totalDocLimitDefault = Number.parseInt(
    process.env.DOCUMENT_TOTAL_LIMIT || "600000",
    10
  );
  const totalDocLimitAll = Number.parseInt(
    process.env.DOCUMENT_TOTAL_LIMIT_ALL || "1200000",
    10
  );
  const perDocLimit = wantsAllDocuments ? perDocLimitAll : perDocLimitDefault;
  const totalDocLimit = wantsAllDocuments ? totalDocLimitAll : totalDocLimitDefault;
  const sortedDocuments = [...documents].sort((a, b) => {
    const aText = normalizeForSearch(
      `${a?.originalName || ""} ${a?.sourceUrl || ""} ${a?.extractedText || ""}`
    );
    const bText = normalizeForSearch(
      `${b?.originalName || ""} ${b?.sourceUrl || ""} ${b?.extractedText || ""}`
    );
    const score = (text) =>
      targetTerms.reduce((acc, term) => (text.includes(term) ? acc + 1 : acc), 0);
    const aScore = score(aText);
    const bScore = score(bText);
    if (bScore !== aScore) {
      return bScore - aScore;
    }
    const aIsWeb = String(a?.mimetype || "").includes("text/html") || a?.sourceUrl;
    const bIsWeb = String(b?.mimetype || "").includes("text/html") || b?.sourceUrl;
    return Number(bIsWeb) - Number(aIsWeb);
  });

  if (isScholarshipQuery) {
    const matchedLines = [];
    const matchedLinks = [];
    for (const doc of sortedDocuments) {
      const text = String(doc.extractedText || "");
      if (!text) continue;
      const scholarships = parseScholarships(text);
      if (scholarships.length) {
        const formatted = scholarships
          .map((entry) => {
            const parts = [entry.name];
            if (entry.description) {
              parts.push(entry.description);
            }
            parts.push(`Ver detalles: ${entry.link}`);
            return parts.join("\n");
          })
          .join("\n\n");
        return formatted;
      }
      for (const line of text.split(/\r?\n/)) {
        const normalizedLine = normalizeForSearch(line);
        if (normalizedLine.includes("beca")) {
          if (line.includes("http")) {
            matchedLinks.push(line.trim());
          } else {
            matchedLines.push(line.trim());
          }
        }
      }
      if (matchedLines.length + matchedLinks.length >= 60) break;
    }

    if (matchedLines.length || matchedLinks.length) {
      const uniqueLines = Array.from(new Set(matchedLines)).slice(0, 20);
      const uniqueLinks = Array.from(new Set(matchedLinks)).slice(0, 20);
      const parts = [];
      if (uniqueLines.length) {
        parts.push(uniqueLines.join("\n"));
      }
      if (uniqueLinks.length) {
        parts.push(`Enlaces:\n${uniqueLinks.join("\n")}`);
      }
      return parts.join("\n\n");
    }
  }

  const documentChunks = [];
  let totalLength = 0;

  for (const doc of sortedDocuments) {
    const summary = doc.autoSummary || doc.manualSummary || doc.originalName;
    const extracted = doc.extractedText
      ? doc.extractedText.slice(0, perDocLimit)
      : "";
    const sourceLine = doc.sourceUrl ? `\nFuente: ${doc.sourceUrl}` : "";
    const extractedNote = extracted
      ? `\nTexto extraído (${doc.originalName}):\n${extracted}`
      : "";
    const chunk = `${summary}${sourceLine}${extractedNote}`;
    if (totalLength + chunk.length > totalDocLimit) {
      break;
    }
    documentChunks.push(chunk);
    totalLength += chunk.length;
  }

  const documentNotes = documentChunks.join("\n\n");

  let fullDocText = "";
  let fullDocSource = "";
  if (targetTerms.length) {
    const term = targetTerms[0];
    const docsByRecency = [...documents].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
    const candidates = docsByRecency.filter((doc) => {
      const text = String(doc.extractedText || "");
      const haystack = normalizeForSearch(
        `${doc.originalName || ""} ${doc.manualSummary || ""} ${doc.sourceUrl || ""} ${text}`
      );
      return haystack.includes(term);
    });

    if ((wantsFullInfo || questionTerms.length <= 2) && candidates.length) {
      const best = candidates[0];
      fullDocSource = best.sourceUrl ? `Fuente: ${best.sourceUrl}` : "";
      const fullLimit = Number.parseInt(
        process.env.DOCUMENT_FULL_LIMIT || String(totalDocLimit),
        10
      );
      fullDocText = String(best.extractedText || "").slice(0, fullLimit);
    }
  }

  const relevantSnippets = [];
  const semanticSnippets = [];
  let queryEmbedding = null;
  try {
    queryEmbedding = await getEmbedding(rawQuestion);
  } catch (embedError) {
    console.error("Embeddings de consulta fallidos", embedError);
  }
  if (queryEmbedding) {
    const scored = [];
    for (const doc of sortedDocuments) {
      const chunks = Array.isArray(doc.chunks) ? doc.chunks : [];
      for (const chunk of chunks) {
        if (!chunk?.embedding || !Array.isArray(chunk.embedding)) continue;
        const score = cosineSimilarity(queryEmbedding, chunk.embedding);
        scored.push({ score, text: chunk.text, doc });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    scored.slice(0, 8).forEach((item) => {
      if (item.text) {
        semanticSnippets.push(item.text);
      }
    });
  }
  if (targetTerms.length) {
    for (const doc of sortedDocuments) {
      const text = String(doc.extractedText || "");
      if (!text) continue;
      const lines = text.split(/\r?\n/);
      const matches = [];
      for (const line of lines) {
        const normalized = normalizeForSearch(line);
        const hasAll = targetTerms.every((term) => normalized.includes(term));
        if (hasAll) {
          matches.push(line.trim());
        }
      }
      if (!matches.length) {
        for (const line of lines) {
          const normalized = normalizeForSearch(line);
          const hasAny = targetTerms.some((term) => normalized.includes(term));
          if (hasAny) {
            matches.push(line.trim());
          }
        }
      }
      if (matches.length) {
        matches.slice(0, 6).forEach((match) => {
          if (match && match.length <= 500) {
            relevantSnippets.push(match);
          }
        });
      }
      if (relevantSnippets.length >= 8) {
        break;
      }
    }
  }

  const finalSnippets = semanticSnippets.length ? semanticSnippets : relevantSnippets;

  if (isTeachingQuery && targetTerms.length) {
    const matchedLines = [];
    for (const doc of sortedDocuments) {
      const text = String(doc.extractedText || "");
      if (!text) continue;
      for (const line of text.split(/\r?\n/)) {
        const normalizedLine = normalizeForSearch(line);
        const matches = targetTerms.filter((term) => normalizedLine.includes(term)).length;
        const minMatches = Math.min(2, targetTerms.length);
        if (matches >= minMatches) {
          matchedLines.push(line.trim());
        }
      }
      if (matchedLines.length >= 100) break;
    }

    const courses = new Set();
    for (const line of matchedLines) {
      const course = extractCourseFromLine(line);
      if (course) courses.add(course);
    }

    if (courses.size) {
      const list = Array.from(courses).slice(0, 30);
      const nameLabel = targetTerms.join(" ");
      return `Materias encontradas para ${nameLabel}:\n- ${list.join("\n- ")}`;
    }
  }

  if (isCourseInfoQuery && targetTerms.length) {
    const courseMatches = [];
    for (const doc of sortedDocuments) {
      if (!String(doc.mimetype || "").includes("spreadsheet") && !String(doc.originalName || "").toLowerCase().endsWith(".xlsx")) {
        continue;
      }
      const rows = parseSpreadsheetRows(doc.extractedText || "");
      for (const row of rows) {
        const courseName = getFieldValue(row, "Nombre Catálogo", "Nombre Catalogo") || "";
        if (!courseName) continue;
        const normalizedCourse = normalizeForSearch(courseName);
        const hasAll = targetTerms.every((term) => normalizedCourse.includes(term));
        if (hasAll) {
          courseMatches.push(row);
        }
      }
    }

    if (courseMatches.length) {
      const details = [];
      const seen = new Set();
      for (const row of courseMatches) {
        const nombreCatalogo =
          getFieldValue(row, "Nombre Catálogo", "Nombre Catalogo") || "(sin nombre)";
        const idCatalogo = getFieldValue(row, "ID Catálogo", "ID Catalogo");
        const profesor = getFieldValue(row, "Nombre");
        const correo = getFieldValue(row, "Correo-E", "Correo E", "Correo");
        const aula = getFieldValue(row, "Aula");
        const horaInicio = getFieldValue(row, "Hora Inicial Clase", "Hora Inicial");
        const horaFin = getFieldValue(row, "Hora Final Clase", "Hora Final");
        const dia = getFieldValue(row, "Día", "Dia");
        const seccion = getFieldValue(row, "Sección Clase", "Seccion Clase");
        const grupo = getFieldValue(row, "Grupo Academico", "Grupo Académico");
        const idCurso = getFieldValue(row, "ID Curso");
        const key = [nombreCatalogo, idCatalogo, profesor, aula, horaInicio, horaFin, dia, seccion, grupo, idCurso]
          .filter(Boolean)
          .join("|");
        if (seen.has(key)) continue;
        seen.add(key);

        const lines = [
          `Materia: ${nombreCatalogo}`,
          idCatalogo ? `ID Catálogo: ${idCatalogo}` : "",
          idCurso ? `ID Curso: ${idCurso}` : "",
          seccion ? `Sección: ${seccion}` : "",
          grupo ? `Grupo: ${grupo}` : "",
          profesor ? `Profesor: ${profesor}` : "",
          correo ? `Correo: ${correo}` : "",
          aula ? `Aula: ${aula}` : "",
          dia ? `Día: ${dia}` : "",
          horaInicio ? `Hora inicial: ${horaInicio}` : "",
          horaFin ? `Hora final: ${horaFin}` : "",
        ].filter(Boolean);
        details.push(lines.join("\n"));
        if (details.length >= 20) break;
      }

      if (details.length) {
        return details.join("\n\n");
      }
    }
  }

  const fullDocBlock = fullDocText
    ? `DOCUMENTO COMPLETO PARA RESPONDER:\n${fullDocSource ? fullDocSource + "\n" : ""}${fullDocText}\n\nInstrucción: devuelve el documento completo sin omitir información.`
    : "";

  const memoryBlock = memory ? `Memoria de conversación:\n${memory}` : "";

  const defaultPrompt = [
    "Actúa como un asistente experto en las instrucciones provistas.",
    "Prioridad de respuesta (en orden): 1) Contexto de conversacion configurado, 2) Documentos subidos, 3) Memoria de conversacion, 4) Conocimiento general.",
    "Si hay conflicto entre el contexto configurado y otras fuentes, sigue el contexto configurado.",
    "Responde usando SOLO la informacion del contexto configurado y los documentos subidos. Si no esta ahi, di que no tienes esa informacion.",
    "Si el usuario pide toda la informacion, entrega el texto completo del documento relevante.",
    "Responde con informacion de costos del ano 2026. No muestres del 2025.",
    "Responde en texto plano, sin Markdown ni encabezados.",
    activePrompt && `Contexto base (prioridad alta): ${activePrompt}`,
    additionalNotes && `Notas adicionales (prioridad alta): ${additionalNotes}`,
    documentNotes && `Documentos relevantes (prioridad alta): ${documentNotes}`,
    fullDocBlock,
    finalSnippets.length && `Fragmentos relevantes:\n${finalSnippets.join("\n")}`,
    memoryBlock,
    `Pregunta: ${incomingText}`,
  ]
    .filter(Boolean)
    .join("\n");

  const assembledPrompt = defaultPrompt;

  if (!client) {
    return `OPENAI_API_KEY no configurada. Esta es la petición armada:\n${assembledPrompt}`;
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 300;
  
  // Usar solo el contexto configurado en la interfaz como prompt del sistema
  const systemPrompt = String(activePrompt || "").trim() || "Eres un asistente virtual útil y profesional.";
  
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      { role: "user", content: assembledPrompt },
    ],
    temperature: 0.3, // Un poco más natural
    max_tokens: maxTokens,
  });

  const answer = response.choices?.[0]?.message?.content?.trim() ?? "No se obtuvo respuesta.";

  if (chatId) {
    try {
      const updatedMemory = await buildMemorySummary({
        previous: memory,
        question: rawQuestion,
        answer,
        model,
      });
      setMemory(chatId, updatedMemory);
    } catch (memoryError) {
      console.error("Memoria no pudo actualizarse", memoryError);
    }
  }

  // Guardar en cache (si está habilitado)
  if (useCache && answer) {
    saveCachedGPTResponse(incomingText, answer, documents).catch(err => {
      console.error("[CACHE] Error guardando:", err.message);
    });
  }

  // Guardar en historial
  addHistoryEntry({
    question: incomingText,
    answer,
    context,
    usedDocuments: documents.map(d => d.originalName),
    chatId,
  });

  return answer;
}
