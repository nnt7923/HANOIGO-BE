import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuthSessionDocument = HydratedDocument<AuthSession>;

@Schema({ timestamps: true })
export class AuthSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  refreshTokenHash: string;

  @Prop({ required: true })
  tokenVersion: number;

  @Prop()
  userAgent?: string;

  @Prop()
  ipAddress?: string;

  @Prop()
  revokedAt?: Date;

  @Prop()
  lastUsedAt?: Date;

  @Prop({ required: true })
  expiresAt: Date;
}

export const AuthSessionSchema = SchemaFactory.createForClass(AuthSession);

AuthSessionSchema.index({ user: 1, revokedAt: 1 });
AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
