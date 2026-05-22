import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PlaceDocument = HydratedDocument<Place>;

export enum PlaceCategory {
  Food = 'food',
  Cafe = 'cafe',
  Stay = 'stay',
  Attraction = 'attraction',
  Workspace = 'workspace',
  Transport = 'transport',
  Other = 'other',
}

export enum PlaceStatus {
  Draft = 'draft',
  PendingReview = 'pending_review',
  Published = 'published',
  Rejected = 'rejected',
  Suspended = 'suspended',
}

export type GeoPoint = {
  type: 'Point';
  coordinates: [number, number];
};

@Schema({ timestamps: true })
export class Place {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ required: true })
  description: string;

  @Prop({ enum: PlaceCategory, default: PlaceCategory.Other, index: true })
  category: PlaceCategory;

  @Prop({ required: true })
  address: string;

  @Prop(
    raw({
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    }),
  )
  location: GeoPoint;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner: Types.ObjectId;

  @Prop({ enum: PlaceStatus, default: PlaceStatus.Published, index: true })
  status: PlaceStatus;

  @Prop()
  moderationReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: 0 })
  ratingAverage: number;

  @Prop({ default: 0 })
  ratingCount: number;

  @Prop({ type: Object })
  openingHours?: Record<string, string>;
}

export const PlaceSchema = SchemaFactory.createForClass(Place);

PlaceSchema.index({ location: '2dsphere' });
PlaceSchema.index({ name: 'text', description: 'text', address: 'text' });
PlaceSchema.index({ category: 1, status: 1 });
