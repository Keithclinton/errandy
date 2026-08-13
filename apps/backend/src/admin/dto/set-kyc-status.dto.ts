import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { KycStatus } from "@prisma/client";

export class SetKycStatusDto {
  @ApiProperty({ enum: KycStatus })
  @IsEnum(KycStatus)
  status: KycStatus;
}
