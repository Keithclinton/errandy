import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, MinLength } from "class-validator";
import { TASK_CATEGORIES } from "../categories";

export class CreateListingDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  title: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({ enum: TASK_CATEGORIES })
  @IsIn(TASK_CATEGORIES)
  category: string;

  @ApiProperty()
  @IsString()
  location: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  budget?: number;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  imageUrls?: string[];
}
