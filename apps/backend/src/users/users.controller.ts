import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { RequestUploadUrlDto } from "../listings/dto/request-upload-url.dto";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.findById(user.id);
  }

  @Patch("me")
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post("me/upload-url")
  requestUploadUrl(@CurrentUser() user: AuthUser, @Body() dto: RequestUploadUrlDto) {
    return this.usersService.requestUploadUrl(user.id, dto);
  }

  @Public()
  @Get(":id")
  publicProfile(@Param("id") id: string) {
    return this.usersService.findPublicProfile(id);
  }
}
