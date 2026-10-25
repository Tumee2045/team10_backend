import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

type Files = Express.Multer.File | Express.Multer.File[] | undefined;

/** Requires at least one JPEG/PNG/WebP image, each up to 5 MB. */
@Injectable()
export class ImageFilesPipe implements PipeTransform<Files, Files> {
  transform(value: Files): Files {
    const files = Array.isArray(value) ? value : value ? [value] : [];
    if (!files.length) throw new BadRequestException('No image uploaded');
    for (const f of files) {
      if (!ALLOWED.includes(f.mimetype)) {
        throw new BadRequestException(
          `${f.originalname}: only JPEG, PNG or WebP allowed`,
        );
      }
      if (f.size > MAX_BYTES) {
        throw new BadRequestException(`${f.originalname}: max size is 5 MB`);
      }
    }
    return value;
  }
}
