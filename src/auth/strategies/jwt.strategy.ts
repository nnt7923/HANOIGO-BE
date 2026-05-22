import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Model, Types } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { UsersService } from '../../users/users.service';
import {
  AuthSession,
  AuthSessionDocument,
} from '../schemas/auth-session.schema';

type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  tokenVersion: number;
  sid?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    @InjectModel(AuthSession.name)
    private readonly authSessionModel: Model<AuthSessionDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findByIdOrThrow(payload.sub);
    if ((user.tokenVersion ?? 0) !== payload.tokenVersion) {
      throw new UnauthorizedException('Token has been revoked');
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Email is not verified');
    }

    if (payload.sid) {
      const activeSession = await this.authSessionModel.exists({
        _id: new Types.ObjectId(payload.sid),
        user: user._id,
        tokenVersion: payload.tokenVersion,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      });

      if (!activeSession) {
        throw new UnauthorizedException('Session has been revoked');
      }
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tokenVersion: payload.tokenVersion,
      emailVerifiedAt: user.emailVerifiedAt,
      sessionId: payload.sid,
    };
  }
}
