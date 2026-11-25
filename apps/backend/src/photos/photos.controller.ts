import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiExcludeController, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { CronGuard } from "../common/guards/cron.guard";
import { UploadPhotoDto } from "./dto/upload-photo.dto";
import { PhotosService } from "./photos.service";

@ApiTags("photos")
@ApiBearerAuth()
@Controller("photos")
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  /** Stores a photo and returns its address, to save on a listing or profile afterwards. */
  @Post()
  upload(@CurrentUser() user: AuthUser, @Body() dto: UploadPhotoDto) {
    return this.photosService.save(user.id, dto.photo);
  }
}

@ApiExcludeController()
@Controller("cron")
export class PhotosCronController {
  constructor(private readonly photosService: PhotosService) {}

  @Public()
  @UseGuards(CronGuard)
  @Get("cleanup-photos")
  cleanup() {
    return this.photosService.removeUnused();
  }
}
