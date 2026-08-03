import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { VerifiedGuard } from "../common/guards/verified.guard";
import { ListingsService } from "./listings.service";
import { CreateListingDto } from "./dto/create-listing.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";
import { QueryListingsDto } from "./dto/query-listings.dto";
import { RequestUploadUrlDto } from "./dto/request-upload-url.dto";

@ApiTags("listings")
@Controller("listings")
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @ApiBearerAuth()
  @UseGuards(VerifiedGuard)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateListingDto) {
    return this.listingsService.create(user.id, dto);
  }

  @Public()
  @Get()
  findMany(@Query() query: QueryListingsDto) {
    return this.listingsService.findMany(query);
  }

  @Public()
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.listingsService.findOne(id);
  }

  @ApiBearerAuth()
  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateListingDto) {
    return this.listingsService.update(user.id, id, dto);
  }

  @ApiBearerAuth()
  @Post(":id/upload-url")
  requestUploadUrl(@CurrentUser() user: AuthUser, @Body() dto: RequestUploadUrlDto) {
    return this.listingsService.requestUploadUrl(user.id, dto);
  }

  @ApiBearerAuth()
  @Patch(":id/complete")
  complete(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.listingsService.markCompleted(user.id, id);
  }
}
