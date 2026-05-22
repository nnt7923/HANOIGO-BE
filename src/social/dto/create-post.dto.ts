import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PostType } from '../schemas/post.schema';

export class CreatePostDto {
  @IsMongoId()
  placeId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(3000)
  content: string;

  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  visitDate?: Date;
}
