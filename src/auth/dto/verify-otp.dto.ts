import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { OtpPurpose } from '../schemas/auth-otp.schema';

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code.' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiPropertyOptional({
    enum: OtpPurpose,
    enumName: 'OtpPurpose',
    default: OtpPurpose.EmailVerification,
    description:
      'Only email_verification is accepted here. Use reset-password for password_reset OTPs.',
  })
  @IsOptional()
  @IsEnum(OtpPurpose)
  purpose?: OtpPurpose = OtpPurpose.EmailVerification;
}
