import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { Strategy, VerifyCallback, Profile } from "passport-google-oauth20";
import { AuthService } from "../auth.service";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      // passport-oauth2 throws at construction time if these are falsy, so fall back to
      // placeholders when unset — Google login just won't work until real creds are added.
      clientID: config.get<string>("GOOGLE_CLIENT_ID") || "not-configured",
      clientSecret: config.get<string>("GOOGLE_CLIENT_SECRET") || "not-configured",
      callbackURL: config.get<string>("GOOGLE_CALLBACK_URL") || "http://localhost:3000/auth/google/callback",
      scope: ["email", "profile"],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const user = await this.authService.validateGoogleUser(profile);
      done(null, user);
    } catch (err) {
      done(err as Error, false);
    }
  }
}
