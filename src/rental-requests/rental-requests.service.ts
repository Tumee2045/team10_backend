import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Listing,
  ListingStatus,
  ListingType,
  NotificationType,
  Prisma,
  RequestStatus,
  UserRole,
} from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { findPage } from '../common/http/page';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  listingBriefSelect,
  userContactSelect,
  withCoverUrl,
} from '../prisma/selects';
import { CreateRentalRequestDto } from './dto/create-rental-request.dto';
import { RentalRequestQueryDto } from './dto/rental-request-query.dto';

const requestInclude = {
  listing: { select: listingBriefSelect },
  renter: { select: userContactSelect },
} satisfies Prisma.RentalRequestInclude;

type RequestRow = Prisma.RentalRequestGetPayload<{
  include: typeof requestInclude;
}>;

type Answer = typeof RequestStatus.APPROVED | typeof RequestStatus.REJECTED;

/** Use cases: Түрээсийн хүсэлт илгээх · Хүсэлт зөвшөөрөх / татгалзах. */
@Injectable()
export class RentalRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------- renter

  /** Steps match the sequence diagram: check listing → save PENDING → notify owner. */
  async create(user: AuthUser, dto: CreateRentalRequestDto) {
    const listingId = BigInt(dto.listingId);
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    this.assertCanRequest(listing, user, dto);
    await this.assertNoPendingRequest(listingId, user.id);

    // If two requests race past the check above, the DB's partial unique index → 409.
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.rentalRequest.create({
        data: {
          listingId,
          renterId: user.id,
          startDate: new Date(dto.startDate),
          months: dto.months,
          note: dto.note,
        },
        include: requestInclude,
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
      return toView(request);
    });
  }

  async cancel(id: bigint, user: AuthUser) {
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id },
    });
    if (!request || request.renterId !== user.id) {
      throw new NotFoundException('Rental request not found');
    }
    if (request.status !== RequestStatus.PENDING) {
      throw new ConflictException('Only PENDING requests can be cancelled');
    }

    await this.setStatusIfPending(this.prisma, id, {
      status: RequestStatus.CANCELLED,
    });
    return this.findOne(id, user);
  }

  // ---------------------------------------------------------------- owner

  approve(id: bigint, user: AuthUser) {
    return this.answer(id, user, RequestStatus.APPROVED);
  }

  reject(id: bigint, user: AuthUser, reason?: string) {
    return this.answer(id, user, RequestStatus.REJECTED, reason);
  }

  // ---------------------------------------------------------------- read

  /** Requests I sent as a renter. */
  findSent(userId: bigint, query: RentalRequestQueryDto) {
    return this.findPage({ renterId: userId, status: query.status }, query);
  }

  /** Requests on my listings. */
  findReceived(userId: bigint, query: RentalRequestQueryDto) {
    return this.findPage(
      { listing: { ownerId: userId }, status: query.status },
      query,
    );
  }

  /** Visible to the renter, the listing owner and admins. */
  async findOne(id: bigint, user: AuthUser) {
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id },
      include: {
        ...requestInclude,
        reviews: { orderBy: { createdAt: 'asc' } },
      },
    });
    const canView =
      request &&
      (request.renterId === user.id ||
        request.listing.ownerId === user.id ||
        user.role === UserRole.ADMIN);
    if (!canView) throw new NotFoundException('Rental request not found');
    return toView(request);
  }

  // ---------------------------------------------------------------- private

  private assertCanRequest(
    listing: Listing,
    user: AuthUser,
    dto: CreateRentalRequestDto,
  ) {
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
    if (dto.startDate < todayInUlaanbaatar()) {
      throw new BadRequestException('startDate cannot be in the past');
    }
  }

  private async assertNoPendingRequest(listingId: bigint, renterId: bigint) {
    const pending = await this.prisma.rentalRequest.count({
      where: { listingId, renterId, status: RequestStatus.PENDING },
    });
    if (pending) {
      throw new ConflictException(
        'You already have a pending request for this listing',
      );
    }
  }

  private async answer(
    id: bigint,
    user: AuthUser,
    status: Answer,
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

    const isApproved = status === RequestStatus.APPROVED;
    const { title } = request.listing;

    await this.prisma.$transaction(async (tx) => {
      await this.setStatusIfPending(tx, id, {
        status,
        rejectReason: isApproved ? null : reason,
        respondedAt: new Date(),
      });
      await this.notifications.create(
        {
          userId: request.renterId,
          type: isApproved
            ? NotificationType.RENTAL_REQUEST_APPROVED
            : NotificationType.RENTAL_REQUEST_REJECTED,
          title: isApproved
            ? 'Түрээсийн хүсэлт зөвшөөрөгдлөө'
            : 'Түрээсийн хүсэлт татгалзагдлаа',
          body: isApproved
            ? `"${title}" зарын эзэмшигч таны хүсэлтийг зөвшөөрлөө.`
            : `"${title}" зарын эзэмшигч таны хүсэлтийг татгалзлаа.` +
              (reason ? ` Шалтгаан: ${reason}` : ''),
          data: { listingId: request.listing.id, requestId: id },
        },
        tx,
      );
    });
    return this.findOne(id, user);
  }

  /** Conditional update, so two quick clicks can't both change a PENDING request. */
  private async setStatusIfPending(
    db: Pick<PrismaService, 'rentalRequest'>,
    id: bigint,
    data: Prisma.RentalRequestUpdateManyMutationInput,
  ) {
    const { count } = await db.rentalRequest.updateMany({
      where: { id, status: RequestStatus.PENDING },
      data,
    });
    if (!count) throw new ConflictException('Request was already answered');
  }

  private async findPage(
    where: Prisma.RentalRequestWhereInput,
    query: RentalRequestQueryDto,
  ) {
    const page = await findPage(
      query,
      (p) =>
        this.prisma.rentalRequest.findMany({
          where,
          include: requestInclude,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...p,
        }),
      () => this.prisma.rentalRequest.count({ where }),
    );
    return page.map(toView);
  }
}

function toView<T extends Pick<RequestRow, 'listing'>>(request: T) {
  return { ...request, listing: withCoverUrl(request.listing) };
}

/** Today's date in Ulaanbaatar as YYYY-MM-DD. */
function todayInUlaanbaatar() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
  });
}
