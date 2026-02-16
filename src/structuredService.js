/**
 * Servicio de consultas estructuradas
 * Dinámico: maneja queries sobre cualquier categoría configurada
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getEnabledCategories, getCategoryConfig } from "./categoryManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "..", "data");

// Cache de datos
let dataCache = {};

/**
 * Inicializa cache de datos
 */
export async function initializeStructuredService() {
  await loadAllData();
}

/**
 * Carga todos los datos de todas las categorías
 */
async function loadAllData() {
  const categories = getEnabledCategories();
  
  for (const category of categories) {
    try {
      const config = getCategoryConfig(category);
      if (!config) continue;

      const filePath = path.join(dataPath, config.dataFile);
      const content = await fs.readFile(filePath, "utf-8");
      dataCache[category] = JSON.parse(content);
    } catch (error) {
      dataCache[category] = [];
    }
  }
}

/**
 * Carga datos de una categoría específica
 */
function loadDataFile(category) {
  if (dataCache[category]) {
    return dataCache[category];
  }

  const config = getCategoryConfig(category);
  if (!config) return [];

  try {
    const filePath = path.join(dataPath, config.dataFile);
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    dataCache[category] = data;
    return data;
  } catch (error) {
    console.error(`Error loading ${category}:`, error.message);
    return [];
  }
}

/**
 * Maneja una consulta estructurada dinámicamente
 * @param {string} question - La pregunta del usuario
 * @param {Object} intent - { type: string, keywords: string[] }
 * @returns {string|null} - Respuesta formateada o null
 */
export function handleStructuredQuery(question, intent) {
  if (!intent || !intent.type) {
    return null;
  }

  const category = intent.type;
  const config = getCategoryConfig(category);
  
  if (!config) {
    return null;
  }

  const normalizedQuestion = question.toLowerCase();
  const data = loadDataFile(category);

  if (!data || data.length === 0) {
    return null;
  }

  // Buscar item específico por palabras clave
  const itemFound = data.find((item) => {
    const nombre = item.nombre?.toLowerCase() || "";
    const id = item.id?.toLowerCase() || "";
    
    return (intent.keywords || []).some(kw => 
      nombre.includes(kw.toLowerCase()) || 
      id.includes(kw.toLowerCase())
    );
  });

  if (itemFound) {
    return formatItemResponse(itemFound, category, config);
  }

  // Si pregunta por lista/todos
  if (config.listPatterns && config.listPatterns.some(p => 
    normalizedQuestion.includes(p.toLowerCase())
  )) {
    return formatItemsList(data, category, config);
  }

  // Respuesta genérica con primeros items
  return formatItemsList(data.slice(0, 3), category, config, true);
}

/**
 * Formatea respuesta para un item específico
 */
function formatItemResponse(item, category, config) {
  const singular = config.singular || category.slice(0, -1);
  
  let response = `📌 *${singular.toUpperCase()}*\n\n`;
  
  // Mostrar campos principales
  if (item.nombre) {
    response += `*Nombre:* ${item.nombre}\n`;
  }
  if (item.email) {
    response += `*Email:* ${item.email}\n`;
  }
  if (item.telefono) {
    response += `*Teléfono:* ${item.telefono}\n`;
  }
  if (item.cargo) {
    response += `*Cargo:* ${item.cargo}\n`;
  }
  if (item.codigo) {
    response += `*Código:* ${item.codigo}\n`;
  }
  if (item.creditos) {
    response += `*Créditos:* ${item.creditos}\n`;
  }
  if (item.materias && Array.isArray(item.materias) && item.materias.length > 0) {
    response += `*Materias:* ${item.materias.join(", ")}\n`;
  }
  if (item.dias && Array.isArray(item.dias) && item.dias.length > 0) {
    response += `*Días:* ${item.dias.join(", ")}\n`;
  }
  if (item.horaInicio && item.horaFin) {
    response += `*Horario:* ${item.horaInicio} - ${item.horaFin}\n`;
  }
  if (item.salon) {
    response += `*Salón:* ${item.salon}\n`;
  }
  if (item.tipo) {
    response += `*Tipo:* ${item.tipo}\n`;
  }
  if (item.cobertura) {
    response += `*Cobertura:* ${item.cobertura}%\n`;
  }
  if (item.requisitos && Array.isArray(item.requisitos) && item.requisitos.length > 0) {
    response += `*Requisitos:*\n`;
    item.requisitos.forEach(req => {
      response += `  • ${req}\n`;
    });
  }

  return response;
}

/**
 * Formatea lista de items
 */
function formatItemsList(items, category, config, isPreview = false) {
  const plural = config.plural || category;
  const singular = config.singular || category.slice(0, -1);
  
  let response = `📋 *${plural.toUpperCase()}*\n\n`;
  
  if (isPreview) {
    response += `(Mostrando los primeros 3)\n\n`;
  }

  if (items.length === 0) {
    response += `No hay ${plural} disponibles.\n`;
    return response;
  }

  items.forEach((item, index) => {
    response += `${index + 1}. `;
    
    if (item.nombre) {
      response += `${item.nombre}`;
    } else if (item.id) {
      response += `${item.id}`;
    }

    // Agregar información secundaria
    if (item.codigo) {
      response += ` (${item.codigo})`;
    } else if (item.creditos) {
      response += ` - ${item.creditos} créditos`;
    } else if (item.cargo) {
      response += ` - ${item.cargo}`;
    } else if (item.tipo) {
      response += ` - ${item.tipo}`;
    } else if (item.horaInicio) {
      response += ` - ${item.horaInicio}`;
    }

    response += "\n";
  });

  if (isPreview) {
    response += `\n_Escribe "todos los ${plural}" para ver la lista completa._`;
  } else {
    response += `\n*Total: ${items.length} ${plural}*`;
  }

  return response;
}
