import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class StartVerificationDto {
  @ApiProperty({ description: "Explicit consent to Smile ID processing the ID + selfie capture" })
  @IsBoolean()
  consent: boolean;
}
