export type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "manager";
  botIds: string[];
};

type LoginResponse = {
  token: string;
  user: AuthUser;
};

const TOKEN_KEY = "auth_token";

const getApiBase = () => {
  if (typeof window !== "undefined") {
    const pathname = window.location.pathname;
    if (pathname.startsWith("/botusbcali/") || pathname === "/botusbcali") {
      return "/botusbcali";
    }
  }
  return import.meta.env.VITE_API_BASE ?? "";
};

const API_BASE = getApiBase();

export function getStoredToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) || "";
}

export function setStoredToken(token: string) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearStoredToken() {
  setStoredToken("");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "same-origin",
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe(): Promise<{ user: AuthUser }> {
  const token = getStoredToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  return request<{ user: AuthUser }>("/api/auth/me", {
    method: "GET",
    headers,
  });
}

export async function logout(): Promise<{ ok: boolean }> {
  const token = getStoredToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  return request<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
    headers,
  });
}
