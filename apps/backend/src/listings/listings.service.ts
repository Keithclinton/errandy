import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListingStatus, Prisma } from "@prisma/client";
import { CreateListingDto } from "./dto/create-listing.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";
import { QueryListingsDto } from "./dto/query-listings.dto";
import { RequestUploadUrlDto } from "./dto/request-upload-url.dto";
import { EVENTS, ListingCreatedEvent, ListingCompletedEvent } from "../common/events/domain-events";

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  async create(ownerId: string, dto: CreateListingDto) {
    const listing = await this.prisma.listing.create({
      data: {
        ownerId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        location: dto.location,
        budget: dto.budget,
        imageUrls: dto.imageUrls ?? [],
      },
    });
    await this.events.emitAsync(EVENTS.LISTING_CREATED, {
      listingId: listing.id,
      ownerId,
      category: listing.category,
    } satisfies ListingCreatedEvent);
    return listing;
  }

  async findMany(query: QueryListingsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ListingWhereInput = {
      // The public feed defaults to open listings only; an owner querying their own
      // listings (e.g. "My Listings") should see every status unless they narrow it down.
      status: query.status ?? (query.ownerId ? undefined : ListingStatus.open),
      ...(query.ownerId && { ownerId: query.ownerId }),
      ...(query.category && { category: query.category }),
      ...(query.location && { location: query.location }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { owner: { select: { id: true, name: true, avatarUrl: true, ratingAvg: true, ratingCount: true } } },
      }),
      this.prisma.listing.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true, ratingAvg: true, ratingCount: true } },
        bids: true,
      },
    });
    if (!listing) throw new NotFoundException("Listing not found");
    return listing;
  }

  private async findOwned(userId: string, id: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException("Listing not found");
    if (listing.ownerId !== userId) throw new ForbiddenException("You do not own this listing");
    return listing;
  }

  async update(userId: string, id: string, dto: UpdateListingDto) {
    const listing = await this.findOwned(userId, id);
    if (listing.status !== ListingStatus.open) {
      throw new BadRequestException("Only open listings can be edited");
    }
    return this.prisma.listing.update({ where: { id }, data: dto });
  }

  async requestUploadUrl(userId: string, dto: RequestUploadUrlDto) {
    const token = this.config.get<string>("BLOB_READ_WRITE_TOKEN");
    if (!token) {
      throw new BadRequestException("Image storage is not configured yet");
    }
    const pathname = `listings/${userId}/${Date.now()}-${dto.filename}`;
    const clientToken = await generateClientTokenFromReadWriteToken({
      token,
      pathname,
      allowedContentTypes: [dto.contentType],
    });
    return { clientToken, pathname };
  }

  async markCompleted(userId: string, id: string) {
    const listing = await this.findOwned(userId, id);
    if (listing.status !== ListingStatus.closed || !listing.acceptedBidId) {
      throw new BadRequestException("Listing must have an accepted bid before it can be completed");
    }
    const acceptedBid = await this.prisma.bid.findUnique({ where: { id: listing.acceptedBidId } });
    if (!acceptedBid) throw new NotFoundException("Accepted bid not found");

    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.completed, completedAt: new Date() },
    });
    await this.events.emitAsync(EVENTS.LISTING_COMPLETED, {
      listingId: id,
      ownerId: userId,
      bidderId: acceptedBid.bidderId,
    } satisfies ListingCompletedEvent);
    return updated;
  }
}
