import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from './cloudinary.service';
import { UploadAsset, UploadAssetSchema } from './schemas/upload-asset.schema';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UploadAsset.name, schema: UploadAssetSchema },
    ]),
  ],
  controllers: [UploadsController],
  providers: [CloudinaryService, UploadsService],
  exports: [CloudinaryService, UploadsService],
})
export class UploadsModule {}
