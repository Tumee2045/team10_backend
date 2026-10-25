import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface UploadedImage {
  url: string;
  publicId: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly folder: string;
  private readonly configured: boolean;

  constructor(config: ConfigService) {
    const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = config.get<string>('CLOUDINARY_API_SECRET');
    this.folder = config.get<string>('CLOUDINARY_FOLDER') || 'real-estate';
    this.configured = Boolean(cloudName && apiKey && apiSecret);
    if (this.configured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    } else {
      this.logger.warn(
        'Cloudinary is not configured — image uploads will fail.',
      );
    }
  }

  upload(file: Express.Multer.File, subfolder: string): Promise<UploadedImage> {
    if (!this.configured) {
      throw new ServiceUnavailableException('Image upload is not configured');
    }
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: `${this.folder}/${subfolder}`, resource_type: 'image' },
          (err, res?: UploadApiResponse) => {
            if (err || !res) {
              reject(new ServiceUnavailableException('Image upload failed'));
              return;
            }
            resolve({ url: res.secure_url, publicId: res.public_id });
          },
        )
        .end(file.buffer);
    });
  }

  /** Best effort: a leftover file in Cloudinary must not break the request. */
  async remove(publicIds: string[]): Promise<void> {
    if (!this.configured || !publicIds.length) return;
    try {
      await cloudinary.api.delete_resources(publicIds);
    } catch (e) {
      this.logger.warn(
        `Failed to delete images ${publicIds.join(', ')}: ${String(e)}`,
      );
    }
  }
}
