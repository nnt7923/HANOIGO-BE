import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OwnerRequestDocument = HydratedDocument<OwnerRequest>;

export enum OwnerRequestStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

@Schema({ timestamps: true })
export class OwnerRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ required: true, trim: true })
  businessName: string;

  @Prop({ required: true, trim: true })
  businessAddress: string;

  @Prop({ required: true, trim: true })
  contactPhone: string;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ enum: OwnerRequestStatus, default: OwnerRequestStatus.Pending })
  status: OwnerRequestStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  @Prop()
  rejectionReason?: string;
}

export const OwnerRequestSchema = SchemaFactory.createForClass(OwnerRequest);

OwnerRequestSchema.index(
  { user: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: OwnerRequestStatus.Pending },
  },
);
