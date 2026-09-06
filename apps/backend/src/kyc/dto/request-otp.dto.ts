import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class RequestOtpDto {
  @ApiProperty({ description: "Kenyan phone number, e.g. 0712345678" })
  @IsString()
  phone: string;
}
