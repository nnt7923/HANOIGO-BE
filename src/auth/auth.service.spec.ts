import { HttpException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthProvider } from '../users/schemas/user.schema';
import { AuthService } from './auth.service';
import { OtpPurpose } from './schemas/auth-otp.schema';

describe('AuthService', () => {
  const baseUser = {
    id: '507f1f77bcf86cd799439011',
    _id: '507f1f77bcf86cd799439011',
    name: 'Test User',
    email: 'test@example.com',
    role: UserRole.User,
    authProvider: AuthProvider.Local,
    emailVerifiedAt: new Date(),
    tokenVersion: 0,
  };

  const makeService = (overrides?: {
    usersService?: Record<string, jest.Mock>;
    authOtpModel?: Record<string, jest.Mock>;
    authSessionModel?: Record<string, jest.Mock>;
  }) => {
    const authOtpModel = {
      findOne: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      ...overrides?.authOtpModel,
    };
    const authSessionModel = {
      create: jest.fn().mockResolvedValue({ id: 'session-id' }),
      updateMany: jest.fn().mockReturnValue({ exec: jest.fn() }),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn() }),
      ...overrides?.authSessionModel,
    };
    const usersService = {
      findByEmailWithPassword: jest.fn(),
      findByEmail: jest.fn(),
      setPassword: jest.fn(),
      incrementTokenVersion: jest.fn(),
      findByIdOrThrow: jest.fn(),
      ...overrides?.usersService,
    };
    const jwtService = {
      sign: jest.fn().mockReturnValue('access-token'),
    };
    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          REFRESH_TOKEN_EXPIRES_DAYS: '30',
          OTP_RESEND_COOLDOWN_SECONDS: '60',
        };
        return values[key] ?? fallback;
      }),
    };
    const emailService = {
      sendOtp: jest.fn(),
    };

    const service = new AuthService(
      authOtpModel as never,
      authSessionModel as never,
      usersService as never,
      jwtService as never,
      configService as never,
      emailService as never,
    );

    return {
      service,
      authOtpModel,
      authSessionModel,
      usersService,
      jwtService,
      emailService,
    };
  };

  it('logs in verified users and creates a refresh session', async () => {
    const passwordHash = await bcrypt.hash('password123', 1);
    const { service, authSessionModel, usersService } = makeService({
      usersService: {
        findByEmailWithPassword: jest.fn().mockResolvedValue({
          ...baseUser,
          passwordHash,
        }),
      },
    });

    const result = await service.login({
      email: baseUser.email,
      password: 'password123',
    });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toHaveLength(128);
    const createSessionMock = authSessionModel.create as jest.MockedFunction<
      (payload: unknown) => Promise<unknown>
    >;
    const createSessionPayload = createSessionMock.mock.calls[0]?.[0] as
      | { refreshTokenHash?: unknown; tokenVersion?: unknown }
      | undefined;
    expect(typeof createSessionPayload?.refreshTokenHash).toBe('string');
    expect(createSessionPayload?.tokenVersion).toBe(0);
    expect(usersService.findByEmailWithPassword).toHaveBeenCalledWith(
      baseUser.email,
    );
  });

  it('changes password and revokes existing sessions', async () => {
    const passwordHash = await bcrypt.hash('old-password', 1);
    const { service, authSessionModel, usersService } = makeService({
      usersService: {
        findByEmailWithPassword: jest.fn().mockResolvedValue({
          ...baseUser,
          passwordHash,
        }),
        setPassword: jest.fn().mockResolvedValue({
          ...baseUser,
          tokenVersion: 1,
        }),
      },
    });

    await expect(
      service.changePassword(
        {
          id: baseUser.id,
          email: baseUser.email,
          role: baseUser.role,
          tokenVersion: 0,
        },
        { currentPassword: 'old-password', newPassword: 'new-password' },
      ),
    ).resolves.toEqual({ changed: true });

    expect(usersService.setPassword).toHaveBeenCalledWith(
      baseUser.id,
      expect.any(String),
    );
    const updateManyCall = authSessionModel.updateMany.mock.calls[0] as
      | [{ revokedAt?: unknown }, { revokedAt?: unknown }]
      | undefined;
    expect(updateManyCall?.[0].revokedAt).toEqual({ $exists: false });
    expect(updateManyCall?.[1].revokedAt).toBeInstanceOf(Date);
  });

  it('limits OTP resend during cooldown window', async () => {
    const { service, authOtpModel } = makeService({
      usersService: {
        findByEmail: jest.fn().mockResolvedValue({
          ...baseUser,
          emailVerifiedAt: undefined,
        }),
      },
      authOtpModel: {
        findOne: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ id: 'otp-id' }),
          }),
        }),
      },
    });

    await expect(
      service.resendOtp({
        email: baseUser.email,
        purpose: OtpPurpose.EmailVerification,
      }),
    ).rejects.toBeInstanceOf(HttpException);

    expect(authOtpModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        email: baseUser.email,
        purpose: OtpPurpose.EmailVerification,
      }),
    );
  });
});
