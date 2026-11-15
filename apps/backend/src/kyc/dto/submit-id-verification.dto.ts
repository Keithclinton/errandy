import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Equals, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from "class-validator";
import { IdDocumentType } from "@prisma/client";

// A 1 MB photo is about 1.33 MB once base64-encoded. This only stops absurd payloads early;
// the service checks the decoded size and that it really is an image.
const MAX_DATA_URL_LENGTH = 1_400_000;

export class IdVerificationImagesDto {
  @ApiProperty({ description: "data:image/jpeg;base64,... photo of the front of the document" })
  @IsString()
  @MaxLength(MAX_DATA_URL_LENGTH)
  front: string;

  @ApiProperty({ required: false, description: "Photo of the back of the document. Not needed for a passport." })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DATA_URL_LENGTH)
  back?: string;

  @ApiProperty({ description: "A selfie, to compare with the photo on the document" })
  @IsString()
  @MaxLength(MAX_DATA_URL_LENGTH)
  selfie: string;
}

export class SubmitIdVerificationDto {
  @ApiProperty({ enum: IdDocumentType })
  @IsEnum(IdDocumentType)
  documentType: IdDocumentType;

  @ApiProperty({ description: "Full name exactly as it appears on the document" })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ description: "ID or passport number" })
  @IsString()
  @Matches(/^[A-Za-z0-9 -]{5,24}$/, { message: "Enter the number exactly as it appears on your document" })
  idNumber: string;

  @ApiProperty({ description: "Must be true: the person agrees to Errandspot checking these photos" })
  @Equals(true, { message: "You need to agree to the ID check to continue" })
  consent: boolean;

  @ApiProperty({ type: IdVerificationImagesDto })
  @ValidateNested()
  @Type(() => IdVerificationImagesDto)
  images: IdVerificationImagesDto;
}
