import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { Page, pageArgs } from '../common/http/page';
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

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass `tx` to create the notification inside the caller's transaction. */
  create(
    input: NotificationInput,
    db: Pick<PrismaService, 'notification'> = this.prisma,
  ) {
    return db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title.slice(0, 150),
        body: input.body?.slice(0, 500),
        data: input.data ? toJson(input.data) : undefined,
      },
    });
  }

  async findAll(userId: bigint, query: NotificationQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      readAt: query.unreadOnly ? null : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.notification.count({ where }),
    ]);
    return Page.of(items, total, query);
  }

  async countUnread(userId: bigint) {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markAsRead(userId: bigint, id: bigint) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.readAt) return notification;

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: bigint) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }
}

/** bigint isn't valid JSON, so ids are stored as numbers. */
function toJson(data: NotificationInput['data']) {
  return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonObject;
}
