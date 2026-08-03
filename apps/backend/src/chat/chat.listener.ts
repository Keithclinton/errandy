import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ChatService } from "./chat.service";
import { EVENTS, BidAcceptedEvent } from "../common/events/domain-events";

@Injectable()
export class ChatListener {
  constructor(private readonly chatService: ChatService) {}

  @OnEvent(EVENTS.BID_ACCEPTED)
  onBidAccepted(event: BidAcceptedEvent) {
    return this.chatService.getOrCreateConversation(event.listingId, event.listingOwnerId, event.bidderId);
  }
}
