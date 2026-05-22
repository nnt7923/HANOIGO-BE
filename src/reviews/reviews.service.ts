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
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review, ReviewDocument, ReviewStatus } from './schemas/review.schema';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    private readonly placesService: PlacesService,
  ) {}

  async create(
    placeIdentifier: string,
    user: AuthenticatedUser,
    dto: CreateReviewDto,
  ) {
    const place =
      await this.placesService.findPublicByIdOrSlug(placeIdentifier);
    const placeId = place._id;
    const ownerId = this.getPlaceOwnerId(place);

    if (ownerId === user.id) {
      throw new ForbiddenException('Owners cannot review their own place');
    }

    const exists = await this.reviewModel.exists({
      place: placeId,
      user: new Types.ObjectId(user.id),
    });

    if (exists) {
      throw new ConflictException('You already reviewed this place');
    }

    const review = await this.reviewModel.create({
      ...dto,
      place: placeId,
      user: new Types.ObjectId(user.id),
    });

    await this.recalculatePlaceRating(placeId.toString());
    return review.populate('user', 'name avatarUrl');
  }

  findForPlace(placeIdentifier: string) {
    const filter = Types.ObjectId.isValid(placeIdentifier)
      ? { place: new Types.ObjectId(placeIdentifier) }
      : {};

    if (!filter.place) {
      return this.findForPlaceSlug(placeIdentifier);
    }

    return this.reviewModel
      .find({ ...filter, status: ReviewStatus.Published })
      .sort({ createdAt: -1 })
      .populate('user', 'name avatarUrl')
      .exec();
  }

  async update(
    reviewId: string,
    user: AuthenticatedUser,
    dto: UpdateReviewDto,
  ) {
    const review = await this.findByIdOrThrow(reviewId);
    this.assertCanManage(review, user);
    Object.assign(review, dto);
    await review.save();
    await this.recalculatePlaceRating(review.place.toString());
    return review.populate('user', 'name avatarUrl');
  }

  async remove(reviewId: string, user: AuthenticatedUser) {
    const review = await this.findByIdOrThrow(reviewId);
    this.assertCanManage(review, user);
    const placeId = review.place.toString();
    await review.deleteOne();
    await this.recalculatePlaceRating(placeId);
    return { deleted: true };
  }

  private async findForPlaceSlug(slug: string) {
    const place = await this.placesService.findPublicByIdOrSlug(slug);
    return this.reviewModel
      .find({ place: place._id, status: ReviewStatus.Published })
      .sort({ createdAt: -1 })
      .populate('user', 'name avatarUrl')
      .exec();
  }

  private async findByIdOrThrow(reviewId: string) {
    const review = await this.reviewModel.findById(reviewId).exec();
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  private assertCanManage(review: ReviewDocument, user: AuthenticatedUser) {
    if (user.role === UserRole.Admin) {
      return;
    }

    if (review.user.toString() !== user.id) {
      throw new ForbiddenException('You cannot manage this review');
    }
  }

  async report(
    reviewId: string,
    user: AuthenticatedUser,
    dto: ReportReviewDto,
  ) {
    const review = await this.findByIdOrThrow(reviewId);
    const alreadyReported = review.reports.some(
      (report) => report.user.toString() === user.id,
    );

    if (alreadyReported) {
      throw new ConflictException('You already reported this review');
    }

    review.reports.push({
      user: new Types.ObjectId(user.id),
      reason: dto.reason,
      createdAt: new Date(),
    });
    await review.save();

    return { reported: true };
  }

  async reply(reviewId: string, user: AuthenticatedUser, dto: ReplyReviewDto) {
    const review = await this.findByIdOrThrow(reviewId);
    const place = await this.placesService.findByIdOrSlug(
      review.place.toString(),
    );
    const ownerId = this.getPlaceOwnerId(place);

    if (user.role !== UserRole.Admin && ownerId !== user.id) {
      throw new ForbiddenException('You cannot reply to this review');
    }

    review.ownerReply = {
      user: new Types.ObjectId(user.id),
      message: dto.message,
      createdAt: new Date(),
    };
    await review.save();

    return review.populate('user', 'name avatarUrl');
  }

  async hide(reviewId: string) {
    const review = await this.findByIdOrThrow(reviewId);
    review.status = ReviewStatus.Hidden;
    await review.save();
    await this.recalculatePlaceRating(review.place.toString());
    return review;
  }

  async unhide(reviewId: string) {
    const review = await this.findByIdOrThrow(reviewId);
    review.status = ReviewStatus.Published;
    await review.save();
    await this.recalculatePlaceRating(review.place.toString());
    return review;
  }

  private getPlaceOwnerId(place: { owner: unknown }) {
    const owner = place.owner as Types.ObjectId & { _id?: Types.ObjectId };
    return owner._id?.toString() ?? owner.toString();
  }

  private async recalculatePlaceRating(placeId: string) {
    const [result] = await this.reviewModel.aggregate<{
      ratingAverage: number;
      ratingCount: number;
    }>([
      {
        $match: {
          place: new Types.ObjectId(placeId),
          status: ReviewStatus.Published,
        },
      },
      {
        $group: {
          _id: '$place',
          ratingAverage: { $avg: '$rating' },
          ratingCount: { $sum: 1 },
        },
      },
    ]);

    await this.placesService.updateRating(
      placeId,
      result ? Math.round(result.ratingAverage * 10) / 10 : 0,
      result?.ratingCount ?? 0,
    );
  }
}
