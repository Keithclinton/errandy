import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { EVENTS, MessageCreatedEvent, ContactSharedEvent, ChatStartedEvent } from "../common/events/domain-events";

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

  async listMessages(conversationId: string, userId: string, since?: string) {
    await this.assertParticipant(conversationId, userId);
    return this.prisma.message.findMany({
      where: {
        conversationId,
        ...(since && { createdAt: { gt: new Date(since) } }),
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async sendMessage(conversationId: string, userId: string, body: string) {
    const conversation = await this.assertParticipant(conversationId, userId);
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
