import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewOwnerRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionReason?: string;
}
