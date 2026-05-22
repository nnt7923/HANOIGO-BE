import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CloudinaryService } from './cloudinary.service';
import {
  UploadAsset,
  UploadAssetDocument,
  UploadAssetEntityType,
  UploadAssetStatus,
} from './schemas/upload-asset.schema';

@Injectable()
export class UploadsService {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    @InjectModel(UploadAsset.name)
    private readonly uploadAssetModel: Model<UploadAssetDocument>,
  ) {}

  async uploadImage(user: AuthenticatedUser, file: Express.Multer.File) {
    const uploaded = await this.cloudinaryService.uploadImage(
      file,
      'hanoigo/images',
    );

    const asset = await this.uploadAssetModel.create({
      owner: new Types.ObjectId(user.id),
      publicId: uploaded.publicId,
      secureUrl: uploaded.secureUrl,
      width: uploaded.width,
      height: uploaded.height,
      format: uploaded.format,
      bytes: uploaded.bytes,
    });

    return this.toResponse(asset);
  }

  uploadImages(user: AuthenticatedUser, files: Express.Multer.File[]) {
    return Promise.all(files.map((file) => this.uploadImage(user, file)));
  }

  async deleteImage(user: AuthenticatedUser, publicId: string) {
    const asset = await this.uploadAssetModel.findOne({ publicId }).exec();
    if (!asset) {
      throw new NotFoundException('Upload asset not found');
    }

    if (user.role !== UserRole.Admin && asset.owner.toString() !== user.id) {
      throw new ForbiddenException('You cannot delete this image');
    }

    const result = await this.cloudinaryService.deleteAsset(publicId);
    asset.status = UploadAssetStatus.Deleted;
    asset.deletedAt = new Date();
    await asset.save();

    return result;
  }

  async attachAssetsByUrls(
    urls: string[] | undefined,
    user: AuthenticatedUser,
    entityType: UploadAssetEntityType,
    entityId: string,
  ) {
    if (!urls?.length) {
      return;
    }

    const assets = await this.uploadAssetModel
      .find({ secureUrl: { $in: urls } })
      .exec();

    if (assets.length !== urls.length) {
      throw new ForbiddenException(
        'One or more images were not uploaded first',
      );
    }

    for (const asset of assets) {
      if (user.role !== UserRole.Admin && asset.owner.toString() !== user.id) {
        throw new ForbiddenException(
          'You cannot use an image owned by another user',
        );
      }

      if (
        asset.status === UploadAssetStatus.Attached &&
        asset.entityId?.toString() !== entityId
      ) {
        throw new ForbiddenException('One or more images are already attached');
      }
    }

    await this.uploadAssetModel
      .updateMany(
        { secureUrl: { $in: urls } },
        {
          status: UploadAssetStatus.Attached,
          entityType,
          entityId: new Types.ObjectId(entityId),
        },
      )
      .exec();
  }

  private toResponse(asset: UploadAssetDocument) {
    return {
      publicId: asset.publicId,
      secureUrl: asset.secureUrl,
      width: asset.width,
      height: asset.height,
      format: asset.format,
      bytes: asset.bytes,
      status: asset.status,
    };
  }
}
