import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from "class-validator";

export class ReviewIdVerificationDto {
  @ApiProperty({ enum: ["approve", "reject"] })
  @IsIn(["approve", "reject"])
  decision: "approve" | "reject";

  @ApiProperty({ required: false, description: "Shown to the user. Required when rejecting." })
  @ValidateIf((dto: ReviewIdVerificationDto) => dto.decision === "reject")
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason?: string;
}

export class QueryIdVerificationsDto {
  @ApiProperty({ required: false, enum: ["pending", "verified", "rejected"], default: "pending" })
  @IsOptional()
  @IsIn(["pending", "verified", "rejected"])
  status?: "pending" | "verified" | "rejected";
}
