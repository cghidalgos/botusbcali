/**
 * Motor de búsqueda avanzado con chunking inteligente
 * - Detecta titled/secciones automáticamente
 * - Indexa por chunks (no TODO el documento)
 * - Búsqueda jerárquica: títulos → contenido
 * - Mantiene contexto de estructura
 */

import natural from "natural";

// Stopwords en español - fallback si natural.stopwords no está disponible
const SPANISH_STOPWORDS = new Set([
  "el", "la", "de", "que", "y", "a", "en", "un", "se", "es", "por", "con", "no", "una", "su", "al", "lo", "como", "más", "o", "pero", "sus", "le", "ya", "o", "fue", "este", "ha", "sí", "because", "been", "have", "this", "will", "your", "from", "they", "be", "is", "for", "me", "we", "him", "his", "how", "man", "has", "him", "there", "where", "much", "when", "than", "them", "then", "now", "some", "time", "very", "these", "who", "boy", "made", "its", "said", "did", "ask", "could", "new", "know",
  "años", "año", "mes", "meses", "día", "días", "hora", "horas", "semana", "semanas", "información", "datos", "información", "sistema", "sistemas", "costo", "costos", "costo", "profesor", "profesores", "materia", "materias", "clase", "clases", "horario", "horarios", "aula", "aulas", "salón", "salones",
]);

function getSpanishStopwords() {
  try {
    //intenta usar la API de natural si está disponible
    if (natural.stopwords && typeof natural.stopwords.getStopwords === "function") {
      return natural.stopwords.getStopwords("es");
    }
  } catch (e) {
    // Fallback a lista manual
  }
  return Array.from(SPANISH_STOPWORDS);
}

const BM25_K1 = 1.5;
const BM25_B = 0.75;
const MIN_SCORE = 0.5; // Aumentado de 0.3 - requiere más relevancia

/**
 * Tipos de chunks por relevancia
 */
const ChunkType = {
  TITLE: "title", // H1, H2, H3
  SECTION_HEADER: "section_header", // Secciones importantes
  TABLE_HEADER: "table_header", // Cabeceras de tablas
  CONTENT: "content", // Párrafos normales
  LIST: "list", // Puntos/listas
};

/**
 * Dividir documento en chunks inteligentes
 * Detecta estructura: títulos, secciones, tablas
 */
export function createIntelligentChunks(text, docName) {
  const chunks = [];
  const lines = text.split("\n").filter((line) => line.trim());

  let currentSection = null;
  let currentChunk = [];
  let chunkTokenCount = 0;
  const MAX_CHUNK_TOKENS = 500;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detectar títulos (heurística: líneas cortas con mayúsculas/números)
    const isTitle =
      line.length < 100 &&
      (line.match(/^#+/) || // Markdown headers
        /^[A-Z][A-Z\s0-9\-\.]+$/.test(line) || // ALL CAPS
        line.match(/^\d+[\.\-]\s+[A-Z]/)); // Numbered sections

    // Detectar tabla (línea con pipes o muchos espacios)
    const isTableLine = line.includes("|") || /\s{3,}/.test(line);

    if (isTitle) {
      // Guardar chunk anterior si existe
      if (currentChunk.length > 0) {
        chunks.push({
          type: ChunkType.CONTENT,
          text: currentChunk.join("\n"),
          section: currentSection,
          docName,
          metadata: { token_count: chunkTokenCount },
        });
        currentChunk = [];
        chunkTokenCount = 0;
      }

      // Guardar título
      currentSection = line;
      chunks.push({
        type: ChunkType.TITLE,
        text: line,
        section: currentSection,
        docName,
        metadata: { token_count: line.split(/\s+/).length },
      });
    } else if (isTableLine) {
      // Guardar tabla como chunk separado
      if (currentChunk.length > 0) {
        chunks.push({
          type: ChunkType.CONTENT,
          text: currentChunk.join("\n"),
          section: currentSection,
          docName,
          metadata: { token_count: chunkTokenCount },
        });
        currentChunk = [];
        chunkTokenCount = 0;
      }

      chunks.push({
        type: ChunkType.TABLE_HEADER,
        text: line,
        section: currentSection,
        docName,
        metadata: { token_count: line.split(/\s+/).length },
      });
    } else {
      // Agregar a chunk actual
      const lineTokens = line.split(/\s+/).length;

      if (chunkTokenCount + lineTokens > MAX_CHUNK_TOKENS && currentChunk.length > 0) {
        // Guardar chunk y empezar uno nuevo
        chunks.push({
          type: ChunkType.CONTENT,
          text: currentChunk.join("\n"),
          section: currentSection,
          docName,
          metadata: { token_count: chunkTokenCount },
        });
        currentChunk = [line];
        chunkTokenCount = lineTokens;
      } else {
        currentChunk.push(line);
        chunkTokenCount += lineTokens;
      }
    }
  }

  // Guardar último chunk
  if (currentChunk.length > 0) {
    chunks.push({
      type: ChunkType.CONTENT,
      text: currentChunk.join("\n"),
      section: currentSection,
      docName,
      metadata: { token_count: chunkTokenCount },
    });
  }

  return chunks;
}

