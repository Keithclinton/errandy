const ACCESS_KEY = "errandy.accessToken";
const REFRESH_KEY = "errandy.refreshToken";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

type AuthFailureHandler = () => void;
let authFailureHandler: AuthFailureHandler | null = null;

/** Called by AuthProvider so the api client can force a logout when refresh fails. */
export function onAuthFailure(handler: AuthFailureHandler): void {
  authFailureHandler = handler;
}

export function notifyAuthFailure(): void {
  clearTokens();
  authFailureHandler?.();
}
