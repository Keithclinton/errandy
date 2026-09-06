import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

export class VerifyOtpDto {
  @ApiProperty({ description: "The phone number the code was sent to" })
  @IsString()
  phone: string;

  @ApiProperty({ description: "6-digit code sent by SMS" })
  @IsString()
  @Length(6, 6)
  code: string;
}
