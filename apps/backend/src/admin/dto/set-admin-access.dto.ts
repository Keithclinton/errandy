import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class SetAdminAccessDto {
  @ApiProperty()
  @IsBoolean()
  isAdmin: boolean;
}
