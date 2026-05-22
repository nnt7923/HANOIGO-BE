import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GenerateItineraryDto {
  @IsString()
  area = 'Hoa Lac, Hanoi';

  @Type(() => Number)
  @Min(1)
  @Max(14)
  days: number;

  @Type(() => Number)
  @Min(0)
  budgetVnd: number;

  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  preferences: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(100)
  @Max(50000)
  radiusMeters?: number = 10000;
}
