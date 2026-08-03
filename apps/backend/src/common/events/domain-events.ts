export const EVENTS = {
  BID_RECEIVED: "bid.received",
  BID_ACCEPTED: "bid.accepted",
  BID_DECLINED: "bid.declined",
  MESSAGE_CREATED: "message.created",
  LISTING_CREATED: "listing.created",
  LISTING_COMPLETED: "listing.completed",
  RATING_LEFT: "rating.left",
  REPORT_FILED: "report.filed",
  REPORT_RESOLVED: "report.resolved",
  CONTACT_SHARED: "contact.shared",
  CHAT_STARTED: "chat.started",
} as const;

export interface BidReceivedEvent {
  bidId: string;
  listingId: string;
  listingOwnerId: string;
  bidderId: string;
  amount: string;
}

export interface BidAcceptedEvent {
  bidId: string;
  listingId: string;
  listingOwnerId: string;
  bidderId: string;
}

export interface BidDeclinedEvent {
  bidId: string;
  listingId: string;
  bidderId: string;
}

export interface MessageCreatedEvent {
  messageId: string;
  conversationId: string;
  listingId: string;
  senderId: string;
  recipientId: string;
}

export interface ListingCreatedEvent {
  listingId: string;
  ownerId: string;
  category: string;
}

export interface ListingCompletedEvent {
  listingId: string;
  ownerId: string;
  bidderId: string;
}

export interface RatingLeftEvent {
  ratingId: string;
  listingId: string;
  raterId: string;
  rateeId: string;
}

export interface ReportFiledEvent {
  reportId: string;
  reporterId: string;
  targetType: string;
  targetId: string;
}

export interface ReportResolvedEvent {
  reportId: string;
  reporterId: string;
  status: string;
}

export interface ContactSharedEvent {
  conversationId: string;
  listingId: string;
  sharedById: string;
}

export interface ChatStartedEvent {
  conversationId: string;
  listingId: string;
  startedById: string;
}
