import { Injectable, NotFoundException } from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { findPage } from '../common/http/page';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEvent } from '../realtime/realtime.events';
import { RealtimeGateway } from '../realtime/realtime.gateway';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Saves a notification. Pass `tx` to save it inside the caller's transaction,
   * then call `publish()` after the transaction commits.
   */
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

  /** Pushes saved notifications to their owners over the WebSocket. */
  publish(...notifications: Notification[]) {
    for (const notification of notifications) {
      this.realtime.emitToUser(
        notification.userId,
        RealtimeEvent.NOTIFICATION_NEW,
        notification,
      );
    }
  }

  async findAll(userId: bigint, query: NotificationQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      readAt: query.unreadOnly ? null : undefined,
    };
    return findPage(
      query,
      (p) =>
        this.prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...p,
        }),
      () => this.prisma.notification.count({ where }),
    );
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
