/**
 * Motor de búsqueda híbrido BM25 + Vector similarity
 * Alternativa robusto a OpenAI embeddings
 * No requiere API calls, funciona offline
 */

import natural from "natural";
import { tokenize } from "natural";

// BM25 parameters
const BM25_K1 = 1.5; // Term saturation parameter
const BM25_B = 0.75; // Length normalization parameter
const MIN_SCORE = 0.3; // Minimum relevance score

// Helper function for Spanish stopwords
function getSpanishStopwords() {
  const spanishStops = [
    "el", "la", "de", "que", "y", "a", "en", "un", "ser", "se", "no", 
    "haber", "por", "con", "su", "para", "es", "al", "lo", "como", "más",
    "o", "pero", "sus", "le", "ya", "o", "este", "sí", "porque", "esta",
    "son", "entre", "está", "cuando", "muy", "sin", "sobre", "ser", "tiene",
    "también", "me", "hasta", "hay", "donde", "han", "quien", "están",
    "estado", "desde", "todo", "nos", "durante", "estados", "todos", "uno",
    "les", "ni", "contra", "otros", "fueron", "ese", "eso", "había", "ante",
    "ellos", "esa", "este", "esos", "estas", "esa", "estaba", "estaban",
    "estabas", "estábamos", "estabaís", "estaban", "estabas", "estábamos",
    "estabaís", "esté", "estés", "estemos", "estéis", "estén"
  ];
  return new Set(spanishStops);
}

function isSpanishStopword(token) {
  return getSpanishStopwords().has(token);
}

/**
 * Indexar documento para búsqueda
 */
export function createDocumentIndex(text, docId, docName) {
  const tokenizer = new natural.WordTokenizer();
  const stemmer = natural.PorterStemmerEs || natural.PorterStemmer;

  // Tokenizar y limpiar
  let tokens = tokenizer.tokenize(text.toLowerCase());
  tokens = tokens.filter((token) => {
    return (
      token.length > 2 &&
      !isSpanishStopword(token) &&
      /^[a-záéíóúñ0-9]+$/.test(token)
    );
  });

  // Aplicar stemming
  tokens = tokens.map((token) => stemmer.stem(token));

  // Crear índice invertido
  const index = {};
  const positions = {};

  tokens.forEach((token, idx) => {
    if (!index[token]) {
      index[token] = 0;
      positions[token] = [];
    }
    index[token]++;
    positions[token].push(idx);
  });

  return {
    docId,
    docName,
    tokens,
    index,
    positions,
    length: tokens.length,
    metadata: {
      indexed_at: new Date().toISOString(),
      token_count: tokens.length,
      unique_tokens: Object.keys(index).length,
    },
  };
}

/**
 * Calcular score BM25
 */
function calculateBM25(
  queryTokens,
  docIndex,
  avgDocLength,
  totalDocs,
  docFrequency
) {
  let score = 0;

  queryTokens.forEach((token) => {
    const freq = docIndex.index[token] || 0;
    const df = docFrequency[token] || 1;

    // IDF (Inverse Document Frequency)
    const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);

    // BM25 formula
    const numerator =
      freq * (BM25_K1 + 1);
    const denominator =
      freq +
      BM25_K1 *
        (1 -
          BM25_B +
          BM25_B *
            (docIndex.length / avgDocLength));

    score += idf * (numerator / denominator);
  });

  return score;
}

/**
 * Búsqueda rápida en documentos indexados
 */