/**
 * Crear índice BM25 para múltiples chunks
 */
export function createChunkedIndex(chunks, docId, docName) {
  const tokenizer = new natural.WordTokenizer();
  const stopwords = getSpanishStopwords();
  const stemmer = natural.PorterStemmerEs || natural.PorterStemmer;

  const chunkedIndex = chunks.map((chunk, idx) => {
    let tokens = tokenizer.tokenize(chunk.text.toLowerCase());
    tokens = tokens.filter((token) => {
      return (
        token.length > 2 &&
        !stopwords.includes(token) &&
        /^[a-záéíóúñ0-9]+$/.test(token)
      );
    });

    tokens = tokens.map((token) => stemmer.stem(token));

    // Crear índice invertido para este chunk
    const index = {};
    const positions = {};

    tokens.forEach((token, tokenIdx) => {
      if (!index[token]) {
        index[token] = 0;
        positions[token] = [];
      }
      index[token]++;
      positions[token].push(tokenIdx);
    });

    return {
      chunkId: `${docId}-chunk-${idx}`,
      chunkIndex: idx,
      docId,
      docName,
      type: chunk.type,
      section: chunk.section,
      text: chunk.text.slice(0, 500), // Guardar preview
      tokens,
      index,
      positions,
      length: tokens.length,
      originalTokenCount: chunk.metadata?.token_count || 0,
    };
  });

  return {
    docId,
    docName,
    chunkedIndex,
    totalChunks: chunkedIndex.length,
    metadata: {
      indexed_at: new Date().toISOString(),
      total_tokens: chunkedIndex.reduce((sum, c) => sum + c.length, 0),
      chunk_types: chunks.reduce(
        (acc, c) => {
          acc[c.type] = (acc[c.type] || 0) + 1;
          return acc;
        },
        {}
      ),
    },
  };
}

/**
 * Búsqueda jerárquica: títulos primero, luego contenido
 */
