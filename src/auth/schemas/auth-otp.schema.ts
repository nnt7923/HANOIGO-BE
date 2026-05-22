import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuthOtpDocument = HydratedDocument<AuthOtp>;

export enum OtpPurpose {
  EmailVerification = 'email_verification',
  PasswordReset = 'password_reset',
}

@Schema({ timestamps: true })
export class AuthOtp {
  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ enum: OtpPurpose, required: true, index: true })
  purpose: OtpPurpose;

  @Prop({ required: true, select: false })
  codeHash: string;

  @Prop({ default: 0 })
  attempts: number;

  @Prop()
  consumedAt?: Date;

  @Prop({ required: true })
  expiresAt: Date;
}

export const AuthOtpSchema = SchemaFactory.createForClass(AuthOtp);

AuthOtpSchema.index({ email: 1, purpose: 1, createdAt: -1 });
AuthOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
