// Parser dedicado para el archivo "Horarios" en formato TSV (separado por tabs).
// Columnas esperadas:
//   Nº Clase | ID Catálogo/Clase/materia | Nombre Clase/Materia |
//   Hora Inicial Clase | Hora Final Clase | Día |
//   Lunes | Martes | Miercoles | Jueves | Viernes | Sabado |
//   Aula | Desc. Tema Curso | Nombre | Correo-profesor

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleCase(value) {
  return String(value || "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ")
    .trim();
}

// "ACOSTA RIOS,MARIO FERNANDO" -> "Mario Fernando Acosta Rios"
function formatProfessorName(raw) {
  const cleaned = String(raw || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.includes(",")) {
    const [apellidos, nombres] = cleaned.split(",").map((p) => p.trim());
    if (apellidos && nombres) {
      return toTitleCase(`${nombres} ${apellidos}`);
    }
  }
  return toTitleCase(cleaned);
}

/**
 * Detecta si un texto extraído corresponde al documento de horarios.
 */
export function isScheduleText(text) {
  const head = normalize(String(text || "").slice(0, 800));
  return (
    head.includes("hora inicial clase") &&
    (head.includes("correo profesor") || head.includes("correo-profesor") || head.includes("correoprofesor"))
  );
}

/**
 * Parsea el TSV de horarios a filas estructuradas.
 */
