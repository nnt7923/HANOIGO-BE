import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import { Model, Types } from 'mongoose';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AuthProvider } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
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
import { EmailService } from './email.service';
import {
  AuthSession,
  AuthSessionDocument,
} from './schemas/auth-session.schema';
import {
  AuthOtp,
  AuthOtpDocument,
  OtpPurpose,
} from './schemas/auth-otp.schema';

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    @InjectModel(AuthOtp.name)
    private readonly authOtpModel: Model<AuthOtpDocument>,
    @InjectModel(AuthSession.name)
    private readonly authSessionModel: Model<AuthSessionDocument>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: UserRole.User,
    });

    await this.sendOtp(user.email, OtpPurpose.EmailVerification);

    return {
      message: 'Registration created. Please verify the OTP sent to email.',
      email: user.email,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Please verify your email before login');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Use Google login for this account');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueAuthTokens(user);
  }

  async loginWithGoogle(dto: GoogleLoginDto) {
    const googleClientIds = this.getGoogleClientIds();
    if (!googleClientIds.length) {
      throw new ServiceUnavailableException('Google login is not configured');
    }

    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.idToken,
      audience: googleClientIds,
    });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new UnauthorizedException('Invalid Google account');
    }

    let user = await this.usersService.findByGoogleId(payload.sub);
    if (!user) {
      const existing = await this.usersService.findByEmail(payload.email);
      user = existing
        ? await this.usersService.attachGoogleAccount(existing.id, {
            googleId: payload.sub,
            name: payload.name,
            avatarUrl: payload.picture,
          })
        : await this.usersService.create({
            name: payload.name ?? payload.email.split('@')[0],
            email: payload.email,
            authProvider: AuthProvider.Google,
            googleId: payload.sub,
            avatarUrl: payload.picture,
            emailVerifiedAt: new Date(),
          });
    }

    return this.issueAuthTokens(user);
  }

  private getGoogleClientIds() {
    const singleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const multipleClientIds =
      this.configService.get<string>('GOOGLE_CLIENT_IDS');

    return [singleClientId, ...(multipleClientIds?.split(',') ?? [])]
      .map((clientId) => clientId?.trim())
      .filter((clientId): clientId is string => Boolean(clientId));
  }

  async refreshToken(dto: RefreshTokenDto) {
    const refreshTokenHash = this.hashRefreshToken(dto.refreshToken);
    const session = await this.authSessionModel
      .findOne({
        refreshTokenHash,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      })
      .exec();

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findByIdOrThrow(
      session.user.toString(),
    );

    if (user.tokenVersion !== session.tokenVersion) {
      session.revokedAt = new Date();
      await session.save();
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const refreshToken = this.createRefreshToken();
    session.refreshTokenHash = this.hashRefreshToken(refreshToken);
    session.lastUsedAt = new Date();
    session.expiresAt = this.getRefreshTokenExpiry();
    await session.save();

    return this.issueAuthTokens(user, session, refreshToken);
  }

  async logout(user: AuthenticatedUser) {
    if (!user.sessionId) {
      return { loggedOut: true };
    }

    await this.authSessionModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(user.sessionId),
          user: new Types.ObjectId(user.id),
          revokedAt: { $exists: false },
        },
        { revokedAt: new Date() },
      )
      .exec();

    return { loggedOut: true };
  }

  async logoutAll(user: AuthenticatedUser) {
    await this.usersService.incrementTokenVersion(user.id);
    await this.revokeAllSessionsForUser(user.id);
    return { loggedOut: true };
  }

  async revokeToken(dto: RevokeTokenDto) {
    await this.authSessionModel
      .findOneAndUpdate(
        {
          refreshTokenHash: this.hashRefreshToken(dto.refreshToken),
          revokedAt: { $exists: false },
        },
        { revokedAt: new Date() },
      )
      .exec();

    return { revoked: true };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const purpose = dto.purpose ?? OtpPurpose.EmailVerification;
    if (purpose !== OtpPurpose.EmailVerification) {
      throw new BadRequestException(
        'Use reset-password for password reset OTP',
      );
    }

    const otp = await this.verifyAndConsumeOtp(dto.email, dto.code, purpose);
    const user = await this.usersService.findByEmail(otp.email);

    if (!user) {
      throw new BadRequestException('Invalid OTP');
    }

    const verifiedUser = user.emailVerifiedAt
      ? user
      : await this.usersService.markEmailVerified(user.id);

    return this.issueAuthTokens(verifiedUser);
  }

  async resendOtp(dto: ResendOtpDto) {
    const purpose = dto.purpose ?? OtpPurpose.EmailVerification;
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      return {
        message: 'If the email exists, a new OTP has been sent.',
      };
    }

    if (purpose === OtpPurpose.EmailVerification && user.emailVerifiedAt) {
      return {
        message: 'Email is already verified.',
      };
    }

    await this.assertOtpCooldown(user.email, purpose);
    await this.sendOtp(user.email, purpose);
    return {
      message: 'If the email exists, a new OTP has been sent.',
    };
  }

  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto) {
    const account = await this.usersService.findByEmailWithPassword(user.email);
    if (!account?.passwordHash) {
      throw new BadRequestException('Password login is not enabled');
    }

    const valid = await bcrypt.compare(
      dto.currentPassword,
      account.passwordHash,
    );
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.usersService.setPassword(account.id, passwordHash);
    await this.revokeAllSessionsForUser(account.id);

    return { changed: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (user) {
      await this.assertOtpCooldown(user.email, OtpPurpose.PasswordReset);
      await this.sendOtp(user.email, OtpPurpose.PasswordReset);
    }

    return {
      message: 'If the email exists, a password reset OTP has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const otp = await this.verifyAndConsumeOtp(
      dto.email,
      dto.code,
      OtpPurpose.PasswordReset,
    );
    const user = await this.usersService.findByEmail(otp.email);

    if (!user) {
      throw new BadRequestException('Invalid OTP');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.usersService.setPassword(user.id, passwordHash);
    await this.revokeAllSessionsForUser(user.id);

    if (!user.emailVerifiedAt) {
      await this.usersService.markEmailVerified(user.id);
    }

    return { reset: true };
  }

  private async sendOtp(email: string, purpose: OtpPurpose) {
    const code = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const codeHash = await bcrypt.hash(code, 12);

    await this.authOtpModel.updateMany(
      {
        email: email.toLowerCase(),
        purpose,
        consumedAt: { $exists: false },
      },
      { consumedAt: new Date() },
    );

    await this.authOtpModel.create({
      email: email.toLowerCase(),
      purpose,
      codeHash,
      expiresAt,
    });

    await this.emailService.sendOtp({
      to: email,
      code,
      subject:
        purpose === OtpPurpose.EmailVerification
          ? 'Verify your HanoiGo account'
          : 'Reset your HanoiGo password',
      purposeText:
        purpose === OtpPurpose.EmailVerification
          ? 'email verification'
          : 'password reset',
    });
  }

  private async assertOtpCooldown(email: string, purpose: OtpPurpose) {
    const cooldownSeconds = Number(
      this.configService.get<string>('OTP_RESEND_COOLDOWN_SECONDS', '60'),
    );

    if (cooldownSeconds <= 0) {
      return;
    }

    const latestOtp = await this.authOtpModel
      .findOne({
        email: email.toLowerCase(),
        purpose,
        createdAt: { $gt: new Date(Date.now() - cooldownSeconds * 1000) },
      })
      .sort({ createdAt: -1 })
      .exec();

    if (latestOtp) {
      throw new HttpException(
        `Please wait ${cooldownSeconds} seconds before requesting another OTP`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async verifyAndConsumeOtp(
    email: string,
    code: string,
    purpose: OtpPurpose,
  ) {
    const otp = await this.authOtpModel
      .findOne({
        email: email.toLowerCase(),
        purpose,
        consumedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .select('+codeHash')
      .exec();

    if (!otp || otp.attempts >= 5) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const valid = await bcrypt.compare(code, otp.codeHash);
    if (!valid) {
      otp.attempts += 1;
      await otp.save();
      throw new BadRequestException('Invalid or expired OTP');
    }

    otp.consumedAt = new Date();
    await otp.save();
    return otp;
  }

  private async issueAuthTokens(
    user: { id: string; email: string; role: UserRole; tokenVersion: number },
    existingSession?: AuthSessionDocument,
    existingRefreshToken?: string,
  ) {
    const tokenVersion = user.tokenVersion ?? 0;
    const refreshToken = existingRefreshToken ?? this.createRefreshToken();
    const session =
      existingSession ??
      (await this.authSessionModel.create({
        user: new Types.ObjectId(user.id),
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        tokenVersion,
        lastUsedAt: new Date(),
        expiresAt: this.getRefreshTokenExpiry(),
      }));

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion,
      sid: session.id,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  private createRefreshToken() {
    return randomBytes(64).toString('hex');
  }

  private hashRefreshToken(refreshToken: string) {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private getRefreshTokenExpiry() {
    const days = Number(
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_DAYS', '30'),
    );
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private async revokeAllSessionsForUser(userId: string) {
    await this.authSessionModel
      .updateMany(
        {
          user: new Types.ObjectId(userId),
          revokedAt: { $exists: false },
        },
        { revokedAt: new Date() },
      )
      .exec();
  }
}
