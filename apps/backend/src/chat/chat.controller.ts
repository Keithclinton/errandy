import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { ChatService } from "./chat.service";
import { SendMessageDto } from "./dto/send-message.dto";

@ApiTags("chat")
@ApiBearerAuth()
@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get("listings/:id/conversation")
  getConversation(@CurrentUser() user: AuthUser, @Param("id") listingId: string, @Query("with") withUserId?: string) {
    return this.chatService.getOrCreateConversation(listingId, user.id, withUserId);
  }

  @Get("conversations")
  listForUser(@CurrentUser() user: AuthUser) {
    return this.chatService.listForUser(user.id);
  }

  @Get("conversations/:id/messages")
  listMessages(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("since") since?: string) {
    return this.chatService.listMessages(id, user.id, since);
  }

  @Post("conversations/:id/messages")
  sendMessage(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(id, user.id, dto.body);
  }

  @Post("conversations/:id/share-contact")
  shareContact(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.chatService.shareContact(id, user.id);
  }
}
