import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole } from '../../common/enums/user-role.enum';

export type UserDocument = HydratedDocument<User>;

export enum SubscriptionPlan {
  Free = 'free',
  Pro = 'pro',
}

export enum SubscriptionStatus {
  Active = 'active',
  Canceled = 'canceled',
  Expired = 'expired',
}

export enum AuthProvider {
  Local = 'local',
  Google = 'google',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ select: false })
  passwordHash?: string;

  @Prop({ enum: AuthProvider, default: AuthProvider.Local })
  authProvider: AuthProvider;

  @Prop({ unique: true, sparse: true })
  googleId?: string;

  @Prop()
  emailVerifiedAt?: Date;

  @Prop({ default: 0 })
  tokenVersion: number;

  @Prop({ enum: UserRole, default: UserRole.User })
  role: UserRole;

  @Prop()
  avatarUrl?: string;

  @Prop({ enum: SubscriptionPlan, default: SubscriptionPlan.Free })
  subscriptionPlan: SubscriptionPlan;

  @Prop({ enum: SubscriptionStatus, default: SubscriptionStatus.Active })
  subscriptionStatus: SubscriptionStatus;

  @Prop()
  subscriptionExpiresAt?: Date;

  @Prop({ default: 5 })
  monthlyItineraryLimit: number;

  @Prop({ default: 3 })
  placeLimit: number;

  @Prop({ default: 0 })
  itineraryUsageCount: number;

  @Prop({ default: () => new Date() })
  usageResetAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
