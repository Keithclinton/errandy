import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class RequestUploadUrlDto {
  @ApiProperty()
  @IsString()
  filename: string;

  @ApiProperty()
  @IsString()
  contentType: string;
}
