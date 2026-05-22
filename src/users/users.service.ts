import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../common/enums/user-role.enum';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateOwnerRequestDto } from './dto/create-owner-request.dto';
import { ReviewOwnerRequestDto } from './dto/review-owner-request.dto';
import {
  AuthProvider,
  SubscriptionPlan,
  User,
  UserDocument,
} from './schemas/user.schema';
import {
  OwnerRequest,
  OwnerRequestDocument,
  OwnerRequestStatus,
} from './schemas/owner-request.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

export type SafeUser = Omit<User, 'passwordHash'> & { id: string };

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(OwnerRequest.name)
    private readonly ownerRequestModel: Model<OwnerRequestDocument>,
  ) {}

  async create(input: {
    name: string;
    email: string;
    passwordHash?: string;
    role?: UserRole;
    authProvider?: AuthProvider;
    googleId?: string;
    avatarUrl?: string;
    emailVerifiedAt?: Date;
  }): Promise<UserDocument> {
    const exists = await this.userModel.exists({
      email: input.email.toLowerCase(),
    });
    if (exists) {
      throw new ConflictException('Email is already registered');
    }

    return this.userModel.create({
      ...input,
      email: input.email.toLowerCase(),
    });
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  async findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ googleId }).exec();
  }

  async findByIdOrThrow(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findAll(query: PaginationQueryDto): Promise<SafeUser[]> {
    const skip = (query.page - 1) * query.limit;
    const users = await this.userModel
      .find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .exec();

    return users.map((user) => this.toSafeUser(user));
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, dto, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toSafeUser(user);
  }

  async markEmailVerified(userId: string): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { emailVerifiedAt: new Date() }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async setPassword(
    userId: string,
    passwordHash: string,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          passwordHash,
          authProvider: AuthProvider.Local,
          $inc: { tokenVersion: 1 },
        },
        { new: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async incrementTokenVersion(userId: string): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async attachGoogleAccount(
    userId: string,
    input: { googleId: string; avatarUrl?: string; name?: string },
  ): Promise<UserDocument> {
    const update: Partial<User> = {
      googleId: input.googleId,
      authProvider: AuthProvider.Google,
      emailVerifiedAt: new Date(),
    };

    if (input.avatarUrl) {
      update.avatarUrl = input.avatarUrl;
    }

    if (input.name) {
      update.name = input.name;
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, update, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateRole(userId: string, dto: UpdateRoleDto): Promise<SafeUser> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { role: dto.role }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toSafeUser(user);
  }

  async updateSubscription(
    userId: string,
    dto: UpdateSubscriptionDto,
  ): Promise<SafeUser> {
    const defaultLimit =
      dto.subscriptionPlan === SubscriptionPlan.Pro ? 100 : 5;
    const defaultPlaceLimit =
      dto.subscriptionPlan === SubscriptionPlan.Pro ? 50 : 3;

    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          subscriptionPlan: dto.subscriptionPlan,
          monthlyItineraryLimit: dto.monthlyItineraryLimit ?? defaultLimit,
          placeLimit: dto.placeLimit ?? defaultPlaceLimit,
          subscriptionStatus: dto.subscriptionStatus,
          subscriptionExpiresAt: dto.subscriptionExpiresAt,
        },
        { new: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toSafeUser(user);
  }

  async getQuota(userId: string) {
    const user = await this.findByIdOrThrow(userId);
    return {
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      monthlyItineraryLimit: user.monthlyItineraryLimit,
      itineraryUsageCount: user.itineraryUsageCount,
      itineraryRemaining: Math.max(
        0,
        user.monthlyItineraryLimit - user.itineraryUsageCount,
      ),
      placeLimit: user.placeLimit,
    };
  }

  async requestOwnerRole(userId: string, dto: CreateOwnerRequestDto) {
    const user = await this.findByIdOrThrow(userId);
    if (user.role === UserRole.Owner || user.role === UserRole.Admin) {
      throw new ForbiddenException('This account already has owner access');
    }

    const existing = await this.ownerRequestModel.exists({
      user: new Types.ObjectId(userId),
      status: OwnerRequestStatus.Pending,
    });

    if (existing) {
      throw new ConflictException('Owner request is already pending');
    }

    return this.ownerRequestModel.create({
      ...dto,
      user: new Types.ObjectId(userId),
    });
  }

  async findOwnerRequests(query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.limit;
    return this.ownerRequestModel
      .find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .populate('user', 'name email role')
      .populate('reviewedBy', 'name email role')
      .exec();
  }

  async approveOwnerRequest(requestId: string, adminId: string) {
    const request = await this.findOwnerRequestOrThrow(requestId);
    if (request.status !== OwnerRequestStatus.Pending) {
      throw new ConflictException('Owner request has already been reviewed');
    }

    request.status = OwnerRequestStatus.Approved;
    request.reviewedBy = new Types.ObjectId(adminId);
    request.reviewedAt = new Date();
    await request.save();

    await this.userModel
      .findByIdAndUpdate(request.user, { role: UserRole.Owner })
      .exec();

    return request.populate('user', 'name email role');
  }

  async rejectOwnerRequest(
    requestId: string,
    adminId: string,
    dto: ReviewOwnerRequestDto,
  ) {
    const request = await this.findOwnerRequestOrThrow(requestId);
    if (request.status !== OwnerRequestStatus.Pending) {
      throw new ConflictException('Owner request has already been reviewed');
    }

    request.status = OwnerRequestStatus.Rejected;
    request.reviewedBy = new Types.ObjectId(adminId);
    request.reviewedAt = new Date();
    request.rejectionReason = dto.rejectionReason;
    await request.save();

    return request.populate('user', 'name email role');
  }

  async incrementItineraryUsage(userId: string): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $inc: { itineraryUsageCount: 1 } },
        { new: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async resetUsageIfNeeded(user: UserDocument): Promise<UserDocument> {
    const now = new Date();
    const nextReset = new Date(user.usageResetAt);
    nextReset.setMonth(nextReset.getMonth() + 1);

    if (now < nextReset) {
      return user;
    }

    user.itineraryUsageCount = 0;
    user.usageResetAt = now;
    return user.save();
  }

  private async findOwnerRequestOrThrow(requestId: string) {
    const request = await this.ownerRequestModel.findById(requestId).exec();
    if (!request) {
      throw new NotFoundException('Owner request not found');
    }

    return request;
  }

  toSafeUser(user: UserDocument): SafeUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      authProvider: user.authProvider,
      emailVerifiedAt: user.emailVerifiedAt,
      tokenVersion: user.tokenVersion,
      avatarUrl: user.avatarUrl,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      monthlyItineraryLimit: user.monthlyItineraryLimit,
      placeLimit: user.placeLimit,
      itineraryUsageCount: user.itineraryUsageCount,
      usageResetAt: user.usageResetAt,
    };
  }
}
