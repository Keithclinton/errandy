import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { NotificationsService } from "./notifications.service";
import { NotificationType } from "@prisma/client";
import {
  EVENTS,
  BidReceivedEvent,
  BidAcceptedEvent,
  BidDeclinedEvent,
  MessageCreatedEvent,
  ListingCompletedEvent,
  ReportResolvedEvent,
  BidTokenRequiredEvent,
  TokensPurchasedEvent,
} from "../common/events/domain-events";

@Injectable()
export class NotificationsListener {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(EVENTS.BID_RECEIVED)
  onBidReceived(event: BidReceivedEvent) {
    return this.notifications.create({
      userId: event.listingOwnerId,
      type: NotificationType.bid_received,
      title: "New bid received",
      body: `You received a bid of ${event.amount} on your listing.`,
      entityType: "listing",
      entityId: event.listingId,
    });
  }

  @OnEvent(EVENTS.BID_ACCEPTED)
  onBidAccepted(event: BidAcceptedEvent) {
    return this.notifications.create({
      userId: event.bidderId,
      type: NotificationType.bid_accepted,
      title: "Your bid was accepted",
      body: "The listing owner accepted your bid. Open the chat to arrange details.",
      entityType: "listing",
      entityId: event.listingId,
    });
  }

  @OnEvent(EVENTS.BID_DECLINED)
  onBidDeclined(event: BidDeclinedEvent) {
    return this.notifications.create({
      userId: event.bidderId,
      type: NotificationType.bid_declined,
      title: "Your bid was declined",
      body: "The listing owner went with another bid.",
      entityType: "listing",
      entityId: event.listingId,
    });
  }

  @OnEvent(EVENTS.MESSAGE_CREATED)
  onMessageCreated(event: MessageCreatedEvent) {
    return this.notifications.create({
      userId: event.recipientId,
      type: NotificationType.new_message,
      title: "New message",
      body: "You have a new message.",
      entityType: "conversation",
      entityId: event.conversationId,
    });
  }

  @OnEvent(EVENTS.LISTING_COMPLETED)
  onListingCompleted(event: ListingCompletedEvent) {
    return Promise.all(
      [event.ownerId, event.bidderId].map((userId) =>
        this.notifications.create({
          userId,
          type: NotificationType.please_rate,
          title: "Rate your errand partner",
          body: "The errand is marked completed — leave a rating.",
          entityType: "listing",
          entityId: event.listingId,
        }),
      ),
    );
  }

  @OnEvent(EVENTS.REPORT_RESOLVED)
  onReportResolved(event: ReportResolvedEvent) {
    return this.notifications.create({
      userId: event.reporterId,
      type: NotificationType.report_resolved,
      title: "Your report was reviewed",
      body: `Your report was marked as ${event.status}.`,
      entityType: "report",
      entityId: event.reportId,
    });
  }

  @OnEvent(EVENTS.BID_TOKEN_REQUIRED)
  onBidTokenRequired(event: BidTokenRequiredEvent) {
    return this.notifications.create({
      userId: event.bidderId,
      type: NotificationType.bidder_token_required,
      title: "You need a token to be selected",
      body: `The owner of "${event.listingTitle}" wants to accept your ${event.amount} KES offer, but you need 1 token first.`,
      entityType: "listing",
      entityId: event.listingId,
    });
  }

  @OnEvent(EVENTS.TOKENS_PURCHASED)
  onTokensPurchased(event: TokensPurchasedEvent) {
    return this.notifications.create({
      userId: event.userId,
      type: NotificationType.tokens_purchased,
      title: "Tokens added",
      body: `${event.tokens} token(s) added to your balance. New balance: ${event.balanceAfter}.`,
      entityType: "token_purchase",
      entityId: event.purchaseId,
    });
  }
}
