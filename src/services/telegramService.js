import axios from "axios";
import fs from "node:fs";
import FormData from "form-data";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Convierte a texto plano legible: quita tags HTML y decodifica las entidades
// básicas. Se usa como respaldo cuando Telegram rechaza el HTML.
function stripHtmlTags(text) {
  return String(text)
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// ¿El error de Telegram es por no poder parsear las entidades/HTML del mensaje?
function isTelegramParseError(error) {
  const status = error?.response?.status;
  const description = String(
    error?.response?.data?.description || error?.message || ""
  ).toLowerCase();
  return (
    status === 400 &&
    (description.includes("parse") ||
      description.includes("entit") ||
      description.includes("tag"))
  );
}

function formatTelegramHtml(text, skipEscape = false) {
  // Si skipEscape es true, el texto ya tiene HTML válido
  if (skipEscape) {
    return text;
  }
  
  const escaped = escapeHtml(text);
  return escaped
    .replace(/^#{1,6}\s*(.+)$/gm, "<b>$1</b>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/__(.+?)__/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function splitTelegramMessage(text, maxLength = 3800) {
  const raw = String(text ?? "");
  const parts = [];
  let remaining = raw;
  while (remaining.length) {
    let chunk = remaining.slice(0, maxLength);
    const lastBreak = chunk.lastIndexOf("\n");
    if (lastBreak > 500) {
      chunk = chunk.slice(0, lastBreak);
    }
    parts.push(chunk);
    remaining = remaining.slice(chunk.length).trimStart();
  }
  return parts;
}

function normalizeTelegramErrorMessage(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (typeof data?.description === "string") return data.description;
  if (typeof data?.message === "string") return data.message;
  return "";
}

export function classifyTelegramSendError(error) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const description = normalizeTelegramErrorMessage(data) || String(error?.message || "");
  const lowered = description.toLowerCase();

  if (status === 403 || lowered.includes("blocked") || lowered.includes("bot was blocked")) {
    return { reason: "blocked", status, description };
  }
  if (status === 400 || lowered.includes("chat not found") || lowered.includes("chat_id")) {
    return { reason: "invalid_chat", status, description };
  }
  if (status === 429 || lowered.includes("too many requests")) {
    const retryAfter = Number(data?.parameters?.retry_after || 0);
    return { reason: "rate_limited", status, description, retryAfterSeconds: retryAfter };
  }
  return { reason: "unknown", status, description };
}

export function createTelegramService({ token, delayBetweenPartsMs = 0, maxMessageLength = 3800 } = {}) {
  const resolvedToken = token || process.env.TELEGRAM_BOT_TOKEN;
  const apiBase = resolvedToken ? `https://api.telegram.org/bot${resolvedToken}` : null;

  if (!apiBase) {
    const mockError = () => {
      throw new Error("Telegram API not configured (missing TELEGRAM_BOT_TOKEN)");
    };
    return {
      isConfigured: false,
      sendMessage: mockError,
      sendPhoto: mockError,
      sendVideo: mockError,
      sendAudio: mockError,
      sendDocument: mockError,
      answerCallbackQuery: mockError,
      editMessageReplyMarkup: mockError,
      getFileLink: mockError,
      sendChatAction: async () => {},
    };
  }

  async function postWithRetry(endpoint, payload, axiosConfig = {}, { maxRetries = 2 } = {}) {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const response = await axios.post(`${apiBase}/${endpoint}`, payload, axiosConfig);
        return response?.data;
      } catch (error) {
        const classified = classifyTelegramSendError(error);
        if (classified.reason === "rate_limited" && attempt < maxRetries) {
          const retrySeconds = classified.retryAfterSeconds || 2;
          await sleep(Math.max(1, retrySeconds) * 1000);
          attempt += 1;
          continue;
        }
        throw error;
      }
    }
  }

  async function sendMessage(chatId, text, options = {}) {
    const { maxLength, maxRetries, parseMode, ...telegramOptions } = options;
    
    // Detectar si el texto ya contiene HTML válido
    const hasHtml = text && (text.includes('<b>') || text.includes('</b>') ||
                    text.includes('<i>') || text.includes('</i>') || 
                    text.includes('<code>') || text.includes('</code>') ||
                    text.includes('<a ') || text.includes('<pre>') || 
                    text.includes('<u>') || text.includes('</u>'));
    
    const parts = splitTelegramMessage(text, maxLength || maxMessageLength);

    // reply_markup (botones) solo debe ir en la ÚLTIMA parte de un mensaje
    // dividido, para no repetir los botones en cada fragmento.
    const { reply_markup, ...restOptions } = telegramOptions;

    // Devolvemos la respuesta de la ÚLTIMA parte (la que lleva los botones), para
    // que quien llama pueda asociar datos a su message_id.
    let lastResponse;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const markup = isLast && reply_markup ? { reply_markup } : {};
      try {
        lastResponse = await postWithRetry(
          "sendMessage",
          {
            chat_id: chatId,
            text: hasHtml ? part : formatTelegramHtml(part, false),
            parse_mode: parseMode || "HTML",
            ...restOptions,
            ...markup,
          },
          {},
          { maxRetries: maxRetries ?? 2 }
        );
      } catch (error) {
        // Si Telegram rechaza el formato (HTML malformado, p. ej. texto de
        // documentos con tags sueltos o un tag partido al dividir el mensaje),
        // reintentamos como TEXTO PLANO para garantizar que el mensaje llegue.
        if (!isTelegramParseError(error)) throw error;
        lastResponse = await postWithRetry(
          "sendMessage",
          {
            chat_id: chatId,
            text: stripHtmlTags(part),
            ...restOptions,
            ...markup,
          },
          {},
          { maxRetries: maxRetries ?? 2 }
        );
      }
      if (delayBetweenPartsMs > 0) {
        await sleep(delayBetweenPartsMs);
      }
    }
    return lastResponse;
  }

  function buildMediaCaption(caption) {
    const trimmed = typeof caption === "string" ? caption.trim() : "";
    if (!trimmed) return null;
    
    const hasHtml = trimmed.includes('<b>') || trimmed.includes('<i>') || 
                    trimmed.includes('<code>') || trimmed.includes('<a ');
    
    return {
      caption: formatTelegramHtml(trimmed, hasHtml),
      parse_mode: "HTML",
    };
  }

  async function sendMediaByRef(endpoint, field, chatId, ref, options = {}) {
    const captionPayload = buildMediaCaption(options.caption);
    await postWithRetry(
      endpoint,
      {
        chat_id: chatId,
        [field]: String(ref),
        ...(captionPayload || {}),
        ...(options.extra || {}),
      },
      {},
      { maxRetries: options.maxRetries ?? 2 }
    );
  }

  async function sendMediaByFile(endpoint, field, chatId, file, options = {}) {
    const filePath = file?.filePath;
    if (!filePath) {
      throw new Error("Missing filePath for media upload");
    }

    const form = new FormData();
    form.append("chat_id", String(chatId));

    const captionPayload = buildMediaCaption(options.caption);
    if (captionPayload?.caption) {
      form.append("caption", captionPayload.caption);
      form.append("parse_mode", "HTML");
    }

    if (options.extra && typeof options.extra === "object") {
      for (const [key, value] of Object.entries(options.extra)) {
        if (value === undefined || value === null) continue;
        form.append(key, typeof value === "string" ? value : String(value));
      }
    }

    const stream = fs.createReadStream(filePath);
    form.append(field, stream, {
      filename: file?.filename || "media",
      contentType: file?.mimetype || undefined,
    });

    await postWithRetry(
      endpoint,
      form,
      {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
      { maxRetries: options.maxRetries ?? 2 }
    );
  }

  async function sendPhoto(chatId, input, options = {}) {
    if (input && typeof input === "object" && input.filePath) {
      await sendMediaByFile("sendPhoto", "photo", chatId, input, options);
      return;
    }
    await sendMediaByRef("sendPhoto", "photo", chatId, input, options);
  }

  async function sendVideo(chatId, input, options = {}) {
    if (input && typeof input === "object" && input.filePath) {
      await sendMediaByFile("sendVideo", "video", chatId, input, options);
      return;
    }
    await sendMediaByRef("sendVideo", "video", chatId, input, options);
  }

  async function sendAudio(chatId, input, options = {}) {
    if (input && typeof input === "object" && input.filePath) {
      await sendMediaByFile("sendAudio", "audio", chatId, input, options);
      return;
    }
    await sendMediaByRef("sendAudio", "audio", chatId, input, options);
  }

  async function sendDocument(chatId, input, options = {}) {
    if (input && typeof input === "object" && input.filePath) {
      await sendMediaByFile("sendDocument", "document", chatId, input, options);
      return;
    }
    await sendMediaByRef("sendDocument", "document", chatId, input, options);
  }
  async function answerCallbackQuery(callbackQueryId, options = {}) {
    await postWithRetry(
      "answerCallbackQuery",
      {
        callback_query_id: callbackQueryId,
        ...options,
      },
      {},
      { maxRetries: 1 }
    );
  }

  async function editMessageReplyMarkup(replyMarkup, options = {}) {
    await postWithRetry(
      "editMessageReplyMarkup",
      {
        reply_markup: replyMarkup,
        ...options,
      },
      {},
      { maxRetries: 1 }
    );
  }

  // Resuelve la URL de descarga de un archivo de Telegram (voz, foto, documento)
  // a partir de su file_id. Necesario para transcribir notas de voz.
  async function getFileLink(fileId) {
    if (!fileId) return null;
    const data = await postWithRetry("getFile", { file_id: fileId }, {}, { maxRetries: 1 });
    const filePath = data?.result?.file_path;
    if (!filePath) return null;
    return `https://api.telegram.org/file/bot${resolvedToken}/${filePath}`;
  }

  // Muestra el indicador "escribiendo..." en el chat. No reintenta: es efímero
  // y no debe bloquear ni retrasar la respuesta real.
  async function sendChatAction(chatId, action = "typing") {
    try {
      await postWithRetry(
        "sendChatAction",
        { chat_id: chatId, action },
        {},
        { maxRetries: 0 }
      );
    } catch {
      // Silencioso: el indicador es decorativo.
    }
  }

  return {
    isConfigured: true,
    sendMessage,
    sendPhoto,
    sendVideo,
    sendAudio,
    sendDocument,
    answerCallbackQuery,
    editMessageReplyMarkup,
    getFileLink,
    sendChatAction,
  };
}
