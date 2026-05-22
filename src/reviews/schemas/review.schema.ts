import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

export enum ReviewStatus {
  Published = 'published',
  Hidden = 'hidden',
}

@Schema({ _id: false })
export class ReviewReport {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  reason: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

@Schema({ _id: false })
export class OwnerReply {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  message: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

@Schema({ timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Place', required: true, index: true })
  place: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ required: true, trim: true })
  comment: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ enum: ReviewStatus, default: ReviewStatus.Published, index: true })
  status: ReviewStatus;

  @Prop({ type: [ReviewReport], default: [] })
  reports: ReviewReport[];

  @Prop({ type: OwnerReply })
  ownerReply?: OwnerReply;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.index({ user: 1, place: 1 }, { unique: true });
ReviewSchema.index({ place: 1, status: 1 });
