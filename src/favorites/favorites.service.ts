import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationQueryDto, paginate } from '../common/dto/pagination.dto';
import { listingCardSelect, toListingCard } from '../listings/listing.selects';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: bigint, q: PaginationQueryDto) {
    const where = { userId };
    const [rows, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where,
        select: { createdAt: true, listing: { select: listingCardSelect } },
        orderBy: { createdAt: 'desc' },
        ...paginate(q),
      }),
      this.prisma.favorite.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        ...toListingCard(r.listing),
        favoritedAt: r.createdAt,
      })),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  /** Idempotent: adding twice is fine. */
  async add(userId: bigint, listingId: bigint) {
    const exists = await this.prisma.listing.count({
      where: { id: listingId },
    });
    if (!exists) throw new NotFoundException('Listing not found');
    await this.prisma.favorite.upsert({
      where: { userId_listingId: { userId, listingId } },
      update: {},
      create: { userId, listingId },
    });
    return { listingId, isFavorite: true };
  }

  async remove(userId: bigint, listingId: bigint) {
    await this.prisma.favorite.deleteMany({ where: { userId, listingId } });
    return { listingId, isFavorite: false };
  }
}
