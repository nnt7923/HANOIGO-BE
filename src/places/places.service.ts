import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UploadAssetEntityType } from '../uploads/schemas/upload-asset.schema';
import { UploadsService } from '../uploads/uploads.service';
import { UsersService } from '../users/users.service';
import { CreatePlaceDto } from './dto/create-place.dto';
import { PlaceQueryDto } from './dto/place-query.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { Place, PlaceDocument, PlaceStatus } from './schemas/place.schema';

@Injectable()
export class PlacesService {
  constructor(
    @InjectModel(Place.name) private readonly placeModel: Model<PlaceDocument>,
    private readonly usersService: UsersService,
    private readonly uploadsService: UploadsService,
  ) {}

  async create(owner: AuthenticatedUser, dto: CreatePlaceDto) {
    await this.assertCanCreatePlace(owner);

    const status =
      owner.role === UserRole.Admin
        ? PlaceStatus.Published
        : PlaceStatus.PendingReview;

    const place = await this.placeModel.create({
      ...dto,
      slug: await this.createUniqueSlug(dto.name),
      owner: new Types.ObjectId(owner.id),
      location: {
        type: 'Point',
        coordinates: [dto.longitude, dto.latitude],
      },
      status,
    });

    await this.uploadsService.attachAssetsByUrls(
      dto.images,
      owner,
      UploadAssetEntityType.Place,
      place.id,
    );

    return place;
  }

  private async assertCanCreatePlace(owner: AuthenticatedUser) {
    if (owner.role === UserRole.Admin) {
      return;
    }

    const user = await this.usersService.findByIdOrThrow(owner.id);
    const placeCount = await this.placeModel
      .countDocuments({ owner: new Types.ObjectId(owner.id) })
      .exec();

    if (placeCount >= user.placeLimit) {
      throw new ForbiddenException('Subscription place limit exceeded');
    }
  }

  findPublic(query: PlaceQueryDto) {
    return this.findAllByFilter(query, { status: PlaceStatus.Published });
  }

  findAll(query: PlaceQueryDto) {
    return this.findPublic(query);
  }

  findManage(actor: AuthenticatedUser, query: PlaceQueryDto) {
    const filter: Record<string, unknown> = {};

    if (actor.role !== UserRole.Admin) {
      filter.owner = new Types.ObjectId(actor.id);
    }

    if (query.status) {
      filter.status = query.status;
    }

    return this.findAllByFilter(query, filter);
  }

  private findAllByFilter(
    query: PlaceQueryDto,
    filter: Record<string, unknown>,
  ) {
    if (query.category) {
      filter.category = query.category;
    }

    if (query.q) {
      filter.$text = { $search: query.q };
    }

    if (query.longitude !== undefined && query.latitude !== undefined) {
      filter.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [query.longitude, query.latitude],
          },
          $maxDistance: query.radiusMeters ?? 5000,
        },
      };
    }

    const skip = (query.page - 1) * query.limit;
    return this.placeModel
      .find(filter)
      .sort(query.q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .populate('owner', 'name email role')
      .exec();
  }

  async findPublicByIdOrSlug(identifier: string) {
    const place = await this.findByIdOrSlug(identifier);
    if (place.status !== PlaceStatus.Published) {
      throw new NotFoundException('Place not found');
    }

    return place;
  }

  async findManageByIdOrSlug(identifier: string, actor: AuthenticatedUser) {
    const place = await this.findByIdOrSlug(identifier);
    if (actor.role !== UserRole.Admin) {
      this.assertCanManage(place, actor);
    }

    return place;
  }

  async findByIdOrSlug(identifier: string) {
    const filter = Types.ObjectId.isValid(identifier)
      ? { _id: identifier }
      : { slug: identifier };

    const place = await this.placeModel
      .findOne(filter)
      .populate('owner', 'name email role')
      .exec();

    if (!place) {
      throw new NotFoundException('Place not found');
    }

    return place;
  }

  async update(
    identifier: string,
    actor: AuthenticatedUser,
    dto: UpdatePlaceDto,
  ) {
    const place = await this.findByIdOrSlug(identifier);
    this.assertCanManage(place, actor);

    if (dto.name && dto.name !== place.name) {
      place.slug = await this.createUniqueSlug(dto.name);
    }

    const { longitude, latitude, ...updates } = dto;
    Object.assign(place, updates);

    if (longitude !== undefined && latitude !== undefined) {
      place.location = {
        type: 'Point',
        coordinates: [longitude, latitude],
      };
    }

    if (
      actor.role !== UserRole.Admin &&
      place.status === PlaceStatus.Published
    ) {
      place.status = PlaceStatus.PendingReview;
      place.moderationReason = 'Owner updated published place';
      place.reviewedBy = undefined;
      place.reviewedAt = undefined;
    }

    const saved = await place.save();
    await this.uploadsService.attachAssetsByUrls(
      dto.images,
      actor,
      UploadAssetEntityType.Place,
      saved.id,
    );

    return saved;
  }

  async remove(identifier: string, actor: AuthenticatedUser) {
    const place = await this.findByIdOrSlug(identifier);
    this.assertCanManage(place, actor);
    await place.deleteOne();
    return { deleted: true };
  }

  async updateRating(
    placeId: string,
    ratingAverage: number,
    ratingCount: number,
  ) {
    await this.placeModel
      .findByIdAndUpdate(placeId, { ratingAverage, ratingCount })
      .exec();
  }

  async approve(identifier: string, admin: AuthenticatedUser) {
    const place = await this.findByIdOrSlug(identifier);
    place.status = PlaceStatus.Published;
    place.moderationReason = undefined;
    place.reviewedBy = new Types.ObjectId(admin.id);
    place.reviewedAt = new Date();
    return place.save();
  }

  async reject(identifier: string, admin: AuthenticatedUser, reason: string) {
    const place = await this.findByIdOrSlug(identifier);
    place.status = PlaceStatus.Rejected;
    place.moderationReason = reason;
    place.reviewedBy = new Types.ObjectId(admin.id);
    place.reviewedAt = new Date();
    return place.save();
  }

  async suspend(identifier: string, admin: AuthenticatedUser, reason?: string) {
    const place = await this.findByIdOrSlug(identifier);
    place.status = PlaceStatus.Suspended;
    place.moderationReason = reason;
    place.reviewedBy = new Types.ObjectId(admin.id);
    place.reviewedAt = new Date();
    return place.save();
  }

  private assertCanManage(place: PlaceDocument, actor: AuthenticatedUser) {
    if (actor.role === UserRole.Admin) {
      return;
    }

    const ownerId = this.getOwnerId(place);
    if (ownerId !== actor.id) {
      throw new ForbiddenException('You cannot manage this place');
    }
  }

  private getOwnerId(place: PlaceDocument) {
    const owner = place.owner as Types.ObjectId & { _id?: Types.ObjectId };
    return owner._id?.toString() ?? owner.toString();
  }

  private async createUniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = base || 'place';
    let counter = 1;

    while (await this.placeModel.exists({ slug })) {
      counter += 1;
      slug = `${base}-${counter}`;
    }

    return slug;
  }
}
