import { Module } from "@nestjs/common";
import { ChatService } from "./chat.service";
import { ChatController } from "./chat.controller";
import { ChatListener } from "./chat.listener";

@Module({
  controllers: [ChatController],
  providers: [ChatService, ChatListener],
  exports: [ChatService],
})
export class ChatModule {}
