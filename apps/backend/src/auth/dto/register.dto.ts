import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty()
  @IsBoolean()
  acceptedTerms: boolean;

  @ApiProperty()
  @IsString()
  termsVersion: string;
}