export function parseScheduleRows(text) {
  const raw = String(text || "");
  if (!raw) return [];
  const lines = raw.split(/\r?\n/);

  // Localizar la línea de encabezado.
  let headerIdx = -1;
  let headers = [];
  for (let i = 0; i < lines.length; i += 1) {
    const norm = normalize(lines[i]);
    if (norm.includes("hora inicial clase") && norm.includes("aula")) {
      headers = lines[i].split("\t").map((h) => normalize(h));
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const findCol = (...needles) => {
    for (const needle of needles) {
      const n = normalize(needle);
      const idx = headers.findIndex((h) => h === n || h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const idx = {
    classId: findCol("n clase", "no clase", "numero clase", "n clase"),
    catalogId: findCol("id catalogo", "id catalogo clase materia", "id catalogo/clase/materia"),
    course: findCol("nombre clase materia", "nombre clase", "nombre materia"),
    start: findCol("hora inicial clase", "hora inicial"),
    end: findCol("hora final clase", "hora final"),
    day: findCol("dia"),
    room: findCol("aula"),
    professor: findCol("nombre"),
    email: findCol("correo profesor", "correo-profesor", "correo"),
  };

  // La columna "Nombre" (profesor) puede colisionar con "Nombre Clase/Materia".
  // El profesor es la penúltima columna (antes del correo); ajustamos si es necesario.
  if (idx.email >= 0 && (idx.professor < 0 || idx.professor === idx.course)) {
    idx.professor = idx.email - 1;
  }

  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || !line.includes("\t")) continue;
    const f = line.split("\t");
    const get = (col) => (col >= 0 && f[col] != null ? String(f[col]).trim() : "");

    const professor = get(idx.professor);
    const email = get(idx.email);
    if (!professor && !email) continue;

    const course = get(idx.course);
    if (!course) continue;

    rows.push({
      classId: get(idx.classId),
      catalogId: get(idx.catalogId),
      course: course.replace(/\s+/g, " ").trim(),
      start: get(idx.start),
      end: get(idx.end),
      day: get(idx.day),
      room: get(idx.room),
      professor,
      professorName: formatProfessorName(professor),
      email: email.toUpperCase(),
    });
  }
  return rows;
}

/**
 * Dado el texto de la pregunta, extrae los tokens que probablemente son el
 * nombre del profesor (quita palabras de relleno).
 */
export function extractProfessorQueryTokens(question) {
  const fillers = new Set([
    "horario", "horarios", "hora", "horas", "clase", "clases", "materia", "materias",
    "curso", "cursos", "asignatura", "asignaturas", "dicta", "dictan", "imparte",
    "ensena", "enseña", "da", "dan", "profe", "profes", "profesor", "profesora",
    "profesores", "docente", "docentes", "del", "de", "la", "el", "los", "las",
    "un", "una", "que", "cual", "cuales", "quien", "quienes", "cuando", "donde",
    "como", "a", "y", "en", "por", "para", "con", "se", "tiene", "tienen", "sobre",
    "me", "dame", "dime", "muestra", "muestrame", "necesito", "quiero", "saber",
    "informacion", "info", "es", "su", "sus", "al", "todo", "toda", "todos",
    "correo", "email", "mail", "contacto", "contactar", "telefono", "numero",
  ]);
  return normalize(question)
    .split(" ")
    .filter((t) => t.length > 1 && !fillers.has(t));
}

/**
 * Busca las filas de un profesor por coincidencia de tokens de nombre.
 * Devuelve { professorName, email, rows } del mejor candidato, o null.
 */
export function findProfessorSchedule(rows, queryTokens) {
  if (!rows.length || !queryTokens.length) return null;

  // Agrupar filas por profesor (clave normalizada).
  const byProfessor = new Map();
  for (const row of rows) {
    const key = normalize(row.professor);
    if (!key) continue;
    if (!byProfessor.has(key)) {
      byProfessor.set(key, { professorName: row.professorName, email: row.email, key, rows: [] });
    }
    byProfessor.get(key).rows.push(row);
  }

  // Puntuar cada profesor por cuántos tokens del query aparecen en su nombre.
  let best = null;
  for (const entry of byProfessor.values()) {
    const haystack = entry.key; // nombre normalizado del profesor
    const matched = queryTokens.filter((t) => haystack.includes(t)).length;
    if (matched === 0) continue;
    const score = matched / queryTokens.length;
    if (!best || matched > best.matched || (matched === best.matched && score > best.score)) {
      best = { ...entry, matched, score };
    }
  }

  // Exigir que al menos un token de nombre coincida (apellido o nombre).
  if (!best || best.matched < 1) return null;
  return best;
}

/**
 * Construye una respuesta legible del horario de un profesor.
 */
export function formatProfessorScheduleAnswer(professor) {
  const { professorName, email, rows } = professor;

  // Agrupar por materia (course + catalogId).
  const courses = new Map();
  for (const row of rows) {
    const key = `${row.course}||${row.catalogId}`;
    if (!courses.has(key)) {
      courses.set(key, { course: row.course, catalogId: row.catalogId, sessions: [] });
    }
    courses.get(key).sessions.push(row);
  }

  const lines = [];
  lines.push(`Horario de ${professorName}:`);
  if (email) lines.push(`Correo: ${email}`);
  lines.push("");

  for (const { course, catalogId, sessions } of courses.values()) {
    const titleCourse = toTitleCase(course);
    lines.push(`- ${titleCourse}${catalogId ? ` (${catalogId})` : ""}`);
    const seen = new Set();
    for (const s of sessions) {
      const day = s.day ? toTitleCase(s.day) : "";
      const time = s.start && s.end ? `${s.start} a ${s.end}` : (s.start || "");
      const room = s.room ? ` en ${s.room}` : "";
      const detail = [day, time].filter(Boolean).join(" de ");
      const key = `${detail}|${room}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (detail || room) {
        lines.push(`   • ${detail}${room}`.replace(/\s+$/g, ""));
      }
    }
  }

  return lines.join("\n").trim();
}

/**
 * Detecta si la pregunta es solo sobre el contacto (correo, email, teléfono)
 * del profesor, en cuyo caso respondemos de forma concisa.
 */
export function isContactQuery(question) {
  return /\b(correo|email|e-mail|mail|contacto|contactar|telefono|teléfono)\b/i.test(
    String(question || "")
  );
}

/**
 * Respuesta concisa de contacto: nombre + correo + materias que dicta (breve).
 */
export function formatProfessorContactAnswer(professor) {
  const { professorName, email, rows } = professor;
  const lines = [];
  if (email) {
    lines.push(`El correo de ${professorName} es ${email}.`);
  } else {
    lines.push(`No encontré un correo registrado para ${professorName}.`);
  }
  const courses = Array.from(new Set(rows.map((r) => toTitleCase(r.course)))).slice(0, 8);
  if (courses.length) {
    lines.push("");
    lines.push("Materias que dicta:");
    courses.forEach((c) => lines.push(`- ${c}`));
  }
  return lines.join("\n").trim();
}

/**
 * Punto de entrada: dado el texto del horario y la pregunta, devuelve la
 * respuesta formateada o null si no aplica / no encuentra al profesor.
 */
export function answerProfessorSchedule(scheduleText, question) {
  const rows = parseScheduleRows(scheduleText);
  if (!rows.length) return null;
  const tokens = extractProfessorQueryTokens(question);
  if (!tokens.length) return null;
  const professor = findProfessorSchedule(rows, tokens);
  if (!professor) return null;
  // Si solo preguntan por el contacto, responder breve con el correo.
  if (isContactQuery(question)) {
    return formatProfessorContactAnswer(professor);
  }
  return formatProfessorScheduleAnswer(professor);
}
