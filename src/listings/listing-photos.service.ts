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

const photoSelect = { id: true, url: true, sortOrder: true } as const;

@Injectable()
export class ListingPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly listings: ListingsService,
  ) {}

  list(listingId: bigint) {
    return this.prisma.listingPhoto.findMany({
      where: { listingId },
      select: photoSelect,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  /** Uploads to Cloudinary, appends after existing photos (sort_order 0 = cover). */
  async add(listingId: bigint, user: AuthUser, files: Express.Multer.File[]) {
    await this.listings.getForOwner(listingId, user);
    const agg = await this.prisma.listingPhoto.aggregate({
      where: { listingId },
      _count: true,
      _max: { sortOrder: true },
    });
    if (agg._count + files.length > MAX_PHOTOS_PER_LISTING) {
      throw new BadRequestException(
        `A listing can have at most ${MAX_PHOTOS_PER_LISTING} photos`,
      );
    }

    const uploaded = await Promise.all(
      files.map((f) => this.cloudinary.upload(f, `listings/${listingId}`)),
    );
    const start = agg._count ? (agg._max.sortOrder ?? 0) + 1 : 0;
    await this.prisma.listingPhoto.createMany({
      data: uploaded.map((img, i) => ({
        listingId,
        url: img.url,
        cloudinaryPublicId: img.publicId,
        sortOrder: start + i,
      })),
    });
    return this.list(listingId);
  }

  async remove(listingId: bigint, photoId: bigint, user: AuthUser) {
    await this.listings.getForOwner(listingId, user);
    const photo = await this.prisma.listingPhoto.findFirst({
      where: { id: photoId, listingId },
    });
    if (!photo) throw new NotFoundException('Photo not found');
    await this.prisma.listingPhoto.delete({ where: { id: photoId } });
    await this.cloudinary.remove([photo.cloudinaryPublicId]);
    return this.list(listingId);
  }

  /** `photoIds` must be exactly the listing's photos, in the new order. */
  async reorder(listingId: bigint, user: AuthUser, photoIds: number[]) {
    await this.listings.getForOwner(listingId, user);
    const existing = await this.prisma.listingPhoto.findMany({
      where: { listingId },
      select: { id: true },
    });
    const ids = photoIds.map((id) => BigInt(id));
    const known = new Set(existing.map((p) => p.id));
    if (
      ids.length !== existing.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !known.has(id))
    ) {
      throw new BadRequestException(
        'photoIds must list every photo of this listing exactly once',
      );
    }
    await this.prisma.$transaction(
      ids.map((id, sortOrder) =>
        this.prisma.listingPhoto.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    return this.list(listingId);
  }
}
