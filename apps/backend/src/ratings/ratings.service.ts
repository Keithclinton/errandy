import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, ListingStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRatingDto } from "./dto/create-rating.dto";
import { EVENTS, RatingLeftEvent } from "../common/events/domain-events";

const BLIND_WINDOW_DAYS = 7;

@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async submit(listingId: string, raterId: string, dto: CreateRatingDto) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException("Listing not found");
    if (listing.status !== ListingStatus.completed || !listing.acceptedBidId) {
      throw new BadRequestException("Ratings can only be left after the listing is completed");
    }
    const acceptedBid = await this.prisma.bid.findUnique({ where: { id: listing.acceptedBidId } });
    if (!acceptedBid) throw new NotFoundException("Accepted bid not found");

    let rateeId: string;
    if (raterId === listing.ownerId) {
      rateeId = acceptedBid.bidderId;
    } else if (raterId === acceptedBid.bidderId) {
      rateeId = listing.ownerId;
    } else {
      throw new ForbiddenException("Only the listing owner and the accepted bidder can rate each other");
    }

    let rating;
    try {
      rating = await this.prisma.rating.create({
        data: { listingId, raterId, rateeId, stars: dto.stars, comment: dto.comment },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("You have already rated this listing");
      }
      throw err;
    }

    const agg = await this.prisma.rating.aggregate({
      where: { rateeId },
      _avg: { stars: true },
      _count: true,
    });
    await this.prisma.user.update({
      where: { id: rateeId },
      data: { ratingAvg: agg._avg.stars ?? 0, ratingCount: agg._count },
    });

    await this.events.emitAsync(EVENTS.RATING_LEFT, {
      ratingId: rating.id,
      listingId,
      raterId,
      rateeId,
    } satisfies RatingLeftEvent);
    return rating;
  }

  private isRevealed(completedAt: Date | null, ratingsCount: number): boolean {
    if (ratingsCount >= 2) return true;
    if (!completedAt) return false;
    const windowElapsed = Date.now() - completedAt.getTime() > BLIND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return windowElapsed;
  }

  async getForListing(listingId: string, requestingUserId?: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException("Listing not found");
    const ratings = await this.prisma.rating.findMany({ where: { listingId } });
    const revealed = this.isRevealed(listing.completedAt, ratings.length);
    return ratings.map((rating) => {
      const visibleToRequester = revealed || rating.raterId === requestingUserId;
      return {
        id: rating.id,
        listingId: rating.listingId,
        raterId: rating.raterId,
        rateeId: rating.rateeId,
        createdAt: rating.createdAt,
        stars: visibleToRequester ? rating.stars : null,
        comment: visibleToRequester ? rating.comment : null,
        visible: visibleToRequester,
      };
    });
  }

  async getForUser(userId: string) {
    const ratings = await this.prisma.rating.findMany({
      where: { rateeId: userId },
      orderBy: { createdAt: "desc" },
      include: { listing: { select: { completedAt: true } } },
    });

    const revealed = await Promise.all(
      ratings.map(async (rating) => {
        // A listing has at most one rating per direction, so "both submitted" means
        // this listing has 2 rating rows total, not just the one this user received.
        const totalForListing = await this.prisma.rating.count({ where: { listingId: rating.listingId } });
        return this.isRevealed(rating.listing.completedAt, totalForListing);
      }),
    );

    return ratings
      .map((rating, i) =>
        revealed[i]
          ? { id: rating.id, stars: rating.stars, comment: rating.comment, createdAt: rating.createdAt }
          : null,
      )
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }
}
