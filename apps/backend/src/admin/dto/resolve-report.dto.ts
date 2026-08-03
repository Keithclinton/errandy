import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export class ResolveReportDto {
  @ApiProperty({ enum: ["reviewed", "actioned", "dismissed"] })
  @IsIn(["reviewed", "actioned", "dismissed"])
  status: "reviewed" | "actioned" | "dismissed";
}
