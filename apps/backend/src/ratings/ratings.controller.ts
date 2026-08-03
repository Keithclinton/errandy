import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { RatingsService } from "./ratings.service";
import { CreateRatingDto } from "./dto/create-rating.dto";

@ApiTags("ratings")
@ApiBearerAuth()
@Controller()
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post("listings/:listingId/ratings")
  submit(@CurrentUser() user: AuthUser, @Param("listingId") listingId: string, @Body() dto: CreateRatingDto) {
    return this.ratingsService.submit(listingId, user.id, dto);
  }

  @Get("listings/:listingId/ratings")
  forListing(@CurrentUser() user: AuthUser, @Param("listingId") listingId: string) {
    return this.ratingsService.getForListing(listingId, user.id);
  }

  @Get("users/:userId/ratings")
  forUser(@Param("userId") userId: string) {
    return this.ratingsService.getForUser(userId);
  }
}
