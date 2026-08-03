import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "./email.service";
import { EVENTS, BidReceivedEvent, BidAcceptedEvent } from "../common/events/domain-events";

@Injectable()
export class BidEmailListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  @OnEvent(EVENTS.BID_RECEIVED)
  async onBidReceived(event: BidReceivedEvent) {
    const [owner, listing] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: event.listingOwnerId } }),
      this.prisma.listing.findUnique({ where: { id: event.listingId } }),
    ]);
    if (!owner || !listing) return;
    await this.emailService.sendBidReceived(owner.email, listing.title, event.amount);
  }

  @OnEvent(EVENTS.BID_ACCEPTED)
  async onBidAccepted(event: BidAcceptedEvent) {
    const [bidder, listing] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: event.bidderId } }),
      this.prisma.listing.findUnique({ where: { id: event.listingId } }),
    ]);
    if (!bidder || !listing) return;
    await this.emailService.sendBidAccepted(bidder.email, listing.title);
  }
}
