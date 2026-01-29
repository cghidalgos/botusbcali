
import dotenv from "dotenv";
import OpenAI from "openai";
import { addHistoryEntry } from "./config/historyStore.js";
import { getMemory, setMemory } from "./config/memoryStore.js";
import { getEmbedding } from "./embeddings.js";

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
  });
  return response.choices?.[0]?.message?.content?.trim()?.slice(0, 2000) || combined.slice(-4000);
}

export async function composeResponse({ incomingText, context, documents, chatId }) {
  const { activePrompt, additionalNotes, promptTemplate } = context ?? {};
  const rawQuestion = String(incomingText || "");
  const normalizedQuestion = rawQuestion.toLowerCase().trim();
  const memory = chatId ? getMemory(chatId) : "";
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
  const questionTerms = String(incomingText || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((term) => term.length > 2 && !stopTokens.has(term));
  const targetTerms = questionTerms.slice(0, 3);
  const wantsFullInfo =
    /toda\s+la\s+informaci[óo]n|mostrar\s+toda|todo\s+el\s+contenido|contenido\s+completo/.test(
      normalizedQuestion
    ) ||
    (questionTerms.length === 1 && rawQuestion.length <= 20);
  const textLimit = Number.parseInt(process.env.DOCUMENT_TEXT_LIMIT || "200000", 10);
  const perDocLimit = Math.min(textLimit, 60000);
  const totalDocLimit = Number.parseInt(process.env.DOCUMENT_TOTAL_LIMIT || "180000", 10);
  const sortedDocuments = [...documents].sort((a, b) => {
    const aText = `${a?.originalName || ""} ${a?.sourceUrl || ""} ${a?.extractedText || ""}`.toLowerCase();
    const bText = `${b?.originalName || ""} ${b?.sourceUrl || ""} ${b?.extractedText || ""}`.toLowerCase();
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
  if (questionTerms.length) {
    const term = questionTerms[0];
    const docsByRecency = [...documents].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
    const candidates = docsByRecency.filter((doc) => {
      const text = String(doc.extractedText || "");
      const haystack = `${doc.originalName || ""} ${doc.manualSummary || ""} ${doc.sourceUrl || ""} ${text}`.toLowerCase();
      return haystack.includes(term);
    });

    if ((wantsFullInfo || questionTerms.length <= 2) && candidates.length) {
      const best = candidates[0];
      fullDocSource = best.sourceUrl ? `Fuente: ${best.sourceUrl}` : "";
      fullDocText = String(best.extractedText || "").slice(0, totalDocLimit);
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
        const normalized = line.toLowerCase();
        const hasAll = targetTerms.every((term) => normalized.includes(term));
        if (hasAll) {
          matches.push(line.trim());
        }
      }
      if (!matches.length) {
        for (const line of lines) {
          const normalized = line.toLowerCase();
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

  const fullDocBlock = fullDocText
    ? `DOCUMENTO COMPLETO PARA RESPONDER:\n${fullDocSource ? fullDocSource + "\n" : ""}${fullDocText}\n\nInstrucción: devuelve el documento completo sin omitir información.`
    : "";

  const memoryBlock = memory ? `Memoria de conversación:\n${memory}` : "";

  const defaultPrompt = [
    "Actúa como un asistente experto en las instrucciones provistas.",
    "Responde usando la información de los documentos y el texto extraído, tambien de https://usbcali.edu.co/facultad/ingenieria/ y/o con inromacion basica sobre los programas de ingenieria.",
    "Si el usuario pide toda la información, entrega el texto completo del documento relevante.",
    "Responde con información de costos del año 2026.  no muestres del 2025.",
    "Responde en texto plano, sin Markdown ni encabezados.",
    activePrompt && `Contexto base: ${activePrompt}`,
    additionalNotes && `Notas adicionales: ${additionalNotes}`,
    memoryBlock,
    documentNotes && `Documentos: ${documentNotes}`,
    fullDocBlock,
    finalSnippets.length && `Fragmentos relevantes:\n${finalSnippets.join("\n")}`,
    `Pregunta: ${incomingText}`,
  ]
    .filter(Boolean)
    .join("\n");

  const trimmedTemplate = promptTemplate?.trim();
  let assembledPrompt = trimmedTemplate
    ? trimmedTemplate
        .replaceAll("{activePrompt}", activePrompt || "")
        .replaceAll("{additionalNotes}", additionalNotes || "")
        .replaceAll("{documentNotes}", documentNotes || "")
        .replaceAll("{incomingText}", incomingText || "")
    : defaultPrompt;

  if (trimmedTemplate) {
    if (!trimmedTemplate.includes("{activePrompt}") && activePrompt) {
      assembledPrompt += `\nContexto base: ${activePrompt}`;
    }
    if (!trimmedTemplate.includes("{additionalNotes}") && additionalNotes) {
      assembledPrompt += `\nNotas adicionales: ${additionalNotes}`;
    }
    if (!trimmedTemplate.includes("{documentNotes}") && documentNotes) {
      assembledPrompt += `\nDocumentos: ${documentNotes}`;
    }
    if (!trimmedTemplate.includes("Memoria de conversación") && memoryBlock) {
      assembledPrompt += `\n${memoryBlock}`;
    }
    if (!trimmedTemplate.includes("DOCUMENTO COMPLETO") && fullDocBlock) {
      assembledPrompt += `\n${fullDocBlock}`;
    }
    if (!trimmedTemplate.includes("{incomingText}")) {
      assembledPrompt += `\nPregunta: ${incomingText}`;
    }
  }

  if (!client) {
    return `OPENAI_API_KEY no configurada. Esta es la petición armada:\n${assembledPrompt}`;
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "Eres un asistente que responde siguiendo el contexto y documentos cargados. Si preguntan por un docente (p. ej., '¿Quién es X?'), responde con su rol y muestra sus títulos y correo exactamente como aparecen en el texto extraído.",
      },
      { role: "user", content: assembledPrompt },
    ],
    temperature: 0.2,
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
