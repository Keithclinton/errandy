import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { VerifiedGuard } from "../common/guards/verified.guard";
import { BidsService } from "./bids.service";
import { CreateBidDto } from "./dto/create-bid.dto";

@ApiTags("bids")
@ApiBearerAuth()
@Controller()
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @UseGuards(VerifiedGuard)
  @Post("listings/:listingId/bids")
  place(@CurrentUser() user: AuthUser, @Param("listingId") listingId: string, @Body() dto: CreateBidDto) {
    return this.bidsService.place(listingId, user.id, dto);
  }

  @Get("bids/mine")
  listMine(@CurrentUser() user: AuthUser) {
    return this.bidsService.listMine(user.id);
  }

  @Get("bids/received")
  listReceived(@CurrentUser() user: AuthUser) {
    return this.bidsService.listReceived(user.id);
  }

  @Patch("bids/:id/withdraw")
  withdraw(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.bidsService.withdraw(id, user.id);
  }

  @Patch("bids/:id/accept")
  accept(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.bidsService.accept(id, user.id);
  }

  @Patch("bids/:id/decline")
  decline(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.bidsService.decline(id, user.id);
  }
}
