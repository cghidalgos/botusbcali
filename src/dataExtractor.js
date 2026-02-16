/**
 * Extrae datos estructurados de documentos (HTML, PDF)
 * Dinámico: lee categorías desde config/categories.json
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getEnabledCategories, getCategoryConfig } from "./categoryManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "..", "data");

// Cache en memoria (dinámico)
let dataCache = {};

/**
 * Inicializa el cache basado en categorías habilitadas
 */
function initializeCache() {
  const categories = getEnabledCategories();
  dataCache = {};
  for (const cat of categories) {
    dataCache[cat] = [];
  }
}

/**
 * Carga datos existentes
 */
async function loadExistingData() {
  const categories = getEnabledCategories();
  
  for (const category of categories) {
    try {
      const config = getCategoryConfig(category);
      const filePath = path.join(dataPath, config.dataFile);
      const content = await fs.readFile(filePath, "utf-8");
      dataCache[category] = JSON.parse(content);
    } catch (error) {
      dataCache[category] = [];
    }
  }
}

/**
 * Guarda datos a JSON
 */
async function saveData(categoryName, data) {
  try {
    const config = getCategoryConfig(categoryName);
    if (!config) return false;

    await fs.mkdir(dataPath, { recursive: true });
    
    // Eliminar duplicados por ID o nombre
    const unique = Array.from(new Map(
      data.map(item => [item.id || item.nombre || item.email, item])
    ).values());
    
    await fs.writeFile(
      path.join(dataPath, config.dataFile),
      JSON.stringify(unique, null, 2),
      "utf-8"
    );
    dataCache[categoryName] = unique;
    console.log(`[DATA] ✓ Guardados ${unique.length} registros en ${config.dataFile}`);
    return true;
  } catch (error) {
    console.error(`[DATA] Error guardando ${categoryName}:`, error.message);
    return false;
  }
}

/**
 * Extrae datos generales de una categoría usando sus patrones
 */
function extractFromCategory(text, categoryName, config) {
  const extracted = [];
  
  if (!config.keywords || !config.patterns) {
    return extracted;
  }

  // Combinar todos los keywords en un patrón
  const keywordPattern = new RegExp(
    `(?:${config.keywords.join("|")})\\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ\\s]+?)(?:\\s*-|\\s*\\(|\\s*,|\\s*\\[|$)`,
    "gi"
  );

  let match;
  const seen = new Set();
  
  while ((match = keywordPattern.exec(text)) !== null) {
    const nombre = match[1]?.trim().toLowerCase();
    
    // Filtro de calidad
    if (nombre && nombre.length > 3 && !seen.has(nombre) && 
        !nombre.match(/^\d+|solo|lista|todos|profesor|materia/i)) {
      
      const nombreCapitalizado = nombre
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      
      const item = {
        id: nombreCapitalizado.toLowerCase().replace(/\s+/g, "-"),
        nombre: nombreCapitalizado,
        // Campos adicionales según schema
        ...Object.keys(config.schema || {}).reduce((acc, key) => {
          if (key !== "id" && key !== "nombre") {
            acc[key] = key.includes("array") ? [] : null;
          }
          return acc;
        }, {})
      };
      
      extracted.push(item);
      seen.add(nombre);
    }
  }

  return extracted;
}

/**
 * Extrae datos especiales: horarios (con horas), etc.
 */
function extractHorarios(text) {
  const horarios = [];
  const diasSemana = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const lines = text.split("\n");
  
  for (const line of lines) {
    const diaMatch = line.match(new RegExp(`(${diasSemana.join("|")})`, "i"));
    const horaMatch = line.match(/(\d{1,2}):(\d{2})\s*(?:a|-|hasta)\s*(\d{1,2}):(\d{2})/i);
    
    if (diaMatch && horaMatch) {
      horarios.push({
        id: `horario-${horarios.length}`,
        materia: "",
        profesor: "",
        dias: [diaMatch[1].toLowerCase()],
        horaInicio: `${horaMatch[1]}:${horaMatch[2]}`,
        horaFin: `${horaMatch[3]}:${horaMatch[4]}`,
        salon: "",
      });
    }
  }

  return horarios;
}

/**
 * Extrae y actualiza todos los datos de un documento
 */
export async function extractAndUpdateDataFromDocument(extractedText, documentName = "Documento") {
  try {
    initializeCache();
    await loadExistingData();
    
    console.log(`[DATA] Extrayendo datos de: ${documentName}`);

    const results = {};
    const categories = getEnabledCategories();

    // Extraer para cada categoría habilitada
    for (const category of categories) {
      const config = getCategoryConfig(category);
      
      let extracted = [];
      
      // Manejo especial para horarios
      if (category === "horarios") {
        extracted = extractHorarios(extractedText);
      } else {
        extracted = extractFromCategory(extractedText, category, config);
      }

      // Actualizar si hay resultados
      if (extracted.length > 0) {
        dataCache[category] = [...(dataCache[category] || []), ...extracted];
        await saveData(category, dataCache[category]);
        results[category] = extracted.length;
      } else {
        results[category] = 0;
      }
    }

    return results;
  } catch (error) {
    console.error("[DATA] Error extrayendo datos:", error.message);
    return null;
  }
}

/**
 * Inicializa los datos al cargar el módulo
 */
export async function initializeData() {
  initializeCache();
  await loadExistingData();
  console.log("[DATA] ✓ Datos inicializados");
}
