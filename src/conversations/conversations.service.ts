import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, NotificationType, Prisma } from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesQueryDto } from './dto/conversation.dto';

const userBrief = {
  select: { id: true, fullName: true, avatarUrl: true },
} as const;

const conversationInclude = {
  listing: {
    select: {
      id: true,
      title: true,
      status: true,
      photos: {
        select: { url: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        take: 1,
      },
    },
  },
  owner: userBrief,
  client: userBrief,
  messages: { orderBy: { id: 'desc' }, take: 1 },
} satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{
  include: typeof conversationInclude;
}>;

/** Use case: Эзэмшигч / түрээслэгчтэй чатлах. One thread per (listing, client). */
@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Opens (or returns the existing) chat with the owner of a listing. */
  async start(user: AuthUser, listingId: bigint) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, ownerId: true, status: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.ownerId === user.id) {
      throw new BadRequestException('You cannot message yourself');
    }

    const existing = await this.prisma.conversation.findUnique({
      where: { listingId_clientId: { listingId, clientId: user.id } },
      include: conversationInclude,
    });
    if (existing) return this.toView(existing, user.id);

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new ConflictException('This listing is not active');
    }
    const created = await this.prisma.conversation.create({
      data: { listingId, ownerId: listing.ownerId, clientId: user.id },
      include: conversationInclude,
    });
    return this.toView(created, user.id);
  }

  /** My conversations (as owner or client), newest activity first, with unread counts. */
  async list(user: AuthUser) {
    const rows = await this.prisma.conversation.findMany({
      where: { OR: [{ ownerId: user.id }, { clientId: user.id }] },
      include: conversationInclude,
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });
    return Promise.all(rows.map((r) => this.toView(r, user.id)));
  }

  async get(user: AuthUser, id: bigint) {
    const row = await this.prisma.conversation.findUnique({
      where: { id },
      include: conversationInclude,
    });
    if (!row || (row.ownerId !== user.id && row.clientId !== user.id)) {
      throw new NotFoundException('Conversation not found');
    }
    return this.toView(row, user.id);
  }

  /** Paged history, returned oldest → newest. Use `before` to load older pages. */
  async messages(user: AuthUser, id: bigint, q: MessagesQueryDto) {
    await this.getParticipant(user, id);
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId: id,
        ...(q.before ? { id: { lt: BigInt(q.before) } } : {}),
      },
      orderBy: { id: 'desc' },
      take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    return { items: rows.slice(0, q.limit).reverse(), hasMore };
  }

  async send(user: AuthUser, id: bigint, body: string) {
    const conv = await this.getParticipant(user, id);
    const isOwner = conv.ownerId === user.id;
    const recipientId = isOwner ? conv.clientId : conv.ownerId;

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: { conversationId: id, senderId: user.id, body },
      });
      await tx.conversation.update({
        where: { id },
        data: {
          lastMessageAt: message.createdAt,
          // sending implies I've read everything up to now
          ...(isOwner
            ? { ownerLastReadAt: message.createdAt }
            : { clientLastReadAt: message.createdAt }),
        },
      });

      // One unread NEW_MESSAGE notification per conversation is enough.
      const pending = await tx.notification.count({
        where: {
          userId: recipientId,
          type: NotificationType.NEW_MESSAGE,
          readAt: null,
          data: { path: ['conversationId'], equals: Number(id) },
        },
      });
      if (!pending) {
        const sender = await tx.user.findUniqueOrThrow({
          where: { id: user.id },
          select: { fullName: true },
        });
        await this.notifications.create(
          {
            userId: recipientId,
            type: NotificationType.NEW_MESSAGE,
            title: 'Шинэ мессеж',
            body: `${sender.fullName}: ${body.slice(0, 200)}`,
            data: { conversationId: id, listingId: conv.listingId },
          },
          tx,
        );
      }
      return message;
    });
  }

  async markRead(user: AuthUser, id: bigint) {
    const conv = await this.getParticipant(user, id);
    const now = new Date();
    await this.prisma.conversation.update({
      where: { id },
      data:
        conv.ownerId === user.id
          ? { ownerLastReadAt: now }
          : { clientLastReadAt: now },
    });
    return { ok: true };
  }

  // ---------------------------------------------------------------- helpers

  private async getParticipant(user: AuthUser, id: bigint) {
    const conv = await this.prisma.conversation.findUnique({ where: { id } });
    if (!conv || (conv.ownerId !== user.id && conv.clientId !== user.id)) {
      throw new NotFoundException('Conversation not found');
    }
    return conv;
  }

  /** Shape for the client: "the other person", last message, unread count. */
  private async toView(row: ConversationRow, me: bigint) {
    const isOwner = row.ownerId === me;
    const lastReadAt = isOwner ? row.ownerLastReadAt : row.clientLastReadAt;
    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: row.id,
        senderId: { not: me },
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      },
    });
    const { photos, ...listing } = row.listing;
    return {
      id: row.id,
      listing: { ...listing, coverUrl: photos[0]?.url ?? null },
      myRole: isOwner ? 'OWNER' : 'CLIENT',
      otherUser: isOwner ? row.client : row.owner,
      lastMessage: row.messages[0] ?? null,
      lastMessageAt: row.lastMessageAt,
      unreadCount,
      createdAt: row.createdAt,
    };
  }
}
