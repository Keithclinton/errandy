import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomUUID } from "crypto";
import { Profile } from "passport-google-oauth20";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { UserStatus } from "@prisma/client";
import { AuthUser } from "../common/decorators/current-user.decorator";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const RESET_TOKEN_PURPOSE = "password-reset";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    isAdmin: boolean;
    kycStatus: AuthUser["kycStatus"];
  }): AuthUser {
    return { id: user.id, email: user.email, isAdmin: user.isAdmin, kycStatus: user.kycStatus };
  }

  private async issueTokens(authUser: AuthUser): Promise<TokenPair> {
    const accessToken = this.jwtService.sign(
      { sub: authUser.id, email: authUser.email, isAdmin: authUser.isAdmin, kycStatus: authUser.kycStatus },
      {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m",
      },
    );
    const refreshToken = this.jwtService.sign(
      // jti guarantees a distinct token string per issuance — without it, two refreshes
      // within the same second would sign identical payloads and collide.
      { sub: authUser.id, jti: randomUUID() },
      {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "30d",
      },
    );
    const decoded = this.jwtService.decode(refreshToken) as { exp: number };
    await this.prisma.user.update({
      where: { id: authUser.id },
      data: {
        refreshTokenHash: this.hash(refreshToken),
        refreshTokenExpiresAt: new Date(decoded.exp * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto): Promise<TokenPair & { user: AuthUser }> {
    if (!dto.acceptedTerms) {
      throw new BadRequestException("You must accept the Terms of Service to register");
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        phone: dto.phone,
        acceptedTermsAt: new Date(),
        termsVersion: dto.termsVersion,
      },
    });
    const authUser = this.toAuthUser(user);
    const tokens = await this.issueTokens(authUser);
    return { ...tokens, user: authUser };
  }

  async login(dto: LoginDto): Promise<TokenPair & { user: AuthUser }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }
    if (user.status === UserStatus.suspended) {
      throw new UnauthorizedException("This account has been suspended");
    }
    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const authUser = this.toAuthUser(user);
    const tokens = await this.issueTokens(authUser);
    return { ...tokens, user: authUser };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (
      !user ||
      !user.refreshTokenHash ||
      user.refreshTokenHash !== this.hash(refreshToken) ||
      !user.refreshTokenExpiresAt ||
      user.refreshTokenExpiresAt < new Date()
    ) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    return this.issueTokens(this.toAuthUser(user));
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null, refreshTokenExpiresAt: null },
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const resetToken = this.jwtService.sign(
      { sub: user.id, purpose: RESET_TOKEN_PURPOSE },
      { secret: this.config.get<string>("JWT_ACCESS_SECRET"), expiresIn: "1h" },
    );
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: this.hash(resetToken),
        passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await this.emailService.sendPasswordReset(user.email, resetToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    let payload: { sub: string; purpose: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired reset token");
    }
    if (payload.purpose !== RESET_TOKEN_PURPOSE) {
      throw new UnauthorizedException("Invalid reset token");
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (
      !user ||
      !user.passwordResetTokenHash ||
      user.passwordResetTokenHash !== this.hash(token) ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date()
    ) {
      throw new UnauthorizedException("Invalid or expired reset token");
    }
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });
  }

  async acceptTerms(userId: string, termsVersion: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { acceptedTermsAt: new Date(), termsVersion },
    });
  }

  async validateGoogleUser(profile: Profile): Promise<AuthUser> {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new BadRequestException("Google account has no email");
    }
    let user = await this.prisma.user.findUnique({ where: { googleId } });
    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email } });
      if (user) {
        user = await this.prisma.user.update({ where: { id: user.id }, data: { googleId } });
      } else {
        user = await this.prisma.user.create({
          data: {
            email,
            googleId,
            name: profile.displayName || email,
            avatarUrl: profile.photos?.[0]?.value,
          },
        });
      }
    }
    if (user.status === UserStatus.suspended) {
      throw new UnauthorizedException("This account has been suspended");
    }
    return this.toAuthUser(user);
  }

  async issueTokensForGoogleUser(authUser: AuthUser): Promise<TokenPair & { user: AuthUser }> {
    const tokens = await this.issueTokens(authUser);
    return { ...tokens, user: authUser };
  }
}
