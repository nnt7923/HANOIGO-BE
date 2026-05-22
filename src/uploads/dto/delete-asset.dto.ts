import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DeleteAssetDto {
  @ApiProperty({
    example: 'hanoigo/places/sample-public-id',
    description: 'Cloudinary public_id returned by an upload endpoint.',
  })
  @IsString()
  @MinLength(1)
  publicId: string;
}
