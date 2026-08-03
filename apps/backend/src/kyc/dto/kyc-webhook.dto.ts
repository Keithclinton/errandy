import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsObject, IsOptional, IsString } from "class-validator";

export class KycWebhookDto {
  @ApiProperty()
  @IsString()
  job_id: string;

  @ApiProperty({ enum: ["approved", "rejected"] })
  @IsIn(["approved", "rejected"])
  status: "approved" | "rejected";

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  result?: Record<string, unknown>;
}
