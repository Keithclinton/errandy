import * as React from "react";
import { apiFetch } from "@/lib/api-client";
import { getAccessToken, setTokens, clearTokens, onAuthFailure } from "@/lib/token-store";
import type { User } from "@/types/api";

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  acceptedTerms: boolean;
  termsVersion: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
  applyTokens: (accessToken: string, refreshToken: string) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchMe = React.useCallback(async () => {
    const me = await apiFetch<User>("/users/me");
    setUser(me);
  }, []);

  const refetchUser = React.useCallback(async () => {
    try {
      await fetchMe();
    } catch {
      setUser(null);
    }
  }, [fetchMe]);

  React.useEffect(() => {
    onAuthFailure(() => setUser(null));
    (async () => {
      if (getAccessToken()) {
        try {
          await fetchMe();
        } catch {
          clearTokens();
        }
      }
      setIsLoading(false);
    })();
  }, [fetchMe]);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<TokenPairResponse>("/auth/login", { method: "POST", body: { email, password } });
      setTokens(res.accessToken, res.refreshToken);
      await fetchMe();
    },
    [fetchMe],
  );

  const register = React.useCallback(
    async (input: RegisterInput) => {
      const res = await apiFetch<TokenPairResponse>("/auth/register", { method: "POST", body: input });
      setTokens(res.accessToken, res.refreshToken);
      await fetchMe();
    },
    [fetchMe],
  );

  const applyTokens = React.useCallback(
    async (accessToken: string, refreshToken: string) => {
      setTokens(accessToken, refreshToken);
      await fetchMe();
    },
    [fetchMe],
  );

  const logout = React.useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // best-effort — clear local state regardless
    }
    clearTokens();
    setUser(null);
  }, []);

  const value = React.useMemo(
    () => ({ user, isLoading, login, register, logout, refetchUser, applyTokens }),
    [user, isLoading, login, register, logout, refetchUser, applyTokens],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
