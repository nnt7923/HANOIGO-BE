import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UploadAssetDocument = HydratedDocument<UploadAsset>;

export enum UploadAssetStatus {
  Temporary = 'temporary',
  Attached = 'attached',
  Deleted = 'deleted',
}

export enum UploadAssetEntityType {
  Place = 'place',
  Post = 'post',
  Review = 'review',
  User = 'user',
}

@Schema({ timestamps: true })
export class UploadAsset {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner: Types.ObjectId;

  @Prop({ required: true, unique: true })
  publicId: string;

  @Prop({ required: true, unique: true })
  secureUrl: string;

  @Prop({ required: true })
  format: string;

  @Prop({ required: true })
  bytes: number;

  @Prop({ required: true })
  width: number;

  @Prop({ required: true })
  height: number;

  @Prop({ enum: UploadAssetStatus, default: UploadAssetStatus.Temporary })
  status: UploadAssetStatus;

  @Prop({ enum: UploadAssetEntityType })
  entityType?: UploadAssetEntityType;

  @Prop({ type: Types.ObjectId })
  entityId?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const UploadAssetSchema = SchemaFactory.createForClass(UploadAsset);

UploadAssetSchema.index({ owner: 1, status: 1 });
UploadAssetSchema.index({ entityType: 1, entityId: 1 });
