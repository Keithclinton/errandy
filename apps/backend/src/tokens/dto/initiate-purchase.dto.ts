import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class InitiatePurchaseDto {
  @ApiProperty({ description: "One of the ids returned by GET /tokens/packs" })
  @IsString()
  packId: string;

  @ApiProperty({ description: "M-Pesa phone number to charge, e.g. 0712345678" })
  @IsString()
  phone: string;
}
