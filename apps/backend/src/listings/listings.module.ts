import { Module } from "@nestjs/common";
import { ListingsService } from "./listings.service";
import { ListingsController } from "./listings.controller";
import { TokensModule } from "../tokens/tokens.module";
import { RatingsModule } from "../ratings/ratings.module";
import { PhotosModule } from "../photos/photos.module";

@Module({
  imports: [TokensModule, RatingsModule, PhotosModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
