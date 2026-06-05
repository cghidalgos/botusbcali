// Programas de pregrado de la Facultad de Ingeniería (USB Cali).
// El "id" es corto para caber en callback_data de Telegram (límite 64 bytes).
// El "query" es lo que se le pasa al motor de respuestas al tocar el botón,
// de modo que reutiliza la base documental + conocimiento general.

export const PROGRAMS = [
  {
    id: "sistemas",
    label: "💻 Ing. de Sistemas",
    query: "Cuéntame sobre el programa de Ingeniería de Sistemas en la USB Cali: de qué trata, qué se estudia, áreas y campo laboral.",
  },
  {
    id: "industrial",
    label: "🏭 Ing. Industrial",
    query: "Cuéntame sobre el programa de Ingeniería Industrial en la USB Cali: de qué trata, qué se estudia, áreas y campo laboral.",
  },
  {
    id: "electronica",
    label: "🔌 Ing. Electrónica",
    query: "Cuéntame sobre el programa de Ingeniería Electrónica en la USB Cali: de qué trata, qué se estudia, áreas y campo laboral.",
  },
  {
    id: "biomedica",
    label: "🩺 Ing. Biomédica",
    query: "Cuéntame sobre el programa de Ingeniería Biomédica en la USB Cali: de qué trata, qué se estudia, áreas y campo laboral.",
  },
  {
    id: "multimedia",
    label: "🎮 Ing. Multimedia",
    query: "Cuéntame sobre el programa de Ingeniería Multimedia en la USB Cali: de qué trata, qué se estudia, áreas y campo laboral.",
  },
  {
    id: "agroindustrial",
    label: "🌾 Ing. Agroindustrial",
    query: "Cuéntame sobre el programa de Ingeniería Agroindustrial en la USB Cali: de qué trata, qué se estudia, áreas y campo laboral.",
  },
];

export function getProgramById(id) {
  return PROGRAMS.find((p) => p.id === id) || null;
}

/**
 * Teclado inline de Telegram con los programas (2 columnas).
 */
export function buildProgramsKeyboard() {
  const rows = [];
  for (let i = 0; i < PROGRAMS.length; i += 2) {
    const row = PROGRAMS.slice(i, i + 2).map((p) => ({
      text: p.label,
      callback_data: `prog_${p.id}`,
    }));
    rows.push(row);
  }
  return { inline_keyboard: rows };
}
