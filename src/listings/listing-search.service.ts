import { BadRequestException, Injectable } from '@nestjs/common';
import { ListingStatus, ListingType, Prisma } from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { findPage } from '../common/http/page';
import { PrismaService } from '../prisma/prisma.service';
import { withCoverUrl } from '../prisma/selects';
import { ListingQueryDto } from './dto/listing-query.dto';
import { SearchFiltersDto } from './dto/search-filters.dto';
import { listingCardSelect, listingMapPointSelect } from './listing.selects';

const MAP_POINT_LIMIT = 500;

type SearchInput = SearchFiltersDto & Partial<ListingQueryDto>;

/** Use cases: Үнэ, байршлаар шүүж хайх · Газрын зураг дээр зар харах. ACTIVE listings only. */
@Injectable()
export class ListingSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: ListingQueryDto, viewer?: AuthUser) {
    const where = this.buildWhere(query);
    const page = await findPage(
      query,
      (p) =>
        this.prisma.listing.findMany({
          where,
          select: listingCardSelect,
          orderBy: this.buildOrderBy(query),
          ...p,
        }),
      () => this.prisma.listing.count({ where }),
    );

    const favoriteIds = await this.favoriteIdsOf(viewer, page.items);
    return page.map((row) => ({
      ...withCoverUrl(row),
      isFavorite: favoriteIds.has(row.id),
    }));
  }

  async mapPoints(query: ListingQueryDto) {
    const rows = await this.prisma.listing.findMany({
      where: this.buildWhere(query),
      select: listingMapPointSelect,
      orderBy: { publishedAt: 'desc' },
      take: MAP_POINT_LIMIT,
    });
    return rows.map(withCoverUrl);
  }

  /** Also used by saved searches. */
  buildWhere(query: SearchInput): Prisma.ListingWhereInput {
    const where: Prisma.ListingWhereInput = {
      status: ListingStatus.ACTIVE,
      listingType: query.listingType,
      propertyType: query.propertyType,
    };
    if (query.districtIds?.length) where.districtId = { in: query.districtIds };
    if (query.rooms !== undefined) where.rooms = { gte: query.rooms };
    if (query.minArea !== undefined || query.maxArea !== undefined) {
      where.areaM2 = { gte: query.minArea, lte: query.maxArea };
    }

    const conditions = [
      ...this.amenityConditions(query),
      this.priceCondition(query),
      this.textCondition(query),
      this.mapAreaCondition(query),
    ].filter((c): c is Prisma.ListingWhereInput => c !== undefined);

    return { ...where, AND: conditions };
  }

  // ---------------------------------------------------------------- filters

  /** The listing must have every requested amenity. */
  private amenityConditions(query: SearchInput) {
    return (query.amenityIds ?? []).map((amenityId) => ({
      amenities: { some: { amenityId } },
    }));
  }

  /** Price means monthly rent for RENT and sale price for SALE. */
  private priceCondition(
    query: SearchInput,
  ): Prisma.ListingWhereInput | undefined {
    const { minPrice, maxPrice, listingType } = query;
    if (minPrice === undefined && maxPrice === undefined) return undefined;
    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      throw new BadRequestException('minPrice must be <= maxPrice');
    }

    const range = {
      gte: minPrice === undefined ? undefined : BigInt(minPrice),
      lte: maxPrice === undefined ? undefined : BigInt(maxPrice),
    };
    const rentMatch = { listingType: ListingType.RENT, monthlyRent: range };
    const saleMatch = { listingType: ListingType.SALE, salePrice: range };

    if (listingType === ListingType.RENT) return rentMatch;
    if (listingType === ListingType.SALE) return saleMatch;
    return { OR: [rentMatch, saleMatch] };
  }

  private textCondition(
    query: SearchInput,
  ): Prisma.ListingWhereInput | undefined {
    const text = query.q?.trim();
    if (!text) return undefined;
    const contains = { contains: text, mode: 'insensitive' as const };
    return {
      OR: [
        { title: contains },
        { address: contains },
        { description: contains },
      ],
    };
  }

  /** Map bounding box: all four values or none. */
  private mapAreaCondition(
    query: SearchInput,
  ): Prisma.ListingWhereInput | undefined {
    const { minLat, maxLat, minLng, maxLng } = query;
    const values = [minLat, maxLat, minLng, maxLng];
    if (values.every((v) => v === undefined)) return undefined;
    if (values.some((v) => v === undefined)) {
      throw new BadRequestException(
        'Send all of minLat, maxLat, minLng, maxLng or none',
      );
    }
    return {
      latitude: { gte: minLat, lte: maxLat },
      longitude: { gte: minLng, lte: maxLng },
    };
  }

  // ---------------------------------------------------------------- sorting

  private buildOrderBy(
    query: ListingQueryDto,
  ): Prisma.ListingOrderByWithRelationInput[] {
    const newestFirst = { id: 'desc' } as const;

    switch (query.sort) {
      case 'price_asc':
      case 'price_desc':
        return [...this.priceOrder(query), newestFirst];
      case 'popular':
        return [{ viewCount: 'desc' }, newestFirst];
      default:
        return [{ publishedAt: { sort: 'desc', nulls: 'last' } }, newestFirst];
    }
  }

  private priceOrder(
    query: ListingQueryDto,
  ): Prisma.ListingOrderByWithRelationInput[] {
    const sort = query.sort === 'price_desc' ? 'desc' : 'asc';
    if (query.listingType === ListingType.SALE) return [{ salePrice: sort }];
    if (query.listingType === ListingType.RENT) return [{ monthlyRent: sort }];
    return [
      { monthlyRent: { sort, nulls: 'last' } },
      { salePrice: { sort, nulls: 'last' } },
    ];
  }

  // ---------------------------------------------------------------- helpers

  private async favoriteIdsOf(
    viewer: AuthUser | undefined,
    rows: { id: bigint }[],
  ) {
    if (!viewer || !rows.length) return new Set<bigint>();
    const favorites = await this.prisma.favorite.findMany({
      where: { userId: viewer.id, listingId: { in: rows.map((r) => r.id) } },
      select: { listingId: true },
    });
    return new Set(favorites.map((f) => f.listingId));
  }
}
