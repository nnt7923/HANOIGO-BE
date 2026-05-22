import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  create(dto: CreateNotificationDto) {
    return this.notificationModel.create({
      ...dto,
      recipient: new Types.ObjectId(dto.recipient),
    });
  }

  findMine(userId: string, query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.limit;
    return this.notificationModel
      .find({ recipient: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .exec();
  }

  async markRead(notificationId: string, userId: string) {
    const notification = await this.notificationModel
      .findOneAndUpdate(
        {
          _id: notificationId,
          recipient: new Types.ObjectId(userId),
        },
        { readAt: new Date() },
        { new: true },
      )
      .exec();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  markAllRead(userId: string) {
    return this.notificationModel
      .updateMany(
        {
          recipient: new Types.ObjectId(userId),
          readAt: { $exists: false },
        },
        { readAt: new Date() },
      )
      .exec();
  }
}
