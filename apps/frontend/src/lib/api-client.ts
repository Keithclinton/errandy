import { getAccessToken, getRefreshToken, setTokens, notifyAuthFailure } from "./token-store";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
}

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  // BASE_URL may be relative (e.g. "/api" for a same-origin deployment). A leading-"/"
  // path passed as the URL constructor's first arg replaces the *entire* path of its
  // base rather than appending to it, so join the strings first and only then parse —
  // that way "/api" + "/auth/register" becomes "/api/auth/register", not "/auth/register".
  const isAbsolute = /^https?:\/\//.test(BASE_URL);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const combined = `${BASE_URL.replace(/\/$/, "")}${normalizedPath}`;
  const url = isAbsolute ? new URL(combined) : new URL(combined, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseBody(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch(buildUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const data = await parseBody(res);
  setTokens(data.accessToken, data.refreshToken);
  return true;
}

export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = "GET", body, params, skipAuth = false } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const accessToken = getAccessToken();
  if (accessToken && !skipAuth) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(buildUrl(path, params), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !skipAuth && !isRetry && path !== "/auth/refresh") {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiFetch<T>(path, options, true);
    notifyAuthFailure();
    throw new ApiError(401, "Session expired");
  }

  const data = await parseBody(res);
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(", ") : (data?.message ?? res.statusText);
    throw new ApiError(res.status, message);
  }
  return data as T;
}
