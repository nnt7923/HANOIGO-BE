import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserFollowDocument = HydratedDocument<UserFollow>;

@Schema({ timestamps: true })
export class UserFollow {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  follower: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  following: Types.ObjectId;
}

export const UserFollowSchema = SchemaFactory.createForClass(UserFollow);

UserFollowSchema.index({ follower: 1, following: 1 }, { unique: true });
