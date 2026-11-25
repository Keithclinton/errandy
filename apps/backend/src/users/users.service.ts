import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ListingStatus } from "@prisma/client";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { AccountBlocksService } from "../account-blocks/account-blocks.service";
import { PhotosService } from "../photos/photos.service";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountBlocks: AccountBlocksService,
    private readonly photos: PhotosService,
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
        idVerifiedAt: true,
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
    if (dto.avatarUrl !== undefined || dto.portfolioUrls !== undefined) {
      const current = await this.prisma.user.findUnique({ where: { id }, select: { avatarUrl: true, portfolioUrls: true } });
      if (!current) throw new NotFoundException("User not found");
      // The photo Google gave an account at sign-up stays allowed: it's already on the profile.
      if (dto.avatarUrl) await this.photos.assertUsable(id, [dto.avatarUrl], [current.avatarUrl]);
      if (dto.portfolioUrls) await this.photos.assertUsable(id, dto.portfolioUrls, current.portfolioUrls);
    }
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    const { passwordHash, refreshTokenHash, passwordResetTokenHash, ...safe } = user;
    return safe;
  }

  /** A user deleting their own account. Admin accounts can only be deleted by the super admin. */
  async deleteOwnAccount(user: AuthUser) {
    if (user.isSuperAdmin) {
      throw new ForbiddenException("The super admin account can't be deleted.");
    }
    if (user.isAdmin) {
      throw new ForbiddenException("Admin accounts can't be deleted here. Ask the super admin to delete it for you.");
    }
    return this.deleteAccount(user.id);
  }

  /**
   * Hard-deletes a user and everything tied to them. Not just their own rows — a user
   * can own listings that *other* people bid on, rated, and chatted about, so this has to
   * clean up those too, or the delete would fail on a foreign key (or worse, half-succeed).
   * Wrapped in one transaction so it's all-or-nothing. Used both for a user deleting their
   * own account and for an admin deleting one from the admin panel. Either way, the email,
   * verified phone number and Google account can't sign up again for a while afterwards.
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    await this.prisma.$transaction(async (tx) => {
      await this.accountBlocks.blockDeletedAccount(tx, { email: user.email, phone: user.phone, googleId: user.googleId });
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
      await tx.idVerification.deleteMany({ where: { userId } }); // their photos go with it (cascade)
      await tx.phoneOtp.deleteMany({ where: { userId } });
      await tx.tokenTransaction.deleteMany({ where: { userId } });
      await tx.tokenPurchase.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });
    // Only once the account is really gone: deleting files can't be rolled back.
    await this.photos.removeAccountPhotos(userId);

    return { ok: true };
  }
}
