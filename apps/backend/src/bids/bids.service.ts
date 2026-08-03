import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { BidStatus, ListingStatus } from "@prisma/client";
import { CreateBidDto } from "./dto/create-bid.dto";
import { EVENTS, BidReceivedEvent, BidAcceptedEvent, BidDeclinedEvent } from "../common/events/domain-events";

@Injectable()
export class BidsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async place(listingId: string, bidderId: string, dto: CreateBidDto) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException("Listing not found");
    if (listing.status !== ListingStatus.open) {
      throw new BadRequestException("This listing is no longer open for bids");
    }
    if (listing.ownerId === bidderId) {
      throw new BadRequestException("You cannot bid on your own listing");
    }
    const bid = await this.prisma.bid.create({
      data: { listingId, bidderId, amount: dto.amount, message: dto.message },
    });
    await this.events.emitAsync(EVENTS.BID_RECEIVED, {
      bidId: bid.id,
      listingId,
      listingOwnerId: listing.ownerId,
      bidderId,
      amount: bid.amount.toString(),
    } satisfies BidReceivedEvent);
    return bid;
  }

  async withdraw(bidId: string, userId: string) {
    const bid = await this.prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid) throw new NotFoundException("Bid not found");
    if (bid.bidderId !== userId) throw new ForbiddenException("You do not own this bid");
    if (bid.status !== BidStatus.pending) throw new BadRequestException("Only pending bids can be withdrawn");
    return this.prisma.bid.update({ where: { id: bidId }, data: { status: BidStatus.withdrawn } });
  }

  private async findOwnedPendingBid(bidId: string, userId: string) {
    const bid = await this.prisma.bid.findUnique({ where: { id: bidId }, include: { listing: true } });
    if (!bid) throw new NotFoundException("Bid not found");
    if (bid.listing.ownerId !== userId) throw new ForbiddenException("You do not own this listing");
    if (bid.status !== BidStatus.pending) throw new BadRequestException("This bid is no longer pending");
    return bid;
  }

  async accept(bidId: string, userId: string) {
    const bid = await this.findOwnedPendingBid(bidId, userId);

    const otherPendingBids = await this.prisma.bid.findMany({
      where: { listingId: bid.listingId, status: BidStatus.pending, id: { not: bidId } },
    });

    await this.prisma.$transaction([
      this.prisma.bid.update({ where: { id: bidId }, data: { status: BidStatus.accepted } }),
      this.prisma.listing.update({
        where: { id: bid.listingId },
        data: { acceptedBidId: bidId, status: ListingStatus.closed },
      }),
      this.prisma.bid.updateMany({
        where: { id: { in: otherPendingBids.map((b) => b.id) } },
        data: { status: BidStatus.declined },
      }),
    ]);

    await this.events.emitAsync(EVENTS.BID_ACCEPTED, {
      bidId,
      listingId: bid.listingId,
      listingOwnerId: userId,
      bidderId: bid.bidderId,
    } satisfies BidAcceptedEvent);
    for (const declined of otherPendingBids) {
      await this.events.emitAsync(EVENTS.BID_DECLINED, {
        bidId: declined.id,
        listingId: bid.listingId,
        bidderId: declined.bidderId,
      } satisfies BidDeclinedEvent);
    }
    return this.prisma.bid.findUnique({ where: { id: bidId } });
  }

  async decline(bidId: string, userId: string) {
    const bid = await this.findOwnedPendingBid(bidId, userId);
    const updated = await this.prisma.bid.update({
      where: { id: bidId },
      data: { status: BidStatus.declined },
    });
    await this.events.emitAsync(EVENTS.BID_DECLINED, {
      bidId,
      listingId: bid.listingId,
      bidderId: bid.bidderId,
    } satisfies BidDeclinedEvent);
    return updated;
  }
}
