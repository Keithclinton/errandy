import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsEventType } from "@prisma/client";
import {
  EVENTS,
  ListingCreatedEvent,
  BidReceivedEvent,
  ChatStartedEvent,
  ContactSharedEvent,
  ListingCompletedEvent,
  RatingLeftEvent,
} from "../common/events/domain-events";

@Injectable()
export class AnalyticsListener {
  constructor(private readonly analytics: AnalyticsService) {}

  @OnEvent(EVENTS.LISTING_CREATED)
  onListingCreated(event: ListingCreatedEvent) {
    return this.analytics.record({
      type: AnalyticsEventType.listing_created,
      entityType: "listing",
      entityId: event.listingId,
      userId: event.ownerId,
      metadata: { category: event.category },
    });
  }

  @OnEvent(EVENTS.BID_RECEIVED)
  onBidPlaced(event: BidReceivedEvent) {
    return this.analytics.record({
      type: AnalyticsEventType.bid_placed,
      entityType: "bid",
      entityId: event.bidId,
      userId: event.bidderId,
      metadata: { listingId: event.listingId },
    });
  }

  @OnEvent(EVENTS.CHAT_STARTED)
  onChatStarted(event: ChatStartedEvent) {
    return this.analytics.record({
      type: AnalyticsEventType.chat_started,
      entityType: "conversation",
      entityId: event.conversationId,
      userId: event.startedById,
      metadata: { listingId: event.listingId },
    });
  }

  @OnEvent(EVENTS.CONTACT_SHARED)
  onContactShared(event: ContactSharedEvent) {
    return this.analytics.record({
      type: AnalyticsEventType.contact_shared,
      entityType: "conversation",
      entityId: event.conversationId,
      userId: event.sharedById,
      metadata: { listingId: event.listingId },
    });
  }

  @OnEvent(EVENTS.LISTING_COMPLETED)
  onListingCompleted(event: ListingCompletedEvent) {
    return this.analytics.record({
      type: AnalyticsEventType.listing_completed,
      entityType: "listing",
      entityId: event.listingId,
      userId: event.ownerId,
    });
  }

  @OnEvent(EVENTS.RATING_LEFT)
  onRatingLeft(event: RatingLeftEvent) {
    return this.analytics.record({
      type: AnalyticsEventType.rating_left,
      entityType: "rating",
      entityId: event.ratingId,
      userId: event.raterId,
      metadata: { listingId: event.listingId },
    });
  }
}
