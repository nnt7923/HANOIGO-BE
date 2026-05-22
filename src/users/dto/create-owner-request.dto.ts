import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateOwnerRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  businessName: string;

  @IsString()
  @MinLength(5)
  @MaxLength(300)
  businessAddress: string;

  @IsString()
  @MinLength(8)
  @MaxLength(30)
  contactPhone: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;
}
