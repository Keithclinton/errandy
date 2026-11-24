import { ExecutionContext, HttpException, Injectable, Logger } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

export const GOOGLE_SIGN_IN_FAILED = "Google sign-in failed. Please try again.";
const HANDLED = Symbol("googleSignInHandled");

/**
 * Google's callback is a full-page browser redirect, so a thrown error would leave the person
 * looking at raw JSON. Instead the reason is put on the request and the controller sends them
 * back to the app, which shows it.
 */
@Injectable()
export class GoogleCallbackGuard extends AuthGuard("google") {
  private readonly logger = new Logger("GoogleSignIn");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest<TUser = any>(err: unknown, user: TUser | false, info: unknown, context: ExecutionContext): TUser {
    const request = context.switchToHttp().getRequest();
    // Passport should report one result per sign-in. If something reports again, the first result
    // stands: a stray empty report once turned every successful sign-in into a failure.
    if (request[HANDLED]) return null as TUser;
    request[HANDLED] = true;
    if (err || !user) {
      if (err instanceof HttpException) {
        request.googleAuthError = err.message;
      } else {
        request.googleAuthError = GOOGLE_SIGN_IN_FAILED;
        // The person only sees the generic message, so record why. These errors carry Google's
        // error code and description, never tokens.
        this.logger.error(`Google sign-in failed: ${describe(err, info)}`);
      }
      return null as TUser;
    }
    return user;
  }
}

function describe(err: unknown, info: unknown): string {
  if (err instanceof Error) {
    const details = err as Error & { code?: string; oauthError?: { statusCode?: number; data?: unknown } };
    const google = details.oauthError ? ` (Google answered ${details.oauthError.statusCode}: ${String(details.oauthError.data).slice(0, 200)})` : "";
    return `${err.name}: ${err.message}${details.code ? ` [${details.code}]` : ""}${google}`;
  }
  // No error and no user: Google sent the person back without signing in, e.g. they cancelled.
  const message = (info as { message?: string } | undefined)?.message;
  return `no account returned${message ? `: ${message}` : ""}`;
}
