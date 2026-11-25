import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { Public } from "../common/decorators/public.decorator";
import { SIGN_IN_ATTEMPTS_LIMIT } from "../common/rate-limits";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AcceptTermsDto } from "./dto/accept-terms.dto";
import { GoogleCallbackGuard, GOOGLE_SIGN_IN_FAILED } from "./guards/google-callback.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle(SIGN_IN_ATTEMPTS_LIMIT)
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle(SIGN_IN_ATTEMPTS_LIMIT)
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post("refresh")
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post("logout")
  logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user.id);
  }

  @Public()
  @Throttle(SIGN_IN_ATTEMPTS_LIMIT)
  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Throttle(SIGN_IN_ATTEMPTS_LIMIT)
  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @ApiBearerAuth()
  @Patch("accept-terms")
  acceptTerms(@CurrentUser() user: AuthUser, @Body() dto: AcceptTermsDto) {
    return this.authService.acceptTerms(user.id, dto.termsVersion);
  }

  @Public()
  @Get("google")
  @UseGuards(AuthGuard("google"))
  googleAuth() {
    // Guard redirects to Google; body never executes.
  }

  @Public()
  @Get("google/callback")
  @UseGuards(GoogleCallbackGuard)
  async googleCallback(@Req() req: Request & { googleAuthError?: string }, @Res() res: Response) {
    const configuredOrigin = this.config.get<string>("CORS_ORIGIN")?.split(",")[0]?.trim();
    const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0];
    const frontendUrl = configuredOrigin || `${forwardedProto ?? req.protocol}://${req.get("host")}`;
    const redirectUrl = new URL("/auth/callback", frontendUrl);
    if (req.googleAuthError || !req.user) {
      redirectUrl.hash = new URLSearchParams({ error: req.googleAuthError ?? GOOGLE_SIGN_IN_FAILED }).toString();
      res.redirect(redirectUrl.toString());
      return;
    }
    const tokens = await this.authService.issueTokensForGoogleUser(req.user as AuthUser);
    // Tokens go in the URL fragment, not the query string: fragments are never sent
    // to the server or in the Referer header, so they can't leak via access logs or
    // third-party resources loaded on the callback page — only the browser sees them.
    redirectUrl.hash = new URLSearchParams({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    }).toString();
    res.redirect(redirectUrl.toString());
  }
}
