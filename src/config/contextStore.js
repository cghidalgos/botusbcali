import fs from "fs/promises";
import path from "path";
import { DEFAULT_BOT_ID, normalizeBotId } from "./botContext.js";

const dataDir = path.resolve(process.cwd(), "data");
const contextPath = path.join(dataDir, "context.json");

const DEFAULT_CONTEXT = {
  activePrompt:
    "Eres un Asistente que se llama FacIng y eres cordial, y atiendes a los usuarios de manera amable. \nRespondes  todo sobre la facultad de ingeniería  (costos, eventos, salones, profesores, etc). Si no encuentras alg, menciona que estas en proceso de aprenderlo.",
  additionalNotes:
    "No inventes costos ni valores. Cita el programa y el año cuando aparezca en el texto.",
};

const EMPTY_CONTEXT = {
  activePrompt: "",
  additionalNotes: "",
  promptTemplate: "",
};

const contextState = {};

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function loadContext() {
  try {
    const raw = await fs.readFile(contextPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      if (typeof parsed.activePrompt === "string" || typeof parsed.additionalNotes === "string") {
        contextState[DEFAULT_BOT_ID] = {
          ...DEFAULT_CONTEXT,
          ...(typeof parsed.activePrompt === "string" ? { activePrompt: parsed.activePrompt } : {}),
          ...(typeof parsed.additionalNotes === "string" ? { additionalNotes: parsed.additionalNotes } : {}),
        };
      } else {
        for (const [botId, value] of Object.entries(parsed)) {
          if (!value || typeof value !== "object") continue;
          const resolved = normalizeBotId(botId);
          const base = resolved === DEFAULT_BOT_ID ? DEFAULT_CONTEXT : EMPTY_CONTEXT;
          contextState[normalizeBotId(botId)] = {
            ...base,
            ...(typeof value.activePrompt === "string" ? { activePrompt: value.activePrompt } : {}),
            ...(typeof value.additionalNotes === "string" ? { additionalNotes: value.additionalNotes } : {}),
            ...(typeof value.promptTemplate === "string" ? { promptTemplate: value.promptTemplate } : {}),
          };
        }
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("No se pudo cargar contexto", error);
    }
  }

  if (!contextState[DEFAULT_BOT_ID]) {
    contextState[DEFAULT_BOT_ID] = { ...DEFAULT_CONTEXT };
  }
}

async function persistContext() {
  try {
    await ensureDataDir();
    await fs.writeFile(contextPath, JSON.stringify(contextState, null, 2), "utf8");
  } catch (error) {
    console.error("No se pudo guardar contexto", error);
  }
}

export const contextReady = loadContext();

export function getContextState(botId) {
  const resolved = normalizeBotId(botId);
  if (contextState[resolved]) return { ...contextState[resolved] };
  if (resolved === DEFAULT_BOT_ID) return { ...DEFAULT_CONTEXT };
  return { ...EMPTY_CONTEXT };
}

export function updatePrompt(botId, newPrompt) {
  const resolved = normalizeBotId(botId);
  const base = contextState[resolved]
    || (resolved === DEFAULT_BOT_ID ? DEFAULT_CONTEXT : EMPTY_CONTEXT);
  contextState[resolved] = { ...base, activePrompt: newPrompt };
  persistContext();
}

export function updateAdditionalNotes(botId, notes) {
  const resolved = normalizeBotId(botId);
  const base = contextState[resolved]
    || (resolved === DEFAULT_BOT_ID ? DEFAULT_CONTEXT : EMPTY_CONTEXT);
  contextState[resolved] = { ...base, additionalNotes: notes };
  persistContext();
}

