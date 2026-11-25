import { ExecutionContext } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { ThrottlerModuleOptions } from "@nestjs/throttler";

/*
 * Rate limits, per minute and per route (the throttler counts each route separately).
 *
 * Signed-in requests count against the account and everything else against the address. Kenyan
 * mobile networks put many phones behind one public address, so counting signed-in people by
 * address would make all of them share a single allowance.
 *
 * Two settings, read on each request so a test can change them:
 *   THROTTLE_LIMIT_PER_MINUTE          replaces the general limits, for a load test only
 *   THROTTLE_SIGN_IN_LIMIT_PER_MINUTE  replaces the sign-in limit (the test suite raises it)
 */
const SIGNED_IN = 100;
const SIGNED_OUT = 300;
const SIGN_IN_ATTEMPTS = 10;
const MINUTE = 60_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Request = Record<string | symbol, any>;

const jwt = new JwtService();
const ACCOUNT = Symbol("rateLimitAccount");
const setting = (name: string) => Number(process.env[name]) || undefined;
const requestOf = (context: ExecutionContext): Request => context.switchToHttp().getRequest();

/**
 * The account a request is signed in as, if its access token is genuine and current. This runs
 * before sign-in is checked, so it verifies the token itself: an unchecked token would let anyone
 * make up a new account id for each request and never be limited.
 */
function accountOf(req: Request): string | null {
  if (!(ACCOUNT in req)) {
    req[ACCOUNT] = null;
    const token = /^Bearer (.+)$/.exec(req.headers?.authorization ?? "")?.[1];
    const secret = process.env.JWT_ACCESS_SECRET;
    if (token && secret) {
      try {
        const payload = jwt.verify<{ sub?: unknown; purpose?: unknown }>(token, { secret });
        // Password-reset links are signed with the same secret but aren't a sign-in.
        if (typeof payload.sub === "string" && payload.purpose === undefined) req[ACCOUNT] = payload.sub;
      } catch {
        // Expired or forged: counted by address, and sign-in refuses the request next.
      }
    }
  }
  return req[ACCOUNT];
}

export const rateLimits: ThrottlerModuleOptions = {
  throttlers: [
    {
      ttl: MINUTE,
      limit: (context) =>
        setting("THROTTLE_LIMIT_PER_MINUTE") ?? (accountOf(requestOf(context)) ? SIGNED_IN : SIGNED_OUT),
    },
  ],
  getTracker: (req) => {
    const account = accountOf(req);
    return account ? `account:${account}` : req.ip;
  },
};

/**
 * For signing up, logging in and password resets: counted by address even when signed in. This
 * slows password guessing, and sign-up floods (each sign-up texts a code, which costs money).
 * Use with `@Throttle(SIGN_IN_ATTEMPTS_LIMIT)`.
 */
export const SIGN_IN_ATTEMPTS_LIMIT = {
  default: {
    ttl: MINUTE,
    limit: () => setting("THROTTLE_SIGN_IN_LIMIT_PER_MINUTE") ?? SIGN_IN_ATTEMPTS,
    getTracker: (req: Request) => req.ip,
  },
};
