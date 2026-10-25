import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, RequestStatus } from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { findPage } from '../common/http/page';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { userBriefSelect } from '../prisma/selects';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

const withAuthor = { author: { select: userBriefSelect } };

/** Use case: Үнэлгээ, сэтгэгдэл үлдээх. Renter and owner rate each other after an APPROVED request. */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthUser, dto: CreateReviewDto) {
    const rentalRequestId = BigInt(dto.rentalRequestId);
    const targetUserId = await this.findOtherParty(rentalRequestId, user);
    await this.assertNotReviewedYet(rentalRequestId, user.id);

    const [review, notification] = await this.prisma.$transaction(
      async (tx) => {
        const review = await tx.review.create({
          data: {
            rentalRequestId,
            authorId: user.id,
            targetUserId,
            rating: dto.rating,
            comment: dto.comment,
          },
          include: withAuthor,
        });
        const notification = await this.notifications.create(
          {
            userId: targetUserId,
            type: NotificationType.NEW_REVIEW,
            title: 'Шинэ үнэлгээ',
            body: `${review.author.fullName} танд ${dto.rating}★ үнэлгээ өглөө.`,
            data: { reviewId: review.id, requestId: rentalRequestId },
          },
          tx,
        );
        return [review, notification] as const;
      },
    );

    this.notifications.publish(notification);
    return review;
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
      include: withAuthor,
    });
  }

  /** Reviews a user received, newest first. */
  async findForUser(userId: bigint, query: PaginationQueryDto) {
    const where = { targetUserId: userId };
    return findPage(
      query,
      (p) =>
        this.prisma.review.findMany({
          where,
          include: withAuthor,
          orderBy: { createdAt: 'desc' },
          ...p,
        }),
      () => this.prisma.review.count({ where }),
    );
  }

  /** `{ average: 4.5, count: 12 }`, average rounded to 1 decimal. Used on profiles. */
  async ratingSummary(userId: bigint) {
    const result = await this.prisma.review.aggregate({
      where: { targetUserId: userId },
      _avg: { rating: true },
      _count: true,
    });
    const average = result._avg.rating;
    return {
      average: average === null ? null : Math.round(average * 10) / 10,
      count: result._count,
    };
  }

  // ---------------------------------------------------------------- private

  /** The user must be the renter or the owner of an APPROVED request. Returns the other one. */
  private async findOtherParty(rentalRequestId: bigint, user: AuthUser) {
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id: rentalRequestId },
      include: { listing: { select: { ownerId: true } } },
    });
    if (!request) throw new NotFoundException('Rental request not found');

    const { renterId } = request;
    const { ownerId } = request.listing;
    if (user.id !== renterId && user.id !== ownerId) {
      throw new NotFoundException('Rental request not found');
    }
    if (request.status !== RequestStatus.APPROVED) {
      throw new BadRequestException('You can only review an approved rental');
    }
    return user.id === renterId ? ownerId : renterId;
  }

  private async assertNotReviewedYet(
    rentalRequestId: bigint,
    authorId: bigint,
  ) {
    const existing = await this.prisma.review.count({
      where: { rentalRequestId, authorId },
    });
    if (existing)
      throw new ConflictException('You already reviewed this rental');
  }
}
