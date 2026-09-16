import { Module } from "@nestjs/common";
import { ListingsService } from "./listings.service";
import { ListingsController } from "./listings.controller";
import { TokensModule } from "../tokens/tokens.module";
import { RatingsModule } from "../ratings/ratings.module";

@Module({
  imports: [TokensModule, RatingsModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
