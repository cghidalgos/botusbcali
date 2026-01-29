import fs from "fs/promises";
import path from "path";

const dataDir = path.resolve(process.cwd(), "data");
const contextPath = path.join(dataDir, "context.json");

const contextState = {
  activePrompt: "Eres un Asistente que se llama FacIng y eres cordial, y atiendes a los usuarios de manera amable. \nRespondes  todo sobre la facultad de ingeniería  (costos, eventos, salones, profesores, etc). Si no encuentras alg, menciona que estas en proceso de aprenderlo.",
  additionalNotes: "No inventes costos ni valores. Cita el programa y el año cuando aparezca en el texto.",
  promptTemplate:
    "Actúa como un asistente experto en las instrucciones provistas.\n" +
    "Responde con información de costos del año 2026.  no muestres del 2025.\n" +
    "Responde en texto plano, sin Markdown ni encabezados.",
};

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function loadContext() {
  try {
    const raw = await fs.readFile(contextPath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.activePrompt === "string") {
      contextState.activePrompt = parsed.activePrompt;
    }
    if (typeof parsed.additionalNotes === "string") {
      contextState.additionalNotes = parsed.additionalNotes;
    }
    if (typeof parsed.promptTemplate === "string") {
      contextState.promptTemplate = parsed.promptTemplate;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("No se pudo cargar contexto", error);
    }
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

export function getContextState() {
  return { ...contextState };
}

export function updatePrompt(newPrompt) {
  contextState.activePrompt = newPrompt;
  persistContext();
}

export function updateAdditionalNotes(notes) {
  contextState.additionalNotes = notes;
  persistContext();
}

export function updatePromptTemplate(template) {
  contextState.promptTemplate = template;
  persistContext();
}
