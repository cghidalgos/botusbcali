// Categorización automática de preguntas

/**
 * Normaliza texto para búsqueda
 */
function normalizeForSearch(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Categorías disponibles con sus patrones de detección
 */
const CATEGORIES = {
  horarios: {
    keywords: ["horario", "hora", "cuando", "cuándo", "dia", "día", "jornada", "turno"],
    patterns: [/horario/i, /hora\s+de/i, /cuando\s+(es|tiene|hay)/i, /que\s+dia/i],
  },
  profesores: {
    keywords: ["profesor", "profe", "docente", "quien", "quién", "dicta", "imparte", "ensena", "enseña"],
    patterns: [/quien\s+(dicta|imparte|ensena|da)/i, /profesor\s+de/i, /docente\s+de/i],
  },
  becas: {
    keywords: ["beca", "becas", "descuento", "auxilio", "financiamiento", "costo", "matricula", "matrícula"],
    patterns: [/beca/i, /descuento/i, /auxilio/i, /costo\s+de/i, /precio\s+de/i],
  },
  programas: {
    keywords: ["programa", "carrera", "pregrado", "posgrado", "especializacion", "especialización", "maestria", "maestría"],
    patterns: [/programa\s+de/i, /carrera\s+de/i, /pregrado/i, /posgrado/i, /especializacion/i, /maestria/i],
  },
  admisiones: {
    keywords: ["inscripcion", "inscripción", "admision", "admisión", "requisito", "ingreso", "matricula", "nuevo"],
    patterns: [/como\s+(ingreso|entro|me\s+inscribo)/i, /requisito/i, /proceso\s+de\s+admision/i],
  },
  salones: {
    keywords: ["salon", "salón", "aula", "edificio", "bloque", "laboratorio", "espacio", "donde", "dónde", "ubicacion", "ubicación"],
    patterns: [/donde\s+(es|esta|queda)/i, /salon\s+/i, /aula\s+/i, /bloque\s+/i, /edificio/i],
  },
  materias: {
    keywords: ["materia", "asignatura", "curso", "credito", "crédito", "plan", "pensum", "pénsum"],
    patterns: [/materia/i, /asignatura/i, /curso\s+de/i, /plan\s+de\s+estudios/i, /pensum/i],
  },
  tramites: {
    keywords: ["tramite", "trámite", "certificado", "solicitud", "documento", "papele", "requisito"],
    patterns: [/tramite/i, /certificado/i, /solicitud\s+de/i, /como\s+solicito/i],
  },
  eventos: {
    keywords: ["evento", "conferencia", "taller", "seminario", "actividad", "congreso"],
    patterns: [/evento/i, /conferencia/i, /taller/i, /seminario/i, /actividad/i],
  },
  contacto: {
    keywords: ["contacto", "telefono", "teléfono", "correo", "email", "direccion", "dirección", "ubicacion", "ubicación"],
    patterns: [/contacto/i, /telefono/i, /correo/i, /como\s+(contacto|comunico)/i],
  },
};

/**
 * Detecta la categoría de una pregunta
 * @param {string} question - Pregunta a categorizar
 * @returns {string} - Nombre de la categoría detectada o "general"
 */
export function detectCategory(question) {
  const normalized = normalizeForSearch(question);
  const scores = {};
  
  // Inicializar scores
  for (const category of Object.keys(CATEGORIES)) {
    scores[category] = 0;
  }
  
  // Evaluar keywords
  for (const [category, config] of Object.entries(CATEGORIES)) {
    for (const keyword of config.keywords) {
      if (normalized.includes(keyword)) {
        scores[category] += 1;
      }
    }
    
    // Evaluar patterns (peso mayor)
    for (const pattern of config.patterns) {
      if (pattern.test(question)) {
        scores[category] += 2;
      }
    }
  }
  
  // Encontrar la categoría con mayor score
  let maxScore = 0;
  let bestCategory = "general";
  
  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }
  
  // Si el score es muy bajo, es general
  return maxScore > 0 ? bestCategory : "general";
}

/**
 * Obtiene todas las categorías disponibles
 */
export function getCategories() {
  return Object.keys(CATEGORIES).concat(["general"]);
}

/**
 * Obtiene información de una categoría
 */
export function getCategoryInfo(category) {
  return CATEGORIES[category] || null;
}
