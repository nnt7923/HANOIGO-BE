import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PostType } from '../schemas/post.schema';

export class PostQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsMongoId()
  placeId?: string;

  @IsOptional()
  @IsMongoId()
  authorId?: string;

  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;

  @IsOptional()
  @IsString()
  tag?: string;
}
