import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlacesModule } from '../places/places.module';
import { UploadsModule } from '../uploads/uploads.module';
import { UsersModule } from '../users/users.module';
import { PostComment, PostCommentSchema } from './schemas/post-comment.schema';
import { PostLike, PostLikeSchema } from './schemas/post-like.schema';
import { PostReport, PostReportSchema } from './schemas/post-report.schema';
import { PostSave, PostSaveSchema } from './schemas/post-save.schema';
import { Post, PostSchema } from './schemas/post.schema';
import { UserFollow, UserFollowSchema } from './schemas/user-follow.schema';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [
    UsersModule,
    PlacesModule,
    UploadsModule,
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: PostComment.name, schema: PostCommentSchema },
      { name: PostLike.name, schema: PostLikeSchema },
      { name: PostSave.name, schema: PostSaveSchema },
      { name: PostReport.name, schema: PostReportSchema },
      { name: UserFollow.name, schema: UserFollowSchema },
    ]),
  ],
  controllers: [SocialController],
  providers: [SocialService],
})
export class SocialModule {}
