import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, ListingType, Prisma, UserRole } from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { paginate } from '../common/dto/pagination.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { MyListingsQueryDto } from './dto/my-listings-query.dto';
import { SearchFiltersDto } from './dto/search-filters.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import {
  listingCardSelect,
  listingDetailInclude,
  toListingCard,
  toListingDetail,
} from './listing.selects';

/** Statuses anyone can open by id. DRAFT/INACTIVE are visible to owner/admin only. */
const PUBLIC_STATUSES: ListingStatus[] = [
  ListingStatus.ACTIVE,
  ListingStatus.RENTED,
  ListingStatus.SOLD,
];

export type ListingAction =
  'publish' | 'deactivate' | 'markRented' | 'markSold';

/** Allowed status changes — matches the methods on Listing/RentListing/SaleListing in the class diagram. */
const TRANSITIONS: Record<
  ListingAction,
  { from: ListingStatus[]; to: ListingStatus; onlyType?: ListingType }
> = {
  publish: {
    from: [ListingStatus.DRAFT, ListingStatus.INACTIVE, ListingStatus.RENTED],
    to: ListingStatus.ACTIVE,
  },
  deactivate: { from: [ListingStatus.ACTIVE], to: ListingStatus.INACTIVE },
  markRented: {
    from: [ListingStatus.ACTIVE, ListingStatus.INACTIVE],
    to: ListingStatus.RENTED,
    onlyType: ListingType.RENT,
  },
  markSold: {
    from: [ListingStatus.ACTIVE, ListingStatus.INACTIVE],
    to: ListingStatus.SOLD,
    onlyType: ListingType.SALE,
  },
};

