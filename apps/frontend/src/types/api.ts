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
  | "report_resolved"
  | "bidder_token_required"
  | "tokens_purchased"
  | "id_verification_submitted"
  | "id_verification_reviewed";
export type TokenTransactionType = "signup_grant" | "listing_post" | "bid_accept_deduction" | "purchase";
export type TokenPurchaseStatus = "pending" | "completed" | "failed";

export interface AuthUser {
  id: string;
  email: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
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
  /** Phone verification, required to post or make offers. */
  kycStatus: KycStatus;
  /** When an admin approved their ID check; null if they don't have the ID verified badge. */
  idVerifiedAt?: string | null;
  isAdmin: boolean;
  /** Can make or remove admins, and is the only one who can suspend or delete an admin. */
  isSuperAdmin: boolean;
  status: UserStatus;
  ratingAvg: number;
  ratingCount: number;
  acceptedTermsAt?: string | null;
  termsVersion?: string | null;
  tokenBalance: number;
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
  idVerifiedAt?: string | null;
  createdAt: string;
  tasksCompleted: number;
  listings: Pick<Listing, "id" | "title" | "category" | "location" | "budget" | "createdAt">[];
}

export interface ListingOwner {
  id: string;
  name: string;
  avatarUrl?: string | null;
  ratingAvg: number;
  ratingCount: number;
  kycStatus?: KycStatus;
  idVerifiedAt?: string | null;
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
  /** False once another bidder's offer was accepted on this listing — chat becomes read-only. */
  isActive: boolean;
  /** True only once this specific conversation's offer was the one accepted. */
  canShareContact: boolean;
  /** Set when you're the listing owner and the counterpart still has a pending offer you can accept. */
  theirPendingBidId: string | null;
  theirPendingBidAmount: string | null;
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
  status: KycStatus;
  consentAt: string;
  reviewedAt?: string | null;
}

export type IdDocumentType = "national_id" | "passport" | "alien_id";
export type IdImageKind = "front" | "back" | "selfie";

export const ID_DOCUMENT_LABELS: Record<IdDocumentType, string> = {
  national_id: "National ID",
  passport: "Passport",
  alien_id: "Alien ID",
};

/** A user's own view of their ID check. */
export interface OwnIdCheck {
  status: KycStatus;
  verifiedAt: string | null;
  documentType: IdDocumentType | null;
  submittedAt: string | null;
  rejectionReason: string | null;
}

/** An ID check as an admin sees it in the review queue. */
export interface IdCheck {
  id: string;
  documentType: IdDocumentType;
  fullName: string;
  idNumber: string;
  status: KycStatus;
  rejectionReason: string | null;
  consentAt: string;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; name: string; email: string; avatarUrl?: string | null; idVerifiedAt: string | null };
  reviewedBy: { id: string; name: string } | null;
}

export interface IdCheckDetail extends IdCheck {
  /** Empty once the check has been reviewed: the photos are deleted then. */
  images: { kind: IdImageKind; dataUrl: string }[];
  /** Other checks that used the same document number. */
  sameIdNumber: { id: string; status: KycStatus; createdAt: string; user: { id: string; name: string; email: string } }[];
}

export interface TokenTransaction {
  id: string;
  type: TokenTransactionType;
  amount: number;
  balanceAfter: number;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  createdAt: string;
}

export interface TokenPack {
  id: string;
  tokens: number;
  amountKes: number;
}

export interface TokenPurchase {
  id: string;
  tokens: number;
  amountKes: string;
  phone: string;
  status: TokenPurchaseStatus;
  /** M-Pesa's result code once the payment has an outcome; 0 means paid. */
  resultCode?: number | null;
  mpesaReceiptNumber?: string | null;
  createdAt: string;
  completedAt?: string | null;
}
