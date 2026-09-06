import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { EVENTS, MessageCreatedEvent, ContactSharedEvent, ChatStartedEvent } from "../common/events/domain-events";

type ConversationRecord = { listingId: string; participantIds: string[] };

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async getOrCreateConversation(listingId: string, userId: string, counterpartId?: string): Promise<{ id: string; listingId: string; participantIds: string[]; createdAt: Date }> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException("Listing not found");

    let otherId: string;
    if (userId === listing.ownerId) {
      if (!counterpartId) {
        throw new BadRequestException("Specify which bidder to open a conversation with (?with=<bidderId>)");
      }
      otherId = counterpartId;
    } else {
      const hasBid = await this.prisma.bid.findFirst({ where: { listingId, bidderId: userId } });
      if (!hasBid) throw new ForbiddenException("Only the listing owner or a bidder can open this chat");
      otherId = listing.ownerId;
    }

    const existing = await this.prisma.conversation.findFirst({
      where: { listingId, participantIds: { hasEvery: [userId, otherId] } },
    });
    if (existing) return existing;

    const conversation = await this.prisma.conversation.create({
      data: { listingId, participantIds: [userId, otherId] },
    });
    await this.events.emitAsync(EVENTS.CHAT_STARTED, {
      conversationId: conversation.id,
      listingId,
      startedById: userId,
    } satisfies ChatStartedEvent);
    return conversation;
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException("Conversation not found");
    if (!conversation.participantIds.includes(userId)) {
      throw new ForbiddenException("You are not part of this conversation");
    }
    return conversation;
  }

  /** Whether `conversation` is between the listing owner and the bid that was actually accepted. */
  private async isWinningConversation(conversation: ConversationRecord): Promise<boolean> {
    const listing = await this.prisma.listing.findUnique({ where: { id: conversation.listingId } });
    if (!listing?.acceptedBidId) return false;
    const acceptedBid = await this.prisma.bid.findUnique({ where: { id: listing.acceptedBidId } });
    if (!acceptedBid) return false;
    return conversation.participantIds.includes(listing.ownerId) && conversation.participantIds.includes(acceptedBid.bidderId);
  }

  /** Once a listing has an accepted bid, every conversation except the winning one goes read-only. */
  private async assertNotSuperseded(conversation: ConversationRecord) {
    const listing = await this.prisma.listing.findUnique({ where: { id: conversation.listingId } });
    if (!listing?.acceptedBidId) return;
    if (!(await this.isWinningConversation(conversation))) {
      throw new ForbiddenException("This task was awarded to someone else, so this chat is now read-only.");
    }
  }

  async listMessages(conversationId: string, userId: string, since?: string) {
    await this.assertParticipant(conversationId, userId);
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(since && { createdAt: { gt: new Date(since) } }),
      },
      orderBy: { createdAt: "asc" },
    });
    // Viewing the thread is what "reads" it — mark the counterpart's messages as seen.
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
    return messages;
  }

  async listForUser(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { participantIds: { has: userId } },
      include: { listing: { select: { id: true, title: true, ownerId: true, acceptedBidId: true } } },
    });

    const counterpartIds = conversations
      .map((c) => c.participantIds.find((id) => id !== userId))
      .filter((id): id is string => !!id);
    const counterparts = await this.prisma.user.findMany({
      where: { id: { in: counterpartIds } },
      select: { id: true, name: true, avatarUrl: true },
    });
    const counterpartMap = new Map(counterparts.map((u) => [u.id, u]));

    const acceptedBidIds = [...new Set(conversations.map((c) => c.listing.acceptedBidId).filter((id): id is string => !!id))];
    const acceptedBids = await this.prisma.bid.findMany({ where: { id: { in: acceptedBidIds } } });
    const acceptedBidderByListingId = new Map(
      conversations
        .filter((c) => c.listing.acceptedBidId)
        .map((c) => [c.listing.id, acceptedBids.find((b) => b.id === c.listing.acceptedBidId)?.bidderId]),
    );

    // For conversations where the current user is the listing owner, surface the counterpart's
    // pending bid (if any) so the chat can offer an "Accept offer" action without leaving it.
    const pendingBids = await this.prisma.bid.findMany({
      where: {
        status: "pending",
        listingId: { in: conversations.filter((c) => c.listing.ownerId === userId).map((c) => c.listingId) },
      },
    });

    const results = await Promise.all(
      conversations.map(async (conversation) => {
        const counterpartId = conversation.participantIds.find((id) => id !== userId);
        const [lastMessage, unreadCount] = await Promise.all([
          this.prisma.message.findFirst({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: "desc" },
          }),
          this.prisma.message.count({
            where: { conversationId: conversation.id, senderId: { not: userId }, readAt: null },
          }),
        ]);
        const acceptedBidderId = acceptedBidderByListingId.get(conversation.listing.id);
        const isWinning = !acceptedBidderId
          ? true // nothing decided yet, conversation is fully active
          : conversation.participantIds.includes(conversation.listing.ownerId) && conversation.participantIds.includes(acceptedBidderId);
        const theirPendingBid =
          conversation.listing.ownerId === userId
            ? (pendingBids.find((b) => b.listingId === conversation.listingId && b.bidderId === counterpartId) ?? null)
            : null;
        return {
          id: conversation.id,
          listingId: conversation.listingId,
          listingTitle: conversation.listing.title,
          counterpart: counterpartId ? (counterpartMap.get(counterpartId) ?? null) : null,
          lastMessage,
          unreadCount,
          createdAt: conversation.createdAt,
          isActive: isWinning,
          canShareContact: isWinning && !!acceptedBidderId,
          theirPendingBidId: theirPendingBid?.id ?? null,
          theirPendingBidAmount: theirPendingBid?.amount.toString() ?? null,
        };
      }),
    );

    return results.sort((a, b) => {
      const aTime = (a.lastMessage?.createdAt ?? a.createdAt).getTime();
      const bTime = (b.lastMessage?.createdAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });
  }

  async sendMessage(conversationId: string, userId: string, body: string) {
    const conversation = await this.assertParticipant(conversationId, userId);
    await this.assertNotSuperseded(conversation);
    const message = await this.prisma.message.create({
      data: { conversationId, senderId: userId, body },
    });
    const recipientId = conversation.participantIds.find((id) => id !== userId);
    if (recipientId) {
      await this.events.emitAsync(EVENTS.MESSAGE_CREATED, {
        messageId: message.id,
        conversationId,
        listingId: conversation.listingId,
        senderId: userId,
        recipientId,
      } satisfies MessageCreatedEvent);
    }
    return message;
  }

  async shareContact(conversationId: string, userId: string) {
    const conversation = await this.assertParticipant(conversationId, userId);
    if (!(await this.isWinningConversation(conversation))) {
      throw new BadRequestException("Contact details can only be shared once this offer has been accepted");
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const contact = user?.phone ?? user?.email;
    const message = await this.sendMessage(conversationId, userId, `📞 Contact shared: ${contact}`);
    await this.events.emitAsync(EVENTS.CONTACT_SHARED, {
      conversationId,
      listingId: conversation.listingId,
      sharedById: userId,
    } satisfies ContactSharedEvent);
    return message;
  }
}
