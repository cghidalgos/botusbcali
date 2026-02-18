type HttpMethod = "GET" | "POST" | "DELETE";

// Detectar automáticamente el prefijo API basándose en la ruta actual
const getApiBase = () => {
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    // Si accedemos desde /botusbcali/, usar ese prefijo para las APIs
    if (pathname.startsWith('/botusbcali/') || pathname === '/botusbcali') {
      return '/botusbcali';
    }
  }
  // Por defecto, sin prefijo (localhost directo)
  return import.meta.env.VITE_API_BASE ?? "";
};

const API_BASE = getApiBase();

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

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  hitCount: number;
  enabled: boolean;
  createdAt: number;
  lastUsedAt: number;
  updatedAt: number;
  questionEmbedding?: number[];
  metadata?: {
    chatId?: string;
    documentsUsed?: string[];
    createdFrom?: string;
  };
}

export interface FAQStats {
  total: number;
  enabled: number;
  totalHits: number;
  categories: Record<string, { count: number; hits: number }>;
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

// BROADCAST - Envío de difusión a múltiples usuarios
export interface BroadcastOptions {
  text?: string;
  sendToAll?: boolean;
  chatIds?: string[];
  mediaType?: "photo" | "video" | "audio" | "document";
  mediaCaption?: string;
  mediaFile?: File;
  broadcastSecret?: string;
}

export interface BroadcastResponse {
  sent: number;
  failures: Array<{
    chatId: string;
    reason: string;
    description: string;
  }>;
  durationMs: number;
  targetCount: number;
}

export async function sendBroadcast(options: BroadcastOptions): Promise<BroadcastResponse> {
  const formData = new FormData();
  
  if (options.text) {
    formData.append("text", options.text);
  }
  
  if (options.sendToAll) {
    formData.append("sendToAll", "true");
  }
  
  if (options.chatIds && options.chatIds.length > 0) {
    formData.append("chatIds", options.chatIds.join(","));
  }
  
  if (options.mediaType) {
    formData.append("mediaType", options.mediaType);
  }
  
  if (options.mediaCaption) {
    formData.append("mediaCaption", options.mediaCaption);
  }
  
  if (options.mediaFile) {
    formData.append("media", options.mediaFile);
  }
  
  const headers: HeadersInit = {};
  if (options.broadcastSecret) {
    headers["x-broadcast-secret"] = options.broadcastSecret;
  }
  
  const response = await fetch(`${API_BASE}/send-broadcast`, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
    headers,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Broadcast failed: ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// EMBEDDING CACHE - Estadísticas de embeddings cacheados
// ============================================================================

export interface EmbeddingCacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: string;
  estimatedSavings: string;
  topQueries: Array<{
    text: string;
    hitCount: number;
  }>;
}

export async function getEmbeddingCacheStats(): Promise<EmbeddingCacheStats> {
  const response = await fetch(`${API_BASE}/api/embedding-cache/stats`);
  if (!response.ok) {
    throw new Error(`Failed to fetch embedding cache stats: ${response.status}`);
  }
  return response.json();
}

export async function cleanOldEmbeddingCache(maxAgeDays: number): Promise<{ removed: number; remaining: number }> {
  const response = await fetch(`${API_BASE}/api/embedding-cache/clean`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ maxAgeDays }),
  });
  if (!response.ok) {
    throw new Error(`Failed to clean embedding cache: ${response.status}`);
  }
  return response.json();
}

// ============================================================================
// VECTOR INDEX - Índice HNSW para búsquedas rápidas
// ============================================================================

export interface VectorIndexStats {
  vectorCount: number;
  dimension: number;
  metric: string;
  useIndex: boolean;
  indexBuilt: boolean;
  avgConnectionsPerNode: string;
  M: number;
  efConstruction: number;
  uniqueDocuments: number;
  totalChunks: number;
  indexSize: string;
}

export async function getVectorIndexStats(): Promise<VectorIndexStats> {
  const response = await fetch(`${API_BASE}/api/vector-index/stats`);
  if (!response.ok) {
    throw new Error(`Failed to fetch vector index stats: ${response.status}`);
  }
  return response.json();
}

export async function rebuildVectorIndex(): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/api/vector-index/rebuild`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Failed to rebuild vector index: ${response.status}`);
  }
  return response.json();
}

// ============================================================================
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

// FAQs - Preguntas frecuentes con caché inteligente
export async function getAllFAQs(): Promise<FAQ[]> {
  return request("/api/faqs");
}

export async function getFAQStats(): Promise<FAQStats> {
  return request("/api/faqs/stats");
}

export async function getTopFAQs(limit: number = 10): Promise<FAQ[]> {
  return request(`/api/faqs/top?limit=${limit}`);
}

export async function getFAQsByCategory(category: string): Promise<FAQ[]> {
  return request(`/api/faqs/category/${encodeURIComponent(category)}`);
}

