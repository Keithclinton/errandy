export type KycStatus = "none" | "pending" | "verified" | "rejected";
export type UserStatus = "active" | "suspended";
export type ListingStatus = "open" | "closed" | "completed";
export type BidStatus = "pending" | "accepted" | "declined" | "withdrawn";
export type ReportTargetType = "user" | "listing" | "message";
export type ReportReason = "spam" | "scam" | "harassment" | "inappropriate_content" | "no_show" | "other";
export type ReportStatus = "open" | "reviewed" | "actioned" | "dismissed";
export type NotificationType =
  | "bid_received"
  | "bid_accepted"
  | "bid_declined"
  | "new_message"
  | "please_rate"
  | "report_resolved";

export interface AuthUser {
  id: string;
  email: string;
  isAdmin: boolean;
  kycStatus: KycStatus;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  portfolioUrls: string[];
  kycStatus: KycStatus;
  isAdmin: boolean;
  status: UserStatus;
  ratingAvg: number;
  ratingCount: number;
  acceptedTermsAt?: string | null;
  termsVersion?: string | null;
  createdAt: string;
}

export interface PublicProfile {
  id: string;
  name: string;
  avatarUrl?: string | null;
  bio?: string | null;
  portfolioUrls: string[];
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
  listings: Pick<Listing, "id" | "title" | "category" | "location" | "budget" | "createdAt">[];
}

export interface ListingOwner {
  id: string;
  name: string;
  avatarUrl?: string | null;
  ratingAvg: number;
  ratingCount: number;
  kycStatus?: KycStatus;
  _count?: { listings: number };
}

export interface Listing {
  id: string;
  ownerId: string;
  owner?: ListingOwner;
  title: string;
  description: string;
  category: string;
  location: string;
  budget?: string | null;
  imageUrls: string[];
  status: ListingStatus;
  acceptedBidId?: string | null;
  completedAt?: string | null;
  createdAt: string;
  bids?: Bid[];
  _count?: { bids: number };
}

export interface Bid {
  id: string;
  listingId: string;
  listing?: Pick<Listing, "id" | "title" | "status" | "ownerId">;
  bidderId: string;
  bidder?: ListingOwner;
  amount: string;
  message?: string | null;
  status: BidStatus;
  createdAt: string;
}

export interface Conversation {
  id: string;
  listingId: string;
  participantIds: string[];
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  listingId: string;
  listingTitle: string;
  counterpart: { id: string; name: string; avatarUrl?: string | null } | null;
  lastMessage: Message | null;
  unreadCount: number;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
}

export interface Rating {
  id: string;
  listingId: string;
  raterId: string;
  rateeId: string;
  stars: number | null;
  comment?: string | null;
  createdAt: string;
  visible: boolean;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string | null;
  status: ReportStatus;
  reviewedBy?: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  readAt?: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface KycVerification {
  id: string;
  userId: string;
  smileJobId?: string | null;
  status: KycStatus;
  consentAt: string;
  reviewedAt?: string | null;
}
