import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ItineraryDocument = HydratedDocument<Itinerary>;

export enum ItinerarySource {
  Gemini = 'gemini',
  Cache = 'cache',
  Fallback = 'fallback',
}

export enum ItineraryVisibility {
  Private = 'private',
  Public = 'public',
  Unlisted = 'unlisted',
}

@Schema({ timestamps: true })
export class Itinerary {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  area: string;

  @Prop({ required: true, min: 1, max: 14 })
  days: number;

  @Prop({ required: true, min: 0 })
  budgetVnd: number;

  @Prop({ type: [String], default: [] })
  preferences: string[];

  @Prop({ type: [Types.ObjectId], ref: 'Place', default: [] })
  places: Types.ObjectId[];

  @Prop({ type: Object, required: true })
  plan: Record<string, unknown>;

  @Prop({ required: true, index: true })
  cacheKey: string;

  @Prop({ enum: ItinerarySource, default: ItinerarySource.Gemini })
  source: ItinerarySource;

  @Prop({ enum: ItineraryVisibility, default: ItineraryVisibility.Private })
  visibility: ItineraryVisibility;

  @Prop({ default: 0 })
  cloneCount: number;

  @Prop({ type: Types.ObjectId, ref: 'Itinerary' })
  clonedFrom?: Types.ObjectId;

  @Prop({ default: () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) })
  expiresAt: Date;
}

export const ItinerarySchema = SchemaFactory.createForClass(Itinerary);

ItinerarySchema.index({ cacheKey: 1, createdAt: -1 });
ItinerarySchema.index({ user: 1, createdAt: -1 });
ItinerarySchema.index({ visibility: 1, createdAt: -1 });
