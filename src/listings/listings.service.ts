import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, UserRole } from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { findPage } from '../common/http/page';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { withCoverUrl } from '../prisma/selects';
import { CreateListingDto } from './dto/create-listing.dto';
import { MyListingsQueryDto } from './dto/my-listings-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import {
  mergePricing,
  resolvePricing,
  toListingFields,
} from './listing-pricing';
import {
  PUBLIC_STATUSES,
  STATUS_TRANSITIONS,
  StatusAction,
} from './listing-status';
import {
  listingCardSelect,
  listingDetailInclude,
  toListingDetail,
} from './listing.selects';

/** Use cases: Зар нийтлэх · Зар засварлах · Зар устгах / идэвхгүй болгох. */
@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ---------------------------------------------------------------- read

  async findMine(userId: bigint, query: MyListingsQueryDto) {
    const where = { ownerId: userId, status: query.status };
    const page = await findPage(
      query,
      (p) =>
        this.prisma.listing.findMany({
          where,
          select: listingCardSelect,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          ...p,
        }),
      () => this.prisma.listing.count({ where }),
    );
    return page.map(withCoverUrl);
  }

  async findOne(id: bigint, viewer?: AuthUser) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: listingDetailInclude,
    });
    if (!listing || !this.canView(listing, viewer)) {
      throw new NotFoundException('Listing not found');
    }

    const isOwner = viewer?.id === listing.ownerId;
    if (!isOwner) {
      await this.incrementViewCount(id);
      listing.viewCount += 1;
    }

    return {
      ...toListingDetail(listing),
      isOwner,
      isFavorite: await this.isFavorite(id, viewer),
    };
  }

  // ---------------------------------------------------------------- write

  /** Creates a DRAFT, or an ACTIVE listing when `publish: true`. */
  async create(ownerId: bigint, dto: CreateListingDto) {
    const { publish, ...fields } = toListingFields(dto);

    const listing = await this.prisma.listing.create({
      data: {
        ...fields,
        ...resolvePricing(dto),
        ownerId,
        status: publish ? ListingStatus.ACTIVE : ListingStatus.DRAFT,
        publishedAt: publish ? new Date() : null,
        amenities: {
          create: unique(dto.amenityIds).map((amenityId) => ({ amenityId })),
        },
      },
      include: listingDetailInclude,
    });
    return toListingDetail(listing);
  }

  async update(id: bigint, user: AuthUser, dto: UpdateListingDto) {
    const current = await this.findOwned(id, user);
    const pricing = resolvePricing(mergePricing(current, dto));

    const listing = await this.prisma.$transaction(async (tx) => {
      if (dto.amenityIds) {
        await tx.listingAmenity.deleteMany({ where: { listingId: id } });
        await tx.listingAmenity.createMany({
          data: unique(dto.amenityIds).map((amenityId) => ({
            listingId: id,
            amenityId,
          })),
        });
      }
      return tx.listing.update({
        where: { id },
        data: { ...toListingFields(dto), ...pricing },
        include: listingDetailInclude,
      });
    });
    return toListingDetail(listing);
  }

  publish(id: bigint, user: AuthUser) {
    return this.changeStatus(id, user, 'publish');
  }

  /** Owner or ADMIN. */
  deactivate(id: bigint, user: AuthUser) {
    return this.changeStatus(id, user, 'deactivate');
  }

  markAsRented(id: bigint, user: AuthUser) {
    return this.changeStatus(id, user, 'markAsRented');
  }

  markAsSold(id: bigint, user: AuthUser) {
    return this.changeStatus(id, user, 'markAsSold');
  }

  /** Owner or ADMIN. Photos, requests and chats are deleted with it (DB cascade). */
  async remove(id: bigint, user: AuthUser): Promise<void> {
    await this.findOwned(id, user, { allowAdmin: true });
    const photos = await this.prisma.listingPhoto.findMany({
      where: { listingId: id },
      select: { cloudinaryPublicId: true },
    });

    await this.prisma.listing.delete({ where: { id } });
    await this.cloudinary.remove(photos.map((p) => p.cloudinaryPublicId));
  }

  // ---------------------------------------------------------------- shared

  /** Loads a listing the user is allowed to modify. Used by photos too. */
  async findOwned(
    id: bigint,
    user: AuthUser,
    options: { allowAdmin?: boolean } = {},
  ) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');

    const isOwner = listing.ownerId === user.id;
    const isAllowedAdmin =
      options.allowAdmin === true && user.role === UserRole.ADMIN;
    if (!isOwner && !isAllowedAdmin) {
      throw new ForbiddenException('Not your listing');
    }
    return listing;
  }

  // ---------------------------------------------------------------- private

  private async changeStatus(id: bigint, user: AuthUser, action: StatusAction) {
    const transition = STATUS_TRANSITIONS[action];
    const current = await this.findOwned(id, user, {
      allowAdmin: action === 'deactivate',
    });

    if (transition.onlyFor && current.listingType !== transition.onlyFor) {
      throw new BadRequestException(
        `${action} is only for ${transition.onlyFor} listings`,
      );
    }
    if (!transition.from.includes(current.status)) {
      throw new ConflictException(
        `Cannot ${action} a listing with status ${current.status}`,
      );
    }

    const isGoingLive = transition.to === ListingStatus.ACTIVE;
    const listing = await this.prisma.listing.update({
      where: { id },
      data: {
        status: transition.to,
        publishedAt: isGoingLive
          ? (current.publishedAt ?? new Date())
          : undefined,
      },
      include: listingDetailInclude,
    });
    return toListingDetail(listing);
  }

  private canView(
    listing: { ownerId: bigint; status: ListingStatus },
    viewer?: AuthUser,
  ) {
    if (PUBLIC_STATUSES.includes(listing.status)) return true;
    return (
      viewer !== undefined &&
      (viewer.id === listing.ownerId || viewer.role === UserRole.ADMIN)
    );
  }

  /** Raw SQL so a page view doesn't change `updated_at`. */
  private incrementViewCount(id: bigint) {
    return this.prisma
      .$executeRaw`UPDATE listings SET view_count = view_count + 1 WHERE id = ${id}`;
  }

  private async isFavorite(listingId: bigint, viewer?: AuthUser) {
    if (!viewer) return false;
    const count = await this.prisma.favorite.count({
      where: { userId: viewer.id, listingId },
    });
    return count > 0;
  }
}

function unique(ids: number[] = []) {
  return [...new Set(ids)];
}
