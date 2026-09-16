import { Module } from "@nestjs/common";
import { BidsService } from "./bids.service";
import { BidsController } from "./bids.controller";
import { TokensModule } from "../tokens/tokens.module";
import { RatingsModule } from "../ratings/ratings.module";
import { ChatModule } from "../chat/chat.module";

@Module({
  imports: [TokensModule, RatingsModule, ChatModule],
  controllers: [BidsController],
  providers: [BidsService],
  exports: [BidsService],
})
export class BidsModule {}