export function searchDocuments(query, documentIndices, topK = 5) {
  if (!query.trim()) return [];

  const tokenizer = new natural.WordTokenizer();
  const stemmer = natural.PorterStemmerEs || natural.PorterStemmer;

  // Procesar query como documento
  let queryTokens = tokenizer.tokenize(query.toLowerCase());
  queryTokens = queryTokens.filter(
    (token) => token.length > 2 && !isSpanishStopword(token)
  );
  queryTokens = queryTokens.map((token) => stemmer.stem(token));

  if (queryTokens.length === 0) {
    return [];
  }

  // Calcular document frequency
  const docFrequency = {};
  documentIndices.forEach((index) => {
    Object.keys(index.index).forEach((token) => {
      docFrequency[token] = (docFrequency[token] || 0) + 1;
    });
  });

  // Calcular longitud promedio de documentos
  const avgDocLength =
    documentIndices.length > 0
      ? documentIndices.reduce((sum, idx) => sum + idx.length, 0) /
        documentIndices.length
      : 100;

  // Calcular scores BM25
  const scores = documentIndices.map((docIndex) => {
    const score = calculateBM25(
      queryTokens,
      docIndex,
      avgDocLength,
      documentIndices.length,
      docFrequency
    );

    return {
      docId: docIndex.docId,
      docName: docIndex.docName,
      score,
      relevantTokens: queryTokens.filter((token) => docIndex.index[token]),
      tokenMatches: queryTokens.filter((token) => docIndex.index[token]).length,
    };
  });

  // Filtrar y ordenar
  return scores
    .filter((result) => result.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Extraer fragmentos relevantes del documento
 */
export function extractRelevantChunks(
  text,
  query,
  chunkSize = 500,
  maxChunks = 3
) {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s);
  const queryLower = query.toLowerCase();

  // Puntuar oraciones por relevancia
  const scoredSentences = sentences.map((sentence, idx) => {
    const score = queryLower
      .split(/\s+/)
      .reduce((acc, word) => {
        return acc + (sentence.toLowerCase().includes(word) ? 1 : 0);
      }, 0);

    return { sentence, idx, score };
  });

  // Seleccionar top oraciones
  const topSentences = scoredSentences
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks);

  // Ordenar por posición original
  return topSentences
    .sort((a, b) => a.idx - b.idx)
    .map((s) => s.sentence)
    .join(". ");
}

/**
 * Buscar múltiples documentos y construir contexto
 */
export function buildSearchContext(query, documentIndices, chunks = {}) {
  if (!documentIndices || documentIndices.length === 0) {
    return { found: false, context: "", sources: [] };
  }

  const results = searchDocuments(query, documentIndices, 5);

  if (results.length === 0) {
    return { found: false, context: "", sources: [] };
  }

  // Construir contexto de los mejores resultados
  let context = "";
  const sources = [];

  results.slice(0, 3).forEach((result) => {
    if (chunks[result.docId]) {
      const chunkText = chunks[result.docId]
        .slice(0, 2) // Top 2 chunks per document
        .join("\n");

      context += `\n[Fuente: ${result.docName}]\n${chunkText}`;
      sources.push({
        docId: result.docId,
        docName: result.docName,
        score: result.score.toFixed(2),
      });
    }
  });

  return {
    found: context.length > 0,
    context: context.trim(),
    sources,
    topMatch: results[0],
  };
}

/**
 * Búsqueda inteligente: primero BM25, luego fallback a GPT
 * Esto evita llamadas innecesarias a OpenAI
 */
export function intelligentSearch(
  query,
  documentIndices,
  extractedTexts = {}
) {
  if (!documentIndices || documentIndices.length === 0) {
    return { found: false, relevance: 0, context: "" };
  }

  const results = searchDocuments(query, documentIndices, 3);

  if (results.length === 0 || results[0].score < MIN_SCORE) {
    return { found: false, relevance: 0, context: "" };
  }

  // Extraer fragmentos más relevantes del documento top
  const topResult = results[0];
  const docText = extractedTexts[topResult.docId];

  if (!docText || docText.length === 0) {
    return {
      found: true,
      relevance: topResult.score,
      context: `Documento encontrado: ${topResult.docName}`,
      sources: [topResult],
    };
  }

  // Extraer fragments relevantes
  const relevantChunks = extractRelevantChunks(docText, query, 300, 2);

  return {
    found: true,
    relevance: topResult.score,
    context: relevantChunks,
    sources: results.slice(0, 3).map((r) => ({
      docId: r.docId,
      docName: r.docName,
      score: r.score.toFixed(2),
    })),
  };
}
