type HttpMethod = "GET" | "POST" | "DELETE";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "same-origin",
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export interface ContextData {
  activePrompt: string;
  additionalNotes: string;
}

export interface DocumentEntry {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  status: "uploaded" | "processing" | "extracting" | "ready" | "error";
  progress?: number;
  stage?: string;
  manualSummary?: string;
  autoSummary?: string;
  extractedText?: string;
  createdAt: string;
  processedAt?: string | null;
  sourceUrl?: string | null;
}

export interface HistoryEntry {
  question: string;
  answer: string;
  timestamp: string | number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  usedEntries: number;
  avgHitsPerEntry: number;
  estimatedSavings: {
    apiCalls: number;
    dollars: number;
  };
}

export interface LearningStats {
  totalPatterns: number;
  byCategory: Record<string, number>;
}

export interface LearningPattern {
  id: string;
  question: string;
  frequency: number;
  category: string;
  firstAsked: string;
  lastAsked: string;
  addedToTraining: boolean;
  answer?: string | null;
}

export interface ProfileStats {
  totalUsers: number;
  usersWithNames: number;
  activeUsers: number;
}

export interface UserProfile {
  chatId: string | number;
  username?: string;
  firstName?: string;
  lastName?: string;
  type?: string;
  firstInteractionAt?: string;
  lastInteractionAt?: string;
  isBlocked: boolean;
  blockedAt?: string | null;
  lastError?: string | null;
  messageCount?: number;
  updatedAt?: string;
  createdAt?: string;
}

export interface CategoryInfo {
  name: string;
  displayName?: string;
  enabled: boolean;
  keywords?: string[];
  keywordsCount?: number;
  patternsCount?: number;
}

export interface SuggestedCategory {
  id: string;
  name: string;
  displayName: string;
  question: string;
  keywords: string[];
  pattern: string;
  userId: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  approvedBy?: string | null;
  approvedAt?: string | null;
  count?: number;
  lastQuestion?: string;
  lastAskedAt?: string;
  extractionPattern?: string;
  schema?: Record<string, string>;
  enabled?: boolean;
}

export interface CategoriesResponse {
  total?: number;
  enabled?: number;
  categories?: CategoryInfo[];
}

export interface SuggestedCategoriesResponse {
  suggested?: SuggestedCategory[];
  pending?: SuggestedCategory[];
}

export async function getConfig(): Promise<{ context: ContextData; documents: DocumentEntry[] }> {
  return request("/api/config");
}

export async function updateConfig(payload: ContextData): Promise<ContextData> {
  return request("/api/config/context", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getDocuments(): Promise<DocumentEntry[]> {
  return request("/api/documents");
}

export async function uploadDocument(file: File, summary: string): Promise<DocumentEntry[]> {
  const form = new FormData();
  form.append("document", file);
  if (summary) {
    form.append("summary", summary);
  }

  return request("/api/documents", {
    method: "POST",
    body: form,
  });
}

export async function uploadDocumentUrl(url: string, summary: string): Promise<DocumentEntry[]> {
  return request("/api/documents/url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, summary }),
  });
}

export async function uploadDocumentWeb(
  url: string,
  summary: string,
  depth: number,
  maxPages: number
): Promise<DocumentEntry[]> {
  return request("/api/documents/web", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, summary, depth, maxPages }),
  });
}

export async function uploadDocumentHtml(
  html: string,
  summary: string,
  title?: string
): Promise<DocumentEntry[]> {
  return request("/api/documents/html", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, summary, title }),
  });
}

export async function deleteDocument(id: string): Promise<DocumentEntry[]> {
  return request(`/api/documents/${id}`, {
    method: "DELETE",
  });
}

export async function getHistory(): Promise<HistoryEntry[]> {
  return request("/api/history");
}

export async function clearHistory(): Promise<{ ok: boolean }> {
  return request("/api/history/clear", {
    method: "POST",
  });
}

export async function getCacheStats(): Promise<CacheStats> {
  return request("/api/cache/stats");
}

export async function getLearningStats(): Promise<LearningStats> {
  return request("/api/learning/stats");
}

export async function getLearningPatterns(): Promise<LearningPattern[]> {
  return request("/api/learning/patterns");
}

export async function updateLearningPattern(
  id: string,
  payload: Partial<LearningPattern>
): Promise<LearningPattern> {
  return request(`/api/learning/patterns/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteLearningPattern(id: string): Promise<{ ok: boolean }> {
  return request(`/api/learning/patterns/${id}`, {
    method: "DELETE",
  });
}

export async function getProfileStats(): Promise<ProfileStats> {
  return request("/api/profiles/stats");
}

// USUARIOS
export async function listUsers(): Promise<UserProfile[]> {
  return request("/api/users");
}

export async function getUserHistory(userId: string): Promise<HistoryEntry[]> {
  return request(`/api/users/${userId}/history`);
}

export async function clearUserHistory(userId: string): Promise<{ ok: boolean }> {
  return request(`/api/users/${userId}/history/clear`, {
    method: "POST",
  });
}

export async function blockUser(userId: string, blocked: boolean): Promise<UserProfile> {
  return request(`/api/users/${userId}/block`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocked }),
  });
}

export async function sendMessageToUser(userId: string, text: string): Promise<{ ok: boolean }> {
  return request(`/api/users/${userId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

// CATEGORÍAS
export async function getCategories(): Promise<CategoryInfo[]> {
  const response = await request<CategoriesResponse>("/api/categories");
  return response.categories || [];
}

export async function deleteCategory(name: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/categories/${name}`, {
    method: "DELETE",
  });
}

export async function getSuggestedCategories(): Promise<SuggestedCategory[]> {
  const response = await request<SuggestedCategoriesResponse>("/api/suggested-categories");
  return response.suggested || [];
}

export async function getPendingSuggestedCategories(): Promise<SuggestedCategory[]> {
  const response = await request<SuggestedCategoriesResponse>("/api/suggested-categories/pending");
  return response.pending || [];
}

export async function approveSuggestedCategory(id: string, approverUserId?: string): Promise<{ ok: boolean; category: string; message: string }> {
  return request(`/api/suggested-categories/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approverUserId: approverUserId || "admin" }),
  });
}

export async function rejectSuggestedCategory(id: string): Promise<{ ok: boolean; message: string }> {
  return request(`/api/suggested-categories/${id}/reject`, {
    method: "POST",
  });
}

export async function updateSuggestedCategory(id: string, updates: Partial<SuggestedCategory>): Promise<{ ok: boolean; category: SuggestedCategory }> {
  return request(`/api/suggested-categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export async function deleteSuggestedCategory(id: string): Promise<{ ok: boolean }> {
  return request(`/api/suggested-categories/${id}`, {
    method: "DELETE",
  });
}

export function toHtmlFromText(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return `<pre>${escaped}</pre>`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(1)} ${units[index]}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleString();
}
