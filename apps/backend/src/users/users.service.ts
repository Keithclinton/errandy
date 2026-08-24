import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListingStatus } from "@prisma/client";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { RequestUploadUrlDto } from "../listings/dto/request-upload-url.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    const { passwordHash, refreshTokenHash, passwordResetTokenHash, ...safe } = user;
    return safe;
  }

  async findPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        bio: true,
        portfolioUrls: true,
        ratingAvg: true,
        ratingCount: true,
        createdAt: true,
        listings: {
          where: { status: ListingStatus.open },
          select: { id: true, title: true, category: true, location: true, budget: true, createdAt: true },
        },
      },
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    const { passwordHash, refreshTokenHash, passwordResetTokenHash, ...safe } = user;
    return safe;
  }

  async requestUploadUrl(userId: string, dto: RequestUploadUrlDto) {
    const token = this.config.get<string>("BLOB_READ_WRITE_TOKEN");
    if (!token) {
      throw new BadRequestException("Image storage is not configured yet");
    }
    const pathname = `users/${userId}/portfolio/${Date.now()}-${dto.filename}`;
    const clientToken = await generateClientTokenFromReadWriteToken({
      token,
      pathname,
      allowedContentTypes: [dto.contentType],
    });
    return { clientToken, pathname };
  }
}
