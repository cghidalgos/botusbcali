import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthUser, clearStoredToken, getMe, getStoredToken, login as loginRequest, logout as logoutRequest, setStoredToken } from "@/lib/auth";
import { setManageMode, setStoredBotId, getManageMode } from "@/lib/botContext";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await getMe();
      setUser(response.user);
      if (response.user.role === "manager") {
        setManageMode(true);
      } else if (response.user.role === "admin" && !getManageMode()) {
        setStoredBotId("");
      }
    } catch (error) {
      clearStoredToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    setStoredToken(response.token);
    setUser(response.user);
    if (response.user.role === "manager") {
      setManageMode(true);
    } else {
      setManageMode(false);
      setStoredBotId("");
    }
    return response.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Ignore logout errors
    }
    clearStoredToken();
    setManageMode(false);
    setStoredBotId("");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
