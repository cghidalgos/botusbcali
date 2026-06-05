import OpenAI from "openai";
import { toFile } from "openai";
import axios from "axios";

// Límite de Whisper (25 MB). Las notas de voz de Telegram son OGG/OPUS muy
// comprimidas, así que en la práctica nunca se acercan, pero validamos por si
// llega un audio largo subido como archivo.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * Descarga un audio desde una URL de Telegram y lo transcribe con Whisper.
 * Devuelve el texto reconocido (string) o "" si no se pudo transcribir.
 *
 * Usa la misma OPENAI_API_KEY que ya alimenta los embeddings, así que no
 * requiere configurar ningún proveedor adicional.
 */
export async function transcribeAudioFromUrl(fileUrl, { apiKey, language = "es" } = {}) {
  if (!fileUrl) return "";
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY no configurada: la transcripción de voz no está disponible");
  }

  const download = await axios.get(fileUrl, {
    responseType: "arraybuffer",
    maxContentLength: MAX_AUDIO_BYTES,
    timeout: 30000,
  });
  const buffer = Buffer.from(download.data);
  if (buffer.length > MAX_AUDIO_BYTES) {
    throw new Error("El audio supera el límite de 25 MB de transcripción");
  }

  const client = new OpenAI({ apiKey: key });
  const model = process.env.WHISPER_MODEL || "whisper-1";
  // El nombre con extensión es obligatorio para que la API infiera el formato.
  const file = await toFile(buffer, "voice.ogg");

  const result = await client.audio.transcriptions.create({
    file,
    model,
    language,
  });

  return result?.text?.trim() || "";
}
