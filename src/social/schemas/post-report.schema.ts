import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostReportDocument = HydratedDocument<PostReport>;

export enum PostReportStatus {
  Pending = 'pending',
  Reviewed = 'reviewed',
  Dismissed = 'dismissed',
}

@Schema({ timestamps: true })
export class PostReport {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true, index: true })
  post: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ enum: PostReportStatus, default: PostReportStatus.Pending })
  status: PostReportStatus;
}

export const PostReportSchema = SchemaFactory.createForClass(PostReport);

PostReportSchema.index({ post: 1, user: 1 }, { unique: true });
