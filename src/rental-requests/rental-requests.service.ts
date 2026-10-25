import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingStatus,
  ListingType,
  NotificationType,
  Prisma,
  RequestStatus,
  UserRole,
} from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { paginate } from '../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRentalRequestDto,
  RentalRequestQueryDto,
} from './dto/rental-request.dto';

const userBrief = {
  select: { id: true, fullName: true, avatarUrl: true, phone: true },
} as const;

const listingBrief = {
  select: {
    id: true,
    title: true,
    ownerId: true,
    status: true,
    monthlyRent: true,
    photos: {
      select: { url: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      take: 1,
    },
  },
} satisfies Prisma.ListingDefaultArgs;

/** Today's date in Ulaanbaatar as YYYY-MM-DD. */
function todayUB() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
  });
}

@Injectable()
export class RentalRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Use case: Түрээсийн хүсэлт илгээх (see sequence diagram). */
  async create(user: AuthUser, dto: CreateRentalRequestDto) {
    const listingId = BigInt(dto.listingId);
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        title: true,
        ownerId: true,
        status: true,
        listingType: true,
        minMonths: true,
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.listingType !== ListingType.RENT) {
      throw new BadRequestException(
        'Rental requests are only for RENT listings',
      );
    }
    if (listing.ownerId === user.id) {
      throw new BadRequestException('You cannot request your own listing');
    }
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new ConflictException('This listing is not accepting requests');
    }
    if (listing.minMonths && dto.months < listing.minMonths) {
      throw new BadRequestException(
        `Minimum rental period is ${listing.minMonths} months`,
      );
    }
    if (dto.startDate < todayUB()) {
      throw new BadRequestException('startDate cannot be in the past');
    }
    const duplicate = await this.prisma.rentalRequest.count({
      where: { listingId, renterId: user.id, status: RequestStatus.PENDING },
    });
    if (duplicate) {
      throw new ConflictException(
        'You already have a pending request for this listing',
      );
    }

    // The partial unique index still guards against a race → P2002 → 409.
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.rentalRequest.create({
        data: {
          listingId,
          renterId: user.id,
          startDate: new Date(dto.startDate),
          months: dto.months,
          note: dto.note,
        },
        include: { renter: userBrief },
      });
      await this.notifications.create(
        {
          userId: listing.ownerId,
          type: NotificationType.NEW_RENTAL_REQUEST,
          title: 'Шинэ түрээсийн хүсэлт',
          body: `${request.renter.fullName} таны "${listing.title}" зарт хүсэлт илгээлээ.`,
          data: { listingId, requestId: request.id },
        },
        tx,
      );
      return request;
    });
  }

  /** Requests I sent as a renter. */
  async sent(userId: bigint, q: RentalRequestQueryDto) {
    const where: Prisma.RentalRequestWhereInput = {
      renterId: userId,
      status: q.status,
    };
    return this.page(where, q);
  }

  /** Requests on my listings (I'm the owner). */
  async received(userId: bigint, q: RentalRequestQueryDto) {
    const where: Prisma.RentalRequestWhereInput = {
      listing: { ownerId: userId },
      status: q.status,
    };
    return this.page(where, q);
  }

  async findOne(id: bigint, user: AuthUser) {
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id },
      include: {
        listing: listingBrief,
        renter: userBrief,
        reviews: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (
      !request ||
      (request.renterId !== user.id &&
        request.listing.ownerId !== user.id &&
        user.role !== UserRole.ADMIN)
    ) {
      throw new NotFoundException('Rental request not found');
    }
    return this.withCover(request);
  }

  /** Use case: Хүсэлт зөвшөөрөх. Owner only, PENDING only. */
  async approve(id: bigint, user: AuthUser) {
    return this.respond(id, user, RequestStatus.APPROVED);
  }

  /** Use case: Хүсэлт татгалзах. */
  async reject(id: bigint, user: AuthUser, reason?: string) {
    return this.respond(id, user, RequestStatus.REJECTED, reason);
  }

  /** Renter withdraws a PENDING request. */
  async cancel(id: bigint, user: AuthUser) {
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id },
    });
    if (!request || request.renterId !== user.id) {
      throw new NotFoundException('Rental request not found');
    }
    const { count } = await this.prisma.rentalRequest.updateMany({
      where: { id, status: RequestStatus.PENDING },
      data: { status: RequestStatus.CANCELLED },
    });
    if (!count)
      throw new ConflictException('Only PENDING requests can be cancelled');
    return this.findOne(id, user);
  }

  // ---------------------------------------------------------------- helpers

  private async respond(
    id: bigint,
    user: AuthUser,
    status: typeof RequestStatus.APPROVED | typeof RequestStatus.REJECTED,
    reason?: string,
  ) {
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id },
      include: {
        listing: { select: { id: true, title: true, ownerId: true } },
      },
    });
    if (!request) throw new NotFoundException('Rental request not found');
    if (request.listing.ownerId !== user.id) {
      throw new ForbiddenException('Only the listing owner can respond');
    }
    if (request.status !== RequestStatus.PENDING) {
      throw new ConflictException(`Request is already ${request.status}`);
    }

    await this.prisma.$transaction(async (tx) => {
      // conditional update: two quick clicks can't both succeed
      const { count } = await tx.rentalRequest.updateMany({
        where: { id, status: RequestStatus.PENDING },
        data: {
          status,
          rejectReason: status === RequestStatus.REJECTED ? reason : null,
          respondedAt: new Date(),
        },
      });
      if (!count) {
        throw new ConflictException('Request was already answered');
      }
      const approved = status === RequestStatus.APPROVED;
      await this.notifications.create(
        {
          userId: request.renterId,
          type: approved
            ? NotificationType.RENTAL_REQUEST_APPROVED
            : NotificationType.RENTAL_REQUEST_REJECTED,
          title: approved
            ? 'Түрээсийн хүсэлт зөвшөөрөгдлөө'
            : 'Түрээсийн хүсэлт татгалзагдлаа',
          body: approved
            ? `"${request.listing.title}" зарын эзэмшигч таны хүсэлтийг зөвшөөрлөө.`
            : `"${request.listing.title}" зарын эзэмшигч таны хүсэлтийг татгалзлаа.${reason ? ` Шалтгаан: ${reason}` : ''}`,
          data: { listingId: request.listing.id, requestId: id },
        },
        tx,
      );
    });
    return this.findOne(id, user);
  }

  private async page(
    where: Prisma.RentalRequestWhereInput,
    q: RentalRequestQueryDto,
  ) {
    const [rows, total] = await Promise.all([
      this.prisma.rentalRequest.findMany({
        where,
        include: { listing: listingBrief, renter: userBrief },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...paginate(q),
      }),
      this.prisma.rentalRequest.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.withCover(r)),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  private withCover<T extends { listing: { photos: { url: string }[] } }>(
    r: T,
  ) {
    const { photos, ...listing } = r.listing;
    return { ...r, listing: { ...listing, coverUrl: photos[0]?.url ?? null } };
  }
}
