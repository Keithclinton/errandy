import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListingStatus } from "@prisma/client";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { RequestUploadUrlDto } from "../listings/dto/request-upload-url.dto";
import { sanitizeFilename } from "../common/sanitize-filename";

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

    const tasksCompleted = await this.prisma.bid.count({
      where: { bidderId: id, status: "accepted", listing: { status: ListingStatus.completed } },
    });

    return { ...user, tasksCompleted };
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
    const pathname = `users/${userId}/portfolio/${Date.now()}-${sanitizeFilename(dto.filename)}`;
    const clientToken = await generateClientTokenFromReadWriteToken({
      token,
      pathname,
      allowedContentTypes: [dto.contentType],
    });
    return { clientToken, pathname };
  }

  /**
   * Hard-deletes a user and everything tied to them. Not just their own rows — a user
   * can own listings that *other* people bid on, rated, and chatted about, so this has to
   * clean up those too, or the delete would fail on a foreign key (or worse, half-succeed).
   * Wrapped in one transaction so it's all-or-nothing. Used both for a user deleting their
   * own account and for an admin deleting one from the admin panel.
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    await this.prisma.$transaction(async (tx) => {
      const ownedListings = await tx.listing.findMany({ where: { ownerId: userId }, select: { id: true } });
      const listingIds = ownedListings.map((l) => l.id);

      const conversations = await tx.conversation.findMany({
        where: { OR: [{ listingId: { in: listingIds } }, { participantIds: { has: userId } }] },
        select: { id: true },
      });
      const conversationIds = conversations.map((c) => c.id);

      await tx.message.deleteMany({ where: { OR: [{ conversationId: { in: conversationIds } }, { senderId: userId }] } });
      await tx.conversation.deleteMany({ where: { id: { in: conversationIds } } });
      await tx.rating.deleteMany({ where: { OR: [{ listingId: { in: listingIds } }, { raterId: userId }, { rateeId: userId }] } });
      await tx.bid.deleteMany({ where: { OR: [{ listingId: { in: listingIds } }, { bidderId: userId }] } });
      await tx.listing.deleteMany({ where: { id: { in: listingIds } } });
      await tx.report.deleteMany({ where: { reporterId: userId } });
      await tx.report.updateMany({ where: { reviewedBy: userId }, data: { reviewedBy: null } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.analyticsEvent.deleteMany({ where: { userId } });
      await tx.kycVerification.deleteMany({ where: { userId } });
      await tx.phoneOtp.deleteMany({ where: { userId } });
      await tx.tokenTransaction.deleteMany({ where: { userId } });
      await tx.tokenPurchase.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    return { ok: true };
  }
}
