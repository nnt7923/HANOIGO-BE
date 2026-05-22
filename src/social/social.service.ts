import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PlacesService } from '../places/places.service';
import { UploadAssetEntityType } from '../uploads/schemas/upload-asset.schema';
import { UploadsService } from '../uploads/uploads.service';
import { UsersService } from '../users/users.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { ReportPostDto } from './dto/report-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import {
  PostComment,
  PostCommentDocument,
  PostCommentStatus,
} from './schemas/post-comment.schema';
import { PostLike, PostLikeDocument } from './schemas/post-like.schema';
import { PostReport, PostReportDocument } from './schemas/post-report.schema';
import { PostSave, PostSaveDocument } from './schemas/post-save.schema';
import { Post, PostDocument, PostStatus } from './schemas/post.schema';
import { UserFollow, UserFollowDocument } from './schemas/user-follow.schema';

@Injectable()
export class SocialService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(PostComment.name)
    private readonly postCommentModel: Model<PostCommentDocument>,
    @InjectModel(PostLike.name)
    private readonly postLikeModel: Model<PostLikeDocument>,
    @InjectModel(PostSave.name)
    private readonly postSaveModel: Model<PostSaveDocument>,
    @InjectModel(PostReport.name)
    private readonly postReportModel: Model<PostReportDocument>,
    @InjectModel(UserFollow.name)
    private readonly userFollowModel: Model<UserFollowDocument>,
    private readonly placesService: PlacesService,
    private readonly uploadsService: UploadsService,
    private readonly usersService: UsersService,
  ) {}

  async follow(user: AuthenticatedUser, targetUserId: string) {
    if (user.id === targetUserId) {
      throw new ConflictException('You cannot follow yourself');
    }

    await this.usersService.findByIdOrThrow(targetUserId);

    const exists = await this.userFollowModel.exists({
      follower: new Types.ObjectId(user.id),
      following: new Types.ObjectId(targetUserId),
    });

    if (exists) {
      return { following: true };
    }

    await this.userFollowModel.create({
      follower: new Types.ObjectId(user.id),
      following: new Types.ObjectId(targetUserId),
    });

    return { following: true };
  }

  async unfollow(user: AuthenticatedUser, targetUserId: string) {
    await this.userFollowModel
      .deleteOne({
        follower: new Types.ObjectId(user.id),
        following: new Types.ObjectId(targetUserId),
      })
      .exec();

    return { following: false };
  }

  async createPost(user: AuthenticatedUser, dto: CreatePostDto) {
    await this.placesService.findPublicByIdOrSlug(dto.placeId);

    const post = await this.postModel.create({
      author: new Types.ObjectId(user.id),
      place: new Types.ObjectId(dto.placeId),
      content: dto.content,
      type: dto.type,
      images: dto.images ?? [],
      tags: dto.tags ?? [],
      visitDate: dto.visitDate,
    });

    await this.uploadsService.attachAssetsByUrls(
      dto.images,
      user,
      UploadAssetEntityType.Post,
      post.id,
    );

    return this.populatePost(post);
  }

  async updatePost(
    postId: string,
    user: AuthenticatedUser,
    dto: UpdatePostDto,
  ) {
    const post = await this.findPostOrThrow(postId);
    this.assertCanManagePost(post, user);

    if (dto.placeId) {
      await this.placesService.findPublicByIdOrSlug(dto.placeId);
      post.place = new Types.ObjectId(dto.placeId);
    }

    if (dto.content !== undefined) {
      post.content = dto.content;
    }
    if (dto.type !== undefined) {
      post.type = dto.type;
    }
    if (dto.images !== undefined) {
      post.images = dto.images;
    }
    if (dto.tags !== undefined) {
      post.tags = dto.tags;
    }
    if (dto.visitDate !== undefined) {
      post.visitDate = dto.visitDate;
    }

    await post.save();
    await this.uploadsService.attachAssetsByUrls(
      dto.images,
      user,
      UploadAssetEntityType.Post,
      post.id,
    );

    return this.populatePost(post);
  }

  async deletePost(postId: string, user: AuthenticatedUser) {
    const post = await this.findPostOrThrow(postId);
    this.assertCanManagePost(post, user);
    post.status = PostStatus.Deleted;
    await post.save();
    return { deleted: true };
  }

  getPost(postId: string) {
    return this.postModel
      .findOne({ _id: postId, status: PostStatus.Published })
      .populate('author', 'name avatarUrl')
      .populate('place', 'name slug category address ratingAverage')
      .exec()
      .then((post) => {
        if (!post) {
          throw new NotFoundException('Post not found');
        }

        return post;
      });
  }

  feed(query: PostQueryDto) {
    return this.findPosts(query, {});
  }

  placeFeed(placeId: string, query: PostQueryDto) {
    return this.findPosts(query, { place: new Types.ObjectId(placeId) });
  }

  async followingFeed(user: AuthenticatedUser, query: PostQueryDto) {
    const follows = await this.userFollowModel
      .find({ follower: new Types.ObjectId(user.id) })
      .select('following')
      .exec();

    return this.findPosts(query, {
      author: { $in: follows.map((follow) => follow.following) },
    });
  }

  async like(postId: string, user: AuthenticatedUser) {
    await this.findPostOrThrow(postId, true);
    const exists = await this.postLikeModel.exists({
      post: new Types.ObjectId(postId),
      user: new Types.ObjectId(user.id),
    });

    if (!exists) {
      await this.postLikeModel.create({
        post: new Types.ObjectId(postId),
        user: new Types.ObjectId(user.id),
      });
      await this.postModel.findByIdAndUpdate(postId, {
        $inc: { likeCount: 1 },
      });
    }

    return { liked: true };
  }

  async unlike(postId: string, user: AuthenticatedUser) {
    const result = await this.postLikeModel
      .deleteOne({
        post: new Types.ObjectId(postId),
        user: new Types.ObjectId(user.id),
      })
      .exec();

    if (result.deletedCount) {
      await this.postModel.findByIdAndUpdate(postId, {
        $inc: { likeCount: -1 },
      });
    }

    return { liked: false };
  }

  async save(postId: string, user: AuthenticatedUser) {
    await this.findPostOrThrow(postId, true);
    const exists = await this.postSaveModel.exists({
      post: new Types.ObjectId(postId),
      user: new Types.ObjectId(user.id),
    });

    if (!exists) {
      await this.postSaveModel.create({
        post: new Types.ObjectId(postId),
        user: new Types.ObjectId(user.id),
      });
      await this.postModel.findByIdAndUpdate(postId, {
        $inc: { saveCount: 1 },
      });
    }

    return { saved: true };
  }

  async unsave(postId: string, user: AuthenticatedUser) {
    const result = await this.postSaveModel
      .deleteOne({
        post: new Types.ObjectId(postId),
        user: new Types.ObjectId(user.id),
      })
      .exec();

    if (result.deletedCount) {
      await this.postModel.findByIdAndUpdate(postId, {
        $inc: { saveCount: -1 },
      });
    }

    return { saved: false };
  }

  async comment(
    postId: string,
    user: AuthenticatedUser,
    dto: CreateCommentDto,
  ) {
    await this.findPostOrThrow(postId, true);

    if (dto.parentCommentId) {
      const parent = await this.postCommentModel.exists({
        _id: dto.parentCommentId,
        post: new Types.ObjectId(postId),
        status: PostCommentStatus.Published,
      });
      if (!parent) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    const comment = await this.postCommentModel.create({
      post: new Types.ObjectId(postId),
      author: new Types.ObjectId(user.id),
      parentComment: dto.parentCommentId
        ? new Types.ObjectId(dto.parentCommentId)
        : undefined,
      content: dto.content,
    });

    await this.postModel.findByIdAndUpdate(postId, {
      $inc: { commentCount: 1 },
    });

    return comment.populate('author', 'name avatarUrl');
  }

  comments(postId: string, query: PostQueryDto) {
    const skip = (query.page - 1) * query.limit;
    return this.postCommentModel
      .find({
        post: new Types.ObjectId(postId),
        status: PostCommentStatus.Published,
      })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(query.limit)
      .populate('author', 'name avatarUrl')
      .exec();
  }

  async deleteComment(commentId: string, user: AuthenticatedUser) {
    const comment = await this.findCommentOrThrow(commentId);
    if (user.role !== UserRole.Admin && comment.author.toString() !== user.id) {
      throw new ForbiddenException('You cannot manage this comment');
    }

    const wasPublished = comment.status === PostCommentStatus.Published;
    comment.status = PostCommentStatus.Deleted;
    await comment.save();

    if (wasPublished) {
      await this.postModel.findByIdAndUpdate(comment.post, {
        $inc: { commentCount: -1 },
      });
    }

    return { deleted: true };
  }

  async reportComment(
    commentId: string,
    user: AuthenticatedUser,
    dto: ReportPostDto,
  ) {
    const comment = await this.findCommentOrThrow(commentId);
    const alreadyReported = comment.reports.some(
      (report) => report.user.toString() === user.id,
    );

    if (alreadyReported) {
      throw new ConflictException('You already reported this comment');
    }

    comment.reports.push({
      user: new Types.ObjectId(user.id),
      reason: dto.reason,
      createdAt: new Date(),
    });
    comment.reportCount += 1;
    await comment.save();

    return { reported: true };
  }

  async hideComment(commentId: string) {
    const comment = await this.findCommentOrThrow(commentId);
    const wasPublished = comment.status === PostCommentStatus.Published;
    comment.status = PostCommentStatus.Hidden;
    await comment.save();

    if (wasPublished) {
      await this.postModel.findByIdAndUpdate(comment.post, {
        $inc: { commentCount: -1 },
      });
    }

    return comment;
  }

  async unhideComment(commentId: string) {
    const comment = await this.findCommentOrThrow(commentId);
    const wasHidden = comment.status === PostCommentStatus.Hidden;
    comment.status = PostCommentStatus.Published;
    await comment.save();

    if (wasHidden) {
      await this.postModel.findByIdAndUpdate(comment.post, {
        $inc: { commentCount: 1 },
      });
    }

    return comment;
  }

  async report(postId: string, user: AuthenticatedUser, dto: ReportPostDto) {
    await this.findPostOrThrow(postId, true);
    const exists = await this.postReportModel.exists({
      post: new Types.ObjectId(postId),
      user: new Types.ObjectId(user.id),
    });

    if (exists) {
      throw new ConflictException('You already reported this post');
    }

    await this.postReportModel.create({
      post: new Types.ObjectId(postId),
      user: new Types.ObjectId(user.id),
      reason: dto.reason,
    });
    await this.postModel.findByIdAndUpdate(postId, {
      $inc: { reportCount: 1 },
    });

    return { reported: true };
  }

  async hide(postId: string) {
    const post = await this.findPostOrThrow(postId);
    post.status = PostStatus.Hidden;
    await post.save();
    return post;
  }

  async unhide(postId: string) {
    const post = await this.findPostOrThrow(postId);
    post.status = PostStatus.Published;
    await post.save();
    return post;
  }

  private findPosts(query: PostQueryDto, extraFilter: Record<string, unknown>) {
    const skip = (query.page - 1) * query.limit;
    const filter: Record<string, unknown> = {
      ...extraFilter,
      status: PostStatus.Published,
    };

    if (query.placeId) {
      filter.place = new Types.ObjectId(query.placeId);
    }
    if (query.authorId) {
      filter.author = new Types.ObjectId(query.authorId);
    }
    if (query.type) {
      filter.type = query.type;
    }
    if (query.tag) {
      filter.tags = query.tag;
    }

    return this.postModel
      .find(filter)
      .sort({
        likeCount: -1,
        commentCount: -1,
        saveCount: -1,
        createdAt: -1,
      })
      .skip(skip)
      .limit(query.limit)
      .populate('author', 'name avatarUrl')
      .populate('place', 'name slug category address ratingAverage')
      .exec();
  }

  private async findPostOrThrow(postId: string, requirePublished = false) {
    const filter: Record<string, unknown> = { _id: postId };
    if (requirePublished) {
      filter.status = PostStatus.Published;
    }

    const post = await this.postModel.findOne(filter).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  private async findCommentOrThrow(commentId: string) {
    const comment = await this.postCommentModel.findById(commentId).exec();
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return comment;
  }

  private assertCanManagePost(post: PostDocument, user: AuthenticatedUser) {
    if (user.role === UserRole.Admin) {
      return;
    }

    if (post.author.toString() !== user.id) {
      throw new ForbiddenException('You cannot manage this post');
    }
  }

  private populatePost(post: PostDocument) {
    return post.populate([
      { path: 'author', select: 'name avatarUrl' },
      { path: 'place', select: 'name slug category address ratingAverage' },
    ]);
  }
}
