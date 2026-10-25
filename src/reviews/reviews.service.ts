import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, RequestStatus } from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { PaginationQueryDto, paginate } from '../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';

const authorBrief = {
  select: { id: true, fullName: true, avatarUrl: true },
} as const;

/** Use case: Үнэлгээ, сэтгэгдэл үлдээх. Renter ↔ owner rate each other after an APPROVED request. */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthUser, dto: CreateReviewDto) {
    const requestId = BigInt(dto.rentalRequestId);
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id: requestId },
      include: {
        listing: { select: { id: true, title: true, ownerId: true } },
      },
    });
    const ownerId = request?.listing.ownerId;
    if (!request || (request.renterId !== user.id && ownerId !== user.id)) {
      throw new NotFoundException('Rental request not found');
    }
    if (request.status !== RequestStatus.APPROVED) {
      throw new BadRequestException('You can only review an approved rental');
    }
    const targetUserId =
      request.renterId === user.id ? ownerId! : request.renterId;

    const already = await this.prisma.review.count({
      where: { rentalRequestId: requestId, authorId: user.id },
    });
    if (already)
      throw new ConflictException('You already reviewed this rental');

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          rentalRequestId: requestId,
          authorId: user.id,
          targetUserId,
          rating: dto.rating,
          comment: dto.comment,
        },
        include: { author: authorBrief },
      });
      await this.notifications.create(
        {
          userId: targetUserId,
          type: NotificationType.NEW_REVIEW,
          title: 'Шинэ үнэлгээ',
          body: `${review.author.fullName} танд ${dto.rating}★ үнэлгээ өглөө.`,
          data: {
            reviewId: review.id,
            requestId,
            listingId: request.listing.id,
          },
        },
        tx,
      );
      return review;
    });
  }

  async update(user: AuthUser, id: bigint, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.authorId !== user.id) {
      throw new ForbiddenException('You can only edit your own review');
    }
    return this.prisma.review.update({
      where: { id },
      data: dto,
      include: { author: authorBrief },
    });
  }

  /** Reviews a user received, newest first. */
  async forUser(userId: bigint, q: PaginationQueryDto) {
    const where = { targetUserId: userId };
    const [items, total, agg] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: { author: authorBrief },
        orderBy: { createdAt: 'desc' },
        ...paginate(q),
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({ where, _avg: { rating: true } }),
    ]);
    return {
      items,
      total,
      page: q.page,
      limit: q.limit,
      averageRating: agg._avg.rating
        ? Math.round(agg._avg.rating * 10) / 10
        : null,
    };
  }
}
