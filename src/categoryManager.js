/**
 * Gestor dinámico de categorías
 * Lee categorías desde config/categories.json
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "..", "config", "categories.json");

let categoriesConfig = {};

/**
 * Carga la configuración de categorías
 */
export async function loadCategories() {
  try {
    const content = await fs.readFile(configPath, "utf-8");
    categoriesConfig = JSON.parse(content);
    console.log(`[CATEGORIES] ✓ Cargadas ${Object.keys(categoriesConfig).length} categorías`);
    return categoriesConfig;
  } catch (error) {
    console.error("[CATEGORIES] Error cargando configuración:", error.message);
    return {};
  }
}

/**
 * Obtiene todas las categorías habilitadas
 */
export function getEnabledCategories() {
  return Object.entries(categoriesConfig)
    .filter(([, config]) => config.enabled)
    .map(([name]) => name);
}

/**
 * Obtiene configuración de una categoría específica
 */
export function getCategoryConfig(categoryName) {
  return categoriesConfig[categoryName] || null;
}

/**
 * Obtiene todas las keywords de todas las categorías
 */
export function getAllKeywords() {
  const keywords = {};
  for (const [name, config] of Object.entries(categoriesConfig)) {
    if (config.enabled) {
      keywords[name] = config.keywords || [];
    }
  }
  return keywords;
}

/**
 * Obtiene todos los patrones de todas las categorías
 */
export function getAllPatterns() {
  const patterns = {};
  for (const [name, config] of Object.entries(categoriesConfig)) {
    if (config.enabled) {
      patterns[name] = config.patterns || [];
    }
  }
  return patterns;
}

/**
 * Obtiene configuración para crear una nueva categoría
 */
export function getNewCategoryTemplate() {
  return {
    enabled: true,
    singular: "item",
    plural: "items",
    dataFile: "items.json",
    keywords: ["keyword1", "keyword2"],
    patterns: ["patrón regex 1", "patrón regex 2"],
    listPatterns: ["todos", "lista", "ver todos"],
    schema: {
      id: "string",
      nombre: "string"
    }
  };
}

/**
 * Agrega una nueva categoría a la configuración
 */
export async function addCategory(categoryName, categoryConfig) {
  try {
    categoriesConfig[categoryName] = categoryConfig;
    await fs.writeFile(
      configPath,
      JSON.stringify(categoriesConfig, null, 2),
      "utf-8"
    );
    console.log(`[CATEGORIES] ✓ Categoría "${categoryName}" agregada`);
    return true;
  } catch (error) {
    console.error(`[CATEGORIES] Error agregando categoría:`, error.message);
    return false;
  }
}

/**
 * Actualiza una categoría existente
 */
export async function updateCategory(categoryName, partialConfig) {
  try {
    if (!categoriesConfig[categoryName]) {
      throw new Error(`Categoría "${categoryName}" no existe`);
    }
    categoriesConfig[categoryName] = {
      ...categoriesConfig[categoryName],
      ...partialConfig
    };
    await fs.writeFile(
      configPath,
      JSON.stringify(categoriesConfig, null, 2),
      "utf-8"
    );
    console.log(`[CATEGORIES] ✓ Categoría "${categoryName}" actualizada`);
    return true;
  } catch (error) {
    console.error(`[CATEGORIES] Error actualizando categoría:`, error.message);
    return false;
  }
}

/**
 * Elimina una categoría
 */
export async function removeCategory(categoryName) {
  try {
    delete categoriesConfig[categoryName];
    await fs.writeFile(
      configPath,
      JSON.stringify(categoriesConfig, null, 2),
      "utf-8"
    );
    console.log(`[CATEGORIES] ✓ Categoría "${categoryName}" eliminada`);
    return true;
  } catch (error) {
    console.error(`[CATEGORIES] Error eliminando categoría:`, error.message);
    return false;
  }
}

/**
 * Obtiene la información actual (para inspección)
 */
export function getCategoriesInfo() {
  return {
    total: Object.keys(categoriesConfig).length,
    enabled: getEnabledCategories().length,
    categories: Object.keys(categoriesConfig).map(name => ({
      name,
      enabled: categoriesConfig[name].enabled,
      keywordsCount: (categoriesConfig[name].keywords || []).length,
      patternsCount: (categoriesConfig[name].patterns || []).length
    }))
  };
}
