import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostCommentDocument = HydratedDocument<PostComment>;

export enum PostCommentStatus {
  Published = 'published',
  Hidden = 'hidden',
  Deleted = 'deleted',
}

@Schema({ _id: false })
export class PostCommentReport {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  reason: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

@Schema({ timestamps: true })
export class PostComment {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true, index: true })
  post: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  author: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PostComment' })
  parentComment?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  content: string;

  @Prop({ enum: PostCommentStatus, default: PostCommentStatus.Published })
  status: PostCommentStatus;

  @Prop({ default: 0 })
  reportCount: number;

  @Prop({ type: [PostCommentReport], default: [] })
  reports: PostCommentReport[];
}

export const PostCommentSchema = SchemaFactory.createForClass(PostComment);

PostCommentSchema.index({ post: 1, status: 1, createdAt: 1 });
