// Correcciones de texto aplicadas a TODAS las respuestas del bot antes de
// enviarlas. Útil para corregir nombres mal escritos en los documentos fuente
// (que el modelo podría reproducir) sin tener que editar los documentos.
//
// Para agregar una corrección, añade una entrada { wrong, right }.
// "wrong" es una expresión regular (usa \b para límites de palabra).

const CORRECTIONS = [
  // El nombre correcto del docente es "Betancur", no "Betancurth".
  { wrong: /\bBetancurth\b/gi, right: "Betancur" },
];

/**
 * Aplica todas las correcciones de texto a una respuesta.
 */
export function applyCorrections(text) {
  let out = String(text || "");
  if (!out) return out;
  for (const { wrong, right } of CORRECTIONS) {
    out = out.replace(wrong, right);
  }
  return out;
}
