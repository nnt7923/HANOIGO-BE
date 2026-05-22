import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RevokeTokenDto {
  @ApiProperty({
    description: 'Refresh token to revoke.',
  })
  @IsString()
  @MinLength(32)
  refreshToken: string;
}
