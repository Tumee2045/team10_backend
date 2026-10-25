import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { findPage } from '../common/http/page';
import { listingCardSelect } from '../listings/listing.selects';
import { PrismaService } from '../prisma/prisma.service';
import { withCoverUrl } from '../prisma/selects';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: bigint, query: PaginationQueryDto) {
    const where = { userId };
    const page = await findPage(
      query,
      (p) =>
        this.prisma.favorite.findMany({
          where,
          select: { createdAt: true, listing: { select: listingCardSelect } },
          orderBy: { createdAt: 'desc' },
          ...p,
        }),
      () => this.prisma.favorite.count({ where }),
    );
    return page.map((row) => ({
      ...withCoverUrl(row.listing),
      favoritedAt: row.createdAt,
    }));
  }

  /** Idempotent: adding the same listing twice is fine. */
  async add(userId: bigint, listingId: bigint) {
    const listingExists = await this.prisma.listing.count({
      where: { id: listingId },
    });
    if (!listingExists) throw new NotFoundException('Listing not found');

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
