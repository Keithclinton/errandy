import { ExecutionContext, HttpException, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

export const GOOGLE_SIGN_IN_FAILED = "Google sign-in failed. Please try again.";

/**
 * Google's callback is a full-page browser redirect, so a thrown error would leave the person
 * looking at raw JSON. Instead the reason is put on the request and the controller sends them
 * back to the app, which shows it.
 */
@Injectable()
export class GoogleCallbackGuard extends AuthGuard("google") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest<TUser = any>(err: unknown, user: TUser | false, _info: unknown, context: ExecutionContext): TUser {
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      request.googleAuthError = err instanceof HttpException ? err.message : GOOGLE_SIGN_IN_FAILED;
      return null as TUser;
    }
    return user;
  }
}