const MAP_POINT_LIMIT = 500;

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ================================================================ search

  /** Use cases: Үнэ, байршлаар шүүж хайх. Only ACTIVE listings. */
  async search(q: ListingQueryDto, viewer?: AuthUser) {
    const where = this.buildWhere(q);
    const [rows, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        select: listingCardSelect,
        orderBy: this.buildOrderBy(q),
        ...paginate(q),
      }),
      this.prisma.listing.count({ where }),
    ]);
    const favIds = await this.favoriteIds(
      viewer,
      rows.map((r) => r.id),
    );
    return {
      items: rows.map((r) => ({
        ...toListingCard(r),
        isFavorite: favIds.has(r.id),
      })),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  /** Use case: Газрын зураг дээр зар харах. Lightweight points, capped. */
  async mapPoints(q: ListingQueryDto) {
    const rows = await this.prisma.listing.findMany({
      where: this.buildWhere(q),
      select: {
        id: true,
        title: true,
        listingType: true,
        propertyType: true,
        monthlyRent: true,
        salePrice: true,
        latitude: true,
        longitude: true,
        photos: {
          select: { url: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          take: 1,
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: MAP_POINT_LIMIT,
    });
    return rows.map(({ photos, ...r }) => ({
      ...r,
      coverUrl: photos[0]?.url ?? null,
    }));
  }

  /** Shared with saved searches. */
  buildWhere(
    q: SearchFiltersDto & Partial<ListingQueryDto>,
  ): Prisma.ListingWhereInput {
    const and: Prisma.ListingWhereInput[] = [];
    const where: Prisma.ListingWhereInput = {
      status: ListingStatus.ACTIVE,
      AND: and,
    };

    if (q.listingType) where.listingType = q.listingType;
    if (q.propertyType) where.propertyType = q.propertyType;
    if (q.districtIds?.length) where.districtId = { in: q.districtIds };
    if (q.rooms !== undefined) where.rooms = { gte: q.rooms };
    if (q.minArea !== undefined || q.maxArea !== undefined) {
      where.areaM2 = { gte: q.minArea, lte: q.maxArea };
    }
    for (const amenityId of q.amenityIds ?? []) {
      and.push({ amenities: { some: { amenityId } } });
    }

    if (q.minPrice !== undefined || q.maxPrice !== undefined) {
      if (
        q.minPrice !== undefined &&
        q.maxPrice !== undefined &&
        q.minPrice > q.maxPrice
      ) {
        throw new BadRequestException('minPrice must be <= maxPrice');
      }
      const range = {
        gte: q.minPrice !== undefined ? BigInt(q.minPrice) : undefined,
        lte: q.maxPrice !== undefined ? BigInt(q.maxPrice) : undefined,
      };
      if (q.listingType === ListingType.RENT) where.monthlyRent = range;
      else if (q.listingType === ListingType.SALE) where.salePrice = range;
      else {
        and.push({
          OR: [
            { listingType: ListingType.RENT, monthlyRent: range },
            { listingType: ListingType.SALE, salePrice: range },
          ],
        });
      }
    }

    const text = q.q?.trim();
    if (text) {
      and.push({
        OR: [
          { title: { contains: text, mode: 'insensitive' } },
          { address: { contains: text, mode: 'insensitive' } },
          { description: { contains: text, mode: 'insensitive' } },
        ],
      });
    }

    const bbox = [q.minLat, q.maxLat, q.minLng, q.maxLng];
    if (bbox.some((v) => v !== undefined)) {
      if (bbox.some((v) => v === undefined)) {
        throw new BadRequestException(
          'Send all of minLat, maxLat, minLng, maxLng or none',
        );
      }
      where.latitude = { gte: q.minLat, lte: q.maxLat };
      where.longitude = { gte: q.minLng, lte: q.maxLng };
    }

    return where;
  }

  private buildOrderBy(
    q: ListingQueryDto,
  ): Prisma.ListingOrderByWithRelationInput[] {
    const dir = q.sort === 'price_desc' ? 'desc' : 'asc';
    switch (q.sort) {
      case 'price_asc':
      case 'price_desc':
        return q.listingType === ListingType.SALE
          ? [{ salePrice: dir }, { id: 'desc' }]
          : q.listingType === ListingType.RENT
            ? [{ monthlyRent: dir }, { id: 'desc' }]
            : [
                { monthlyRent: { sort: dir, nulls: 'last' } },
                { salePrice: { sort: dir, nulls: 'last' } },
                { id: 'desc' },
              ];
      case 'popular':
        return [{ viewCount: 'desc' }, { id: 'desc' }];
      default:
        return [
          { publishedAt: { sort: 'desc', nulls: 'last' } },
          { id: 'desc' },
        ];
    }
  }

  private async favoriteIds(viewer: AuthUser | undefined, ids: bigint[]) {
    if (!viewer || !ids.length) return new Set<bigint>();
    const favs = await this.prisma.favorite.findMany({
      where: { userId: viewer.id, listingId: { in: ids } },
      select: { listingId: true },
    });
    return new Set(favs.map((f) => f.listingId));
  }

  // ================================================================ read

  async mine(userId: bigint, q: MyListingsQueryDto) {
    const where: Prisma.ListingWhereInput = {
      ownerId: userId,
      status: q.status,
    };
    const [rows, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        select: listingCardSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        ...paginate(q),
      }),
      this.prisma.listing.count({ where }),
    ]);
    return {
      items: rows.map(toListingCard),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  async findOne(id: bigint, viewer?: AuthUser) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: listingDetailInclude,
    });
    const canSeeHidden =
      viewer &&
      listing &&
      (listing.ownerId === viewer.id || viewer.role === UserRole.ADMIN);
    if (
      !listing ||
      (!PUBLIC_STATUSES.includes(listing.status) && !canSeeHidden)
    ) {
      throw new NotFoundException('Listing not found');
    }

    const isOwner = viewer?.id === listing.ownerId;
    if (!isOwner) {
      // raw update so the view counter doesn't touch updated_at
      await this.prisma
        .$executeRaw`UPDATE listings SET view_count = view_count + 1 WHERE id = ${id}`;
      listing.viewCount += 1;
    }
    const favIds = await this.favoriteIds(viewer, [id]);
    return { ...toListingDetail(listing), isOwner, isFavorite: favIds.has(id) };
  }

  // ================================================================ write

  /** Use case: Зар нийтлэх. Creates a DRAFT, or ACTIVE when `publish: true`. */
  async create(userId: bigint, dto: CreateListingDto) {
    const { amenityIds, publish, ...fields } = dto;
    const data = { ...this.toData(fields), ...this.pricing(fields) };
    const listing = await this.prisma.listing.create({
      data: {
        ...data,
        ownerId: userId,
        status: publish ? ListingStatus.ACTIVE : ListingStatus.DRAFT,
        publishedAt: publish ? new Date() : null,
        amenities: amenityIds?.length
          ? {
              createMany: {
                data: [...new Set(amenityIds)].map((amenityId) => ({
                  amenityId,
                })),
              },
            }
          : undefined,
      } as Prisma.ListingUncheckedCreateInput,
      include: listingDetailInclude,
    });
    return toListingDetail(listing);
  }

  /** Use case: Зар засварлах. */
  async update(id: bigint, user: AuthUser, dto: UpdateListingDto) {
    const current = await this.getForOwner(id, user);
    const { amenityIds, ...fields } = dto;

    // Validate pricing against the merged result (e.g. switching RENT → SALE).
    const merged = {
      listingType: fields.listingType ?? current.listingType,
      monthlyRent:
        fields.monthlyRent ??
        (current.monthlyRent !== null
          ? Number(current.monthlyRent)
          : undefined),
      salePrice:
        fields.salePrice ??
        (current.salePrice !== null ? Number(current.salePrice) : undefined),
      deposit:
        fields.deposit ??
        (current.deposit !== null ? Number(current.deposit) : undefined),
      minMonths: fields.minMonths ?? current.minMonths ?? undefined,
      utilitiesIncluded: fields.utilitiesIncluded ?? current.utilitiesIncluded,
    };
    const data = { ...this.toData(fields), ...this.pricing(merged) };

    const listing = await this.prisma.$transaction(async (tx) => {
      if (amenityIds) {
        await tx.listingAmenity.deleteMany({ where: { listingId: id } });
        if (amenityIds.length) {
          await tx.listingAmenity.createMany({
            data: [...new Set(amenityIds)].map((amenityId) => ({
              listingId: id,
              amenityId,
            })),
          });
        }
      }
      return tx.listing.update({
        where: { id },
        data,
        include: listingDetailInclude,
      });
    });
    return toListingDetail(listing);
  }

  /** publish / deactivate / markRented / markSold */
  async changeStatus(id: bigint, user: AuthUser, action: ListingAction) {
    const rule = TRANSITIONS[action];
    const current = await this.getForOwner(id, user, {
      allowAdmin: action === 'deactivate',
    });
    if (rule.onlyType && current.listingType !== rule.onlyType) {
      throw new BadRequestException(
        `${action} is only for ${rule.onlyType} listings`,
      );
    }
    if (!rule.from.includes(current.status)) {
      throw new ConflictException(
        `Cannot ${action} a listing with status ${current.status}`,
      );
    }
    const listing = await this.prisma.listing.update({
      where: { id },
      data: {
        status: rule.to,
        publishedAt:
          rule.to === ListingStatus.ACTIVE
            ? (current.publishedAt ?? new Date())
            : undefined,
      },
      include: listingDetailInclude,
    });
    return toListingDetail(listing);
  }

  /** Use case: Зар устгах. Owner or ADMIN. Cascades photos, requests, chats… */
  async remove(id: bigint, user: AuthUser) {
    await this.getForOwner(id, user, { allowAdmin: true });
    const photos = await this.prisma.listingPhoto.findMany({
      where: { listingId: id },
      select: { cloudinaryPublicId: true },
    });
    await this.prisma.listing.delete({ where: { id } });
    await this.cloudinary.remove(photos.map((p) => p.cloudinaryPublicId));
    return { ok: true };
  }

  // ================================================================ helpers

  /** Loads a listing and checks the user may modify it. */
  async getForOwner(
    id: bigint,
    user: AuthUser,
    opts: { allowAdmin?: boolean } = {},
  ) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');
    const isAdmin = opts.allowAdmin && user.role === UserRole.ADMIN;
    if (listing.ownerId !== user.id && !isAdmin) {
      throw new ForbiddenException('Not your listing');
    }
    return listing;
  }

  /** DTO (numbers/strings) → Prisma data (BigInt/Date). Undefined keys are left out. */
  private toData(f: Omit<UpdateListingDto, 'amenityIds'>) {
    const big = (v?: number) => (v === undefined ? undefined : BigInt(v));
    const data: Record<string, unknown> = {
      ...f,
      monthlyRent: big(f.monthlyRent),
      deposit: big(f.deposit),
      salePrice: big(f.salePrice),
      availableFrom: f.availableFrom ? new Date(f.availableFrom) : undefined,
    };
    return data;
  }

  /**
   * RENT needs monthlyRent, SALE needs salePrice (also a CHECK in the DB).
   * Fields that don't belong to the type are cleared.
   */
  private pricing(f: {
    listingType?: ListingType;
    monthlyRent?: number;
    salePrice?: number;
    deposit?: number;
    minMonths?: number;
    utilitiesIncluded?: boolean;
  }) {
    if (f.listingType === ListingType.RENT) {
      if (f.monthlyRent === undefined) {
        throw new BadRequestException(
          'monthlyRent is required for RENT listings',
        );
      }
      return {
        monthlyRent: BigInt(f.monthlyRent),
        deposit: f.deposit !== undefined ? BigInt(f.deposit) : undefined,
        minMonths: f.minMonths,
        utilitiesIncluded: f.utilitiesIncluded,
        salePrice: null,
      };
    }
    if (f.salePrice === undefined) {
      throw new BadRequestException('salePrice is required for SALE listings');
    }
    return {
      salePrice: BigInt(f.salePrice),
      monthlyRent: null,
      deposit: null,
      minMonths: null,
      utilitiesIncluded: false,
    };
  }
}