export async function updateFAQ(id: string, updates: Partial<FAQ>): Promise<FAQ> {
  return request(`/api/faqs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export async function deleteFAQ(id: string): Promise<{ ok: boolean }> {
  return request(`/api/faqs/${id}`, {
    method: "DELETE",
  });
}

export async function toggleFAQ(id: string, enabled: boolean): Promise<FAQ> {
  return request(`/api/faqs/${id}/toggle`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
}

export async function getFAQCategories(): Promise<string[]> {
  return request("/api/faq-categories");
}

// ====== SURVEYS & QUIZZES ======

export interface SurveyQuestion {
  id: string;
  type: "single_choice" | "multiple_choice" | "rating" | "text" | "yes_no";
  question: string;
  options?: string[];
  required: boolean;
  // Quiz-specific
  correctAnswer?: number;
  correctAnswers?: number[];
  explanation?: string;
  points?: number;
  partialCredit?: boolean;
  // Rating-specific
  min?: number;
  max?: number;
}

export interface QuizSettings {
  passingScore: number;
  showResults: "immediate" | "at_end" | "never";
  showCorrectAnswers: boolean;
  showExplanations: boolean;
  allowRetake: boolean;
  maxAttempts: number;
  timeLimit: number | null;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showLeaderboard: boolean;
  partialCredit: boolean;
}

export interface Survey {
  id: string;
  type: "survey" | "quiz";
  title: string;
  description: string;
  status: "draft" | "active" | "closed" | "scheduled";
  createdAt: string;
  createdBy: string;
  scheduledFor: string | null;
  sendTo: {
    type: "all" | "specific" | "filtered";
    userIds: (string | number)[];
    filters: Record<string, any>;
  };
  questions: SurveyQuestion[];
  quizSettings?: QuizSettings;
  sentCount: number;
  responseCount: number;
  lastSentAt: string | null;
}

export interface SurveyAnswer {
  questionId: string;
  answer: any;
  correct?: boolean;
  pointsEarned?: number;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  userId: number;
  username: string;
  firstName?: string;
  lastName?: string;
  attemptNumber?: number;
  answers: SurveyAnswer[];
  score?: number;
  totalPoints?: number;
  percentage?: number;
  passed?: boolean;
  timeSpent: number;
  startedAt: string;
  completedAt: string;
}

export interface SurveyStats {
  totalSent: number;
  totalResponses: number;
  responseRate: number;
  // Survey specific
  questionStats?: Record<string, any>;
  // Quiz specific
  averageScore?: number;
  passRate?: number;
  passed?: number;
  failed?: number;
  scoreDistribution?: Record<string, number>;
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  firstName?: string;
  lastName?: string;
  score: number;
  totalPoints: number;
  percentage: number;
  timeSpent: number;
  completedAt: string;
}

export async function getSurveys(filters?: { type?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.type) params.append("type", filters.type);
  if (filters?.status) params.append("status", filters.status);
  
  const queryString = params.toString();
  return request<{ ok: boolean; surveys: Survey[] }>(
    `/api/surveys${queryString ? `?${queryString}` : ""}`
  );
}

export async function getSurveyById(id: string) {
  return request<{ ok: boolean; survey: Survey }>(`/api/surveys/${id}`);
}

export async function createSurvey(data: Partial<Survey>) {
  return request<{ ok: boolean; survey: Survey }>("/api/surveys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateSurvey(id: string, data: Partial<Survey>) {
  return request<{ ok: boolean; survey: Survey }>(`/api/surveys/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteSurvey(id: string) {
  return request<{ ok: boolean }>(`/api/surveys/${id}`, {
    method: "DELETE",
  });
}

export async function sendSurvey(id: string, options: { sendToAll?: boolean; userIds?: (string | number)[] }) {
  return request<{ ok: boolean; results: { sent: number; failed: number; errors: any[] } }>(
    `/api/surveys/${id}/send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    }
  );
}

export async function closeSurvey(id: string) {
  return request<{ ok: boolean; survey: Survey }>(`/api/surveys/${id}/close`, {
    method: "POST",
  });
}

export async function getSurveyResponses(id: string, filters?: { userId?: number }) {
  const params = new URLSearchParams();
  if (filters?.userId) params.append("userId", String(filters.userId));
  
  const queryString = params.toString();
  return request<{ ok: boolean; responses: SurveyResponse[] }>(
    `/api/surveys/${id}/responses${queryString ? `?${queryString}` : ""}`
  );
}

export async function getSurveyStats(id: string) {
  return request<{ ok: boolean; stats: SurveyStats }>(`/api/surveys/${id}/stats`);
}

export async function getSurveyLeaderboard(id: string, limit = 10) {
  return request<{ ok: boolean; leaderboard: LeaderboardEntry[] }>(
    `/api/surveys/${id}/leaderboard?limit=${limit}`
  );
}

export async function exportSurveyCSV(id: string) {
  const response = await fetch(`${API_BASE}/api/surveys/${id}/export`, {
    credentials: "same-origin",
  });
  
  if (!response.ok) {
    throw new Error("Error al exportar CSV");
  }
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `survey_${id}_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
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

