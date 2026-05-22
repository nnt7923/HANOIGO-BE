import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { SubscriptionPlan, SubscriptionStatus } from '../schemas/user.schema';

export class UpdateSubscriptionDto {
  @IsEnum(SubscriptionPlan)
  subscriptionPlan: SubscriptionPlan;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyItineraryLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  placeLimit?: number;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  subscriptionStatus?: SubscriptionStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  subscriptionExpiresAt?: Date;
}
