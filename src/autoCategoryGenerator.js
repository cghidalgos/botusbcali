/**
 * Auto Category Generator
 * Detects unclassified questions and suggests new categories
 * Stores suggested categories separately for admin approval
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUGGEST_FILE = path.join(__dirname, '../data/suggested-categories.json');

// Ensure suggested categories file exists
function initSuggestedCategories() {
  if (!fs.existsSync(SUGGEST_FILE)) {
    fs.writeFileSync(SUGGEST_FILE, JSON.stringify([], null, 2));
  }
}

// Load suggested categories
function getSuggestedCategories() {
  try {
    const data = fs.readFileSync(SUGGEST_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// Save suggested categories
function saveSuggestedCategories(categories) {
  fs.writeFileSync(SUGGEST_FILE, JSON.stringify(categories, null, 2));
}

// Extract keywords from question
function extractKeywordsFromQuestion(question) {
  // Remove common words
  const commonWords = ['como', 'es', 'que', 'cual', 'cuales', 'donde', 'cuando', 'por', 'para', 'si', 'no', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'este', 'ese', 'aquello', 'me', 'mi', 'te', 'se'];
  
  const words = question.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !commonWords.includes(w));

  return [...new Set(words)]; // Remove duplicates
}

// Extract patterns from question
function extractPatternFromQuestion(question) {
  // Try to identify what's being asked
  const lowerQ = question.toLowerCase();
  
  // Patterns for common structures
  if (lowerQ.includes('todos los') || lowerQ.includes('lista de') || lowerQ.includes('cuales son') || lowerQ.includes('dame todos')) {
    return 'lista';
  }
  if (lowerQ.includes('cuando') || lowerQ.includes('que hora') || lowerQ.includes('horario')) {
    return 'horario';
  }
  if (lowerQ.includes('cuanto') || lowerQ.includes('precio') || lowerQ.includes('costo')) {
    return 'cantidad';
  }
  if (lowerQ.includes('informacion') || lowerQ.includes('detalles') || lowerQ.includes('quien')) {
    return 'detalle';
  }
  
  return 'consulta';
}

// Generate a suggested category from a question
function generateSuggestedCategory(question, userId) {
  const keywords = extractKeywordsFromQuestion(question);
  const pattern = extractPatternFromQuestion(question);
  
  if (keywords.length === 0) {
    return null; // Not enough information to suggest
  }

  const categoryName = keywords[0]; // Use first meaningful word as category name
  
  const suggested = {
    id: Date.now().toString(),
    name: categoryName,
    displayName: categoryName.charAt(0).toUpperCase() + categoryName.slice(1),
    question: question, // Original question that triggered this
    keywords: keywords,
    pattern: pattern,
    userId: userId, // User who asked the question
    createdAt: new Date().toISOString(),
    status: 'pending', // pending | approved | rejected
    approvedBy: null,
    approvedAt: null,
    extractionPattern: `//\\b(${keywords.join('|')})\\b//gi`, // Simple regex pattern
    schema: {
      name: 'string',
      description: 'string',
      details: 'object'
    },
    enabled: false // Disabled until approved
  };

  return suggested;
}

// Add or update a suggested category
function addSuggestedCategory(question, userId) {
  initSuggestedCategories();
  
  const suggested = generateSuggestedCategory(question, userId);
  if (!suggested) {
    return null;
  }

  const current = getSuggestedCategories();
  
  // Check if similar category already exists
  const existing = current.find(c => 
    c.name === suggested.name || 
    (c.keywords && c.keywords.some(kw => suggested.keywords.includes(kw)))
  );

  if (existing) {
    // Increment counter if suggestion already exists
    existing.count = (existing.count || 1) + 1;
    existing.lastQuestion = question;
    existing.lastAskedAt = new Date().toISOString();
    saveSuggestedCategories(current);
    return existing.id;
  }

  // Add new suggestion
  current.push(suggested);
  saveSuggestedCategories(current);
  return suggested.id;
}

// Get all suggested categories
function getAllSuggested() {
  initSuggestedCategories();
  return getSuggestedCategories();
}

// Get pending suggested categories
function getPendingSuggested() {
  return getAllSuggested().filter(c => c.status === 'pending');
}

// Approve a suggested category (convert to actual category)
function approveSuggested(id, approverUserId) {
  const categories = getAllSuggested();
  const index = categories.findIndex(c => c.id === id);
  
  if (index === -1) return null;
  
  categories[index].status = 'approved';
  categories[index].approvedBy = approverUserId;
  categories[index].approvedAt = new Date().toISOString();
  categories[index].enabled = true;
  
  saveSuggestedCategories(categories);
  return categories[index];
}

// Reject a suggested category
function rejectSuggested(id) {
  const categories = getAllSuggested();
  const index = categories.findIndex(c => c.id === id);
  
  if (index === -1) return null;
  
  categories[index].status = 'rejected';
  saveSuggestedCategories(categories);
  return categories[index];
}

// Update a suggested category
function updateSuggested(id, updates) {
  const categories = getAllSuggested();
  const index = categories.findIndex(c => c.id === id);
  
  if (index === -1) return null;
  
  categories[index] = { ...categories[index], ...updates, updatedAt: new Date().toISOString() };
  saveSuggestedCategories(categories);
  return categories[index];
}

// Delete a suggested category
function deleteSuggested(id) {
  const categories = getAllSuggested();
  const filtered = categories.filter(c => c.id !== id);
  saveSuggestedCategories(filtered);
  return true;
}

export {
  initSuggestedCategories,
  generateSuggestedCategory,
  addSuggestedCategory,
  getAllSuggested,
  getPendingSuggested,
  approveSuggested,
  rejectSuggested,
  updateSuggested,
  deleteSuggested,
  extractKeywordsFromQuestion,
  extractPatternFromQuestion
};
