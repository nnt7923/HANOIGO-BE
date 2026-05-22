import {
  Injectable,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

export type UploadedAsset = {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
};

@Injectable()
export class CloudinaryService {
  private readonly allowedMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ]);

  constructor(private readonly configService: ConfigService) {
    const cloudinaryUrl = this.configService.get<string>('CLOUDINARY_URL');

    if (cloudinaryUrl) {
      cloudinary.config({ cloudinary_url: cloudinaryUrl, secure: true });
      return;
    }

    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    }
  }

  async uploadImage(file: Express.Multer.File, folder = 'hanoigo/uploads') {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Cloudinary is not configured');
    }

    if (!this.allowedMimeTypes.has(file.mimetype)) {
      throw new UnsupportedMediaTypeException('Unsupported image type');
    }

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, response) => {
          if (error || !response) {
            reject(
              error instanceof Error
                ? error
                : new Error('Cloudinary upload failed'),
            );
            return;
          }

          resolve(response);
        },
      );

      Readable.from(file.buffer).pipe(stream);
    });

    return this.toUploadedAsset(result);
  }

  async deleteAsset(publicId: string) {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Cloudinary is not configured');
    }

    const result: unknown = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
    });

    return {
      publicId,
      result: this.getDestroyResult(result),
    };
  }

  private isConfigured() {
    const config = cloudinary.config();
    return Boolean(config.cloud_name && config.api_key && config.api_secret);
  }

  private toUploadedAsset(result: UploadApiResponse): UploadedAsset {
    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  }

  private getDestroyResult(result: unknown) {
    if (
      typeof result === 'object' &&
      result !== null &&
      'result' in result &&
      typeof result.result === 'string'
    ) {
      return result.result;
    }

    return 'unknown';
  }
}
