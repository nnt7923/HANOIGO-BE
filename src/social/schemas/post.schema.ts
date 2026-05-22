import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostDocument = HydratedDocument<Post>;

export enum PostType {
  CheckIn = 'check_in',
  Experience = 'experience',
  Tip = 'tip',
}

export enum PostStatus {
  Published = 'published',
  Hidden = 'hidden',
  Deleted = 'deleted',
}

@Schema({ timestamps: true })
export class Post {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  author: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Place', required: true, index: true })
  place: Types.ObjectId;

  @Prop({ required: true, trim: true })
  content: string;

  @Prop({ enum: PostType, default: PostType.Experience, index: true })
  type: PostType;

  @Prop({ enum: PostStatus, default: PostStatus.Published, index: true })
  status: PostStatus;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  visitDate?: Date;

  @Prop({ default: 0 })
  likeCount: number;

  @Prop({ default: 0 })
  commentCount: number;

  @Prop({ default: 0 })
  saveCount: number;

  @Prop({ default: 0 })
  reportCount: number;
}

export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ place: 1, status: 1, createdAt: -1 });
PostSchema.index({ author: 1, status: 1, createdAt: -1 });
PostSchema.index({ status: 1, likeCount: -1, commentCount: -1, createdAt: -1 });
