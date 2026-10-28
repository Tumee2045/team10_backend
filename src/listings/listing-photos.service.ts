import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from './listings.service';

export const MAX_PHOTOS_PER_LISTING = 20;

/** Listing photos stored in Cloudinary. `sortOrder` 0 is the cover. Every method returns the full, ordered photo list. */
@Injectable()
export class ListingPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly listings: ListingsService,
  ) {}

  async add(listingId: bigint, user: AuthUser, files: Express.Multer.File[]) {
    await this.listings.findOwned(listingId, user);

    const existing = await this.prisma.listingPhoto.aggregate({
      where: { listingId },
      _count: true,
      _max: { sortOrder: true },
    });
    if (existing._count + files.length > MAX_PHOTOS_PER_LISTING) {
      throw new BadRequestException(
        `A listing can have at most ${MAX_PHOTOS_PER_LISTING} photos`,
      );
    }

    const uploaded = await Promise.all(
      files.map((file) =>
        this.cloudinary.upload(file, `listings/${listingId}`),
      ),
    );
    const nextSortOrder = existing._count
      ? (existing._max.sortOrder ?? 0) + 1
      : 0;
    await this.prisma.listingPhoto.createMany({
      data: uploaded.map((image, i) => ({
        listingId,
        url: image.url,
        cloudinaryPublicId: image.publicId,
        sortOrder: nextSortOrder + i,
      })),
    });
    return this.list(listingId);
  }

  async remove(listingId: bigint, photoId: bigint, user: AuthUser) {
    await this.listings.findOwned(listingId, user);
    const photo = await this.prisma.listingPhoto.findFirst({
      where: { id: photoId, listingId },
    });
    if (!photo) throw new NotFoundException('Photo not found');

    await this.prisma.listingPhoto.delete({ where: { id: photoId } });
    await this.cloudinary.remove([photo.cloudinaryPublicId]);
    return this.list(listingId);
  }

  private list(listingId: bigint) {
    return this.prisma.listingPhoto.findMany({
      where: { listingId },
      select: { id: true, url: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }
}
