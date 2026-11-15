
/**
 * Rate-limit key for per-account limits. The throttler guard runs before JWT auth, so this
 * reads the bearer token's subject without verifying it; a forged subject fails auth right
 * after, before reaching the handler. Falls back to the client IP.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function trackByAccount(req: Record<string, any>): string {
  const token = /^Bearer (.+)$/.exec(req.headers?.authorization ?? "")?.[1];
  const payload = token?.split(".")[1];
  if (payload) {
    try {
      const { sub } = JSON.parse(Buffer.from(payload, "base64url").toString());
      if (typeof sub === "string") return `user:${sub}`;
    } catch {
      // Not a JWT; fall back to the IP.
    }
  }
  return req.ip;
}
