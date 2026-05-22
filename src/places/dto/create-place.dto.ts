import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PlaceCategory } from '../schemas/place.schema';

export class CreatePlaceDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsString()
  description: string;

  @IsEnum(PlaceCategory)
  category: PlaceCategory;

  @IsString()
  address: string;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  openingHours?: Record<string, string>;
}
