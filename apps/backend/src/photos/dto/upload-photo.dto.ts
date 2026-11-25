import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class UploadPhotoDto {
  // A 1 MB photo is about 1.33 MB once base64-encoded. This only stops absurd payloads early;
  // the service checks the decoded size and that it really is a JPEG.
  @ApiProperty({ description: "data:image/jpeg;base64,..." })
  @IsString()
  @MaxLength(1_400_000)
  photo: string;
}
