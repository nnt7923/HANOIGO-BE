import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { RevokeTokenDto } from './dto/revoke-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register with email and password',
    description:
      'Creates an unverified account and sends an email_verification OTP.',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Returns accessToken and refreshToken. Email must be verified first.',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('login/google')
  @ApiOperation({
    summary: 'Login with Google ID token',
    description:
      'Verifies the frontend Google ID token against configured Google client IDs and returns accessToken plus refreshToken.',
  })
  loginWithGoogle(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Rotate refresh token and issue a new access token',
  })
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Logout current session',
    description: 'Revokes the session bound to the current access token.',
  })
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user);
  }

  @Post('logout-all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Logout all sessions',
    description:
      'Increments tokenVersion and revokes all refresh sessions for this user.',
  })
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAll(user);
  }

  @Post('revoke-token')
  @ApiOperation({
    summary: 'Revoke a refresh token',
    description:
      'Revokes a refresh token without requiring an access token. Useful for client-side logout cleanup.',
  })
  revokeToken(@Body() dto: RevokeTokenDto) {
    return this.authService.revokeToken(dto);
  }

  @Post('verify-otp')
  @ApiOperation({
    summary: 'Verify email OTP',
    description:
      'Consumes an email_verification OTP and returns accessToken plus refreshToken. Password reset OTPs must be consumed by reset-password.',
  })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('resend-otp')
  @ApiOperation({
    summary: 'Resend OTP',
    description:
      'Resends an OTP for the selected purpose. email_verification is used for account verification; password_reset is used by forgot-password/reset-password.',
  })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Change password',
    description:
      'Invalidates all previous access and refresh tokens by incrementing tokenVersion.',
  })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user, dto);
  }

  @Post('forgot-password')
  @ApiOperation({
    summary: 'Send password reset OTP',
    description: 'Sends a password_reset OTP if the email exists.',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset password using OTP',
    description:
      'Consumes a password_reset OTP, sets a new password, and invalidates previous sessions.',
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