export function hierarchicalSearch(query, docIndices, topK = 5) {
  if (!query.trim() || !docIndices || docIndices.length === 0) {
    return [];
  }

  const tokenizer = new natural.WordTokenizer();
  const stopwords = getSpanishStopwords();
  const stemmer = natural.PorterStemmerEs || natural.PorterStemmer;

  let queryTokens = tokenizer.tokenize(query.toLowerCase());
  queryTokens = queryTokens.filter(
    (token) => token.length > 2 && !stopwords.includes(token)
  );
  queryTokens = queryTokens.map((token) => stemmer.stem(token));

  if (queryTokens.length === 0) return [];

  // Buscar en TÍTULOS primero (mayor relevancia)
  const titleResults = [];
  const contentResults = [];

  docIndices.forEach((docIndex) => {
    docIndex.chunkedIndex.forEach((chunk) => {
      const relevantTokens = queryTokens.filter(
        (token) => chunk.index[token]
      );

      if (relevantTokens.length === 0) return;

      const score = calculateBM25Score(
        queryTokens,
        chunk,
        docIndex.chunkedIndex
      );

      // Boost para títulos y headers (más pequeño para evitar distorsión)
      const typeBoost = {
        [ChunkType.TITLE]: 1.8,
        [ChunkType.SECTION_HEADER]: 1.6,
        [ChunkType.TABLE_HEADER]: 1.4,
        [ChunkType.CONTENT]: 1.0,
        [ChunkType.LIST]: 1.2,
      };

      // Calcular score con boost pero normalizarlo
      const boostedScore = score * (typeBoost[chunk.type] || 1.0);
      
      // Requerir coincidencia de múltiples tokens (no solo 1)
      // Si query tiene 3+ tokens, requiere coincidencia de al menos 2
      if (queryTokens.length >= 3 && relevantTokens.length < 2) {
        return; // Skip este resultado
      }
      
      // Normalizar a rango 0-1 usando sigmoid-like transformation
      const normalizedScore = Math.min(1.0, boostedScore / (1 + boostedScore));

      const result = {
        docId: chunk.docId,
        docName: chunk.docName,
        chunkId: chunk.chunkId,
        chunkIndex: chunk.chunkIndex,
        type: chunk.type,
        section: chunk.section,
        score: normalizedScore,
        relevantTokens,
        tokenMatches: relevantTokens.length,
        preview: chunk.text?.slice(0, 500) || "", // Aumentado de 200 a 500 caracteres
      };

      if (chunk.type === ChunkType.TITLE || chunk.type === ChunkType.SECTION_HEADER) {
        titleResults.push(result);
      } else {
        contentResults.push(result);
      }
    });
  });

  // Combinar: títulos primero, luego contenido
  const combined = [
    ...titleResults.sort((a, b) => b.score - a.score),
    ...contentResults.sort((a, b) => b.score - a.score),
  ];

  return combined
    .filter((result) => result.score >= MIN_SCORE)
    .slice(0, topK);
}

/**
 * Calcular score BM25 para un chunk
 */
function calculateBM25Score(queryTokens, chunk, allChunks) {
  let score = 0;
  const avgChunkLength =
    allChunks.length > 0
      ? allChunks.reduce((sum, c) => sum + c.length, 0) / allChunks.length
      : 100;

  // Calcular document frequency
  const docFrequency = {};
  allChunks.forEach((c) => {
    Object.keys(c.index).forEach((token) => {
      docFrequency[token] = (docFrequency[token] || 0) + 1;
    });
  });

  queryTokens.forEach((token) => {
    const freq = chunk.index[token] || 0;
    const df = docFrequency[token] || 1;

    const idf = Math.log((allChunks.length - df + 0.5) / (df + 0.5) + 1);

    const numerator = freq * (BM25_K1 + 1);
    const denominator =
      freq +
      BM25_K1 *
        (1 - BM25_B + BM25_B * (chunk.length / avgChunkLength));

    score += idf * (numerator / denominator);
  });

  return score;
}

/**
 * Extraer contexto con chunks adyacentes
 */
export function extractContextWithAdjacent(
  results,
  chunkedIndex,
  contextChunks = 1
) {
  if (results.length === 0) return { context: "", sources: [] };

  const topResult = results[0];
  const docIndex = chunkedIndex.find((idx) => idx.docId === topResult.docId);

  if (!docIndex) return { context: "", sources: [] };

  // Incluir chunk actual + chunks adyacentes
  const chunks = [topResult.chunkIndex];

  // Agregar chunks anteriores
  for (let i = 1; i <= contextChunks; i++) {
    if (topResult.chunkIndex - i >= 0) {
      chunks.unshift(topResult.chunkIndex - i);
    }
  }

  // Agregar chunks posteriores
  for (let i = 1; i <= contextChunks; i++) {
    if (topResult.chunkIndex + i < docIndex.chunkedIndex.length) {
      chunks.push(topResult.chunkIndex + i);
    }
  }

  // Construir contexto
  let context = "";
  chunks.forEach((chunkIdx) => {
    const chunk = docIndex.chunkedIndex[chunkIdx];
    if (chunk) {
      context += chunk.text + "\n";
    }
  });

  return {
    context: context.trim(),
    sources: results.slice(0, 3).map((r) => ({
      docId: r.docId,
      docName: r.docName,
      section: r.section,
      type: r.type,
      score: r.score.toFixed(2),
    })),
  };
}
