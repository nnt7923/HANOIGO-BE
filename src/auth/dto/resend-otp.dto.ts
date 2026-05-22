import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { OtpPurpose } from '../schemas/auth-otp.schema';

export class ResendOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    enum: OtpPurpose,
    enumName: 'OtpPurpose',
    default: OtpPurpose.EmailVerification,
    description:
      'email_verification verifies a newly registered account. password_reset is for forgot/reset password.',
  })
  @IsOptional()
  @IsEnum(OtpPurpose)
  purpose?: OtpPurpose = OtpPurpose.EmailVerification;
}
