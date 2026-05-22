import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostSaveDocument = HydratedDocument<PostSave>;

@Schema({ timestamps: true })
export class PostSave {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true, index: true })
  post: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;
}

export const PostSaveSchema = SchemaFactory.createForClass(PostSave);

PostSaveSchema.index({ post: 1, user: 1 }, { unique: true });
