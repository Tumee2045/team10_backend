import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { paginate } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationQueryDto } from './dto/notification-query.dto';

export interface NotificationInput {
  userId: bigint;
  type: NotificationType;
  title: string;
  body?: string;
  /** Ids the frontend needs to build a link: listingId, requestId, conversationId… */
  data?: Record<string, bigint | number | string>;
}

/** Works with both `prisma` and a transaction client `tx`. */
type Db = Pick<PrismaService, 'notification'>;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: NotificationInput, db: Db = this.prisma) {
    return db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title.slice(0, 150),
        body: input.body?.slice(0, 500),
        // bigint isn't valid JSON → store ids as numbers
        data: input.data
          ? (JSON.parse(JSON.stringify(input.data)) as Prisma.InputJsonObject)
          : undefined,
      },
    });
  }

  async list(userId: bigint, q: NotificationQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(q.unreadOnly ? { readAt: null } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paginate(q),
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit };
  }

  async unreadCount(userId: bigint) {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markRead(userId: bigint, id: bigint) {
    const n = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!n) throw new NotFoundException('Notification not found');
    if (n.readAt) return n;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: bigint) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }
}
