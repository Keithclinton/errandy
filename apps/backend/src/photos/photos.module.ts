import { Module } from "@nestjs/common";
import { PhotosController, PhotosCronController } from "./photos.controller";
import { PhotosService } from "./photos.service";

@Module({
  controllers: [PhotosController, PhotosCronController],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
