import { Module } from "@nestjs/common";
import { BidsService } from "./bids.service";
import { BidsController } from "./bids.controller";
import { TokensModule } from "../tokens/tokens.module";
import { RatingsModule } from "../ratings/ratings.module";

@Module({
  imports: [TokensModule, RatingsModule],
  controllers: [BidsController],
  providers: [BidsService],
  exports: [BidsService],
})
export class BidsModule {}
