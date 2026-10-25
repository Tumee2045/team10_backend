import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Conversation,
  ListingStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEvent } from '../realtime/realtime.events';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  coverPhotoSelect,
  userBriefSelect,
  withCoverUrl,
} from '../prisma/selects';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { StartConversationDto } from './dto/start-conversation.dto';

const conversationInclude = {
  listing: {
    select: { id: true, title: true, status: true, photos: coverPhotoSelect },
  },
  owner: { select: userBriefSelect },
  client: { select: userBriefSelect },
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
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Opens a chat with the listing owner, or returns the existing one. */
  async start(user: AuthUser, dto: StartConversationDto) {
    const listingId = BigInt(dto.listingId);
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
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

  /** My chats (as owner or client), most recent activity first. */
  async findAll(user: AuthUser) {
    const rows = await this.prisma.conversation.findMany({
      where: { OR: [{ ownerId: user.id }, { clientId: user.id }] },
      include: conversationInclude,
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });
    return Promise.all(rows.map((row) => this.toView(row, user.id)));
  }

  async findOne(user: AuthUser, id: bigint) {
    const row = await this.prisma.conversation.findUnique({
      where: { id },
      include: conversationInclude,
    });
    if (!row || !isParticipant(row, user.id)) {
      throw new NotFoundException('Conversation not found');
    }
    return this.toView(row, user.id);
  }

  /** History oldest → newest. Pass `before` (a message id) to load older pages. */
  async findMessages(user: AuthUser, id: bigint, query: MessagesQueryDto) {
    await this.findParticipating(user, id);
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId: id,
        id: query.before ? { lt: BigInt(query.before) } : undefined,
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1, // one extra row tells us if there are more
    });

    const hasMore = rows.length > query.limit;
    return { items: rows.slice(0, query.limit).reverse(), hasMore };
  }

  async sendMessage(user: AuthUser, id: bigint, body: string) {
    const conversation = await this.findParticipating(user, id);
    const isOwner = conversation.ownerId === user.id;

    const [message, notification] = await this.prisma.$transaction(
      async (tx) => {
        const message = await tx.message.create({
          data: { conversationId: id, senderId: user.id, body },
        });
        // Sending a message also means I've read everything before it.
        await tx.conversation.update({
          where: { id },
          data: {
            lastMessageAt: message.createdAt,
            ...(isOwner
              ? { ownerLastReadAt: message.createdAt }
              : { clientLastReadAt: message.createdAt }),
          },
        });
        const notification = await this.notifyRecipient(
          tx,
          conversation,
          user.id,
          body,
        );
        return [message, notification] as const;
      },
    );

    // Both sides get the message live (the sender too, for their other tabs).
    this.realtime.emitToUsers(
      [conversation.ownerId, conversation.clientId],
      RealtimeEvent.MESSAGE_NEW,
      { conversationId: id, message },
    );
    if (notification) this.notifications.publish(notification);
    return message;
  }

  async markAsRead(user: AuthUser, id: bigint): Promise<void> {
    const conversation = await this.findParticipating(user, id);
    const isOwner = conversation.ownerId === user.id;
    const readAt = new Date();
    await this.prisma.conversation.update({
      where: { id },
      data: isOwner
        ? { ownerLastReadAt: readAt }
        : { clientLastReadAt: readAt },
    });

    // Lets the other person show "seen".
    const otherId = isOwner ? conversation.clientId : conversation.ownerId;
    this.realtime.emitToUser(otherId, RealtimeEvent.CONVERSATION_READ, {
      conversationId: id,
      userId: user.id,
      readAt,
    });
  }

  // ---------------------------------------------------------------- private

  private async findParticipating(user: AuthUser, id: bigint) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
    });
    if (!conversation || !isParticipant(conversation, user.id)) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  /**
   * At most one unread NEW_MESSAGE notification per conversation, so a chat doesn't spam.
   * Returns the new notification (to publish after commit) or null.
   */
  private async notifyRecipient(
    tx: Pick<PrismaService, 'notification' | 'user'>,
    conversation: Conversation,
    senderId: bigint,
    body: string,
  ) {
    const recipientId =
      conversation.ownerId === senderId
        ? conversation.clientId
        : conversation.ownerId;

    const alreadyNotified = await tx.notification.count({
      where: {
        userId: recipientId,
        type: NotificationType.NEW_MESSAGE,
        readAt: null,
        data: { path: ['conversationId'], equals: Number(conversation.id) },
      },
    });
    if (alreadyNotified) return null;

    const sender = await tx.user.findUniqueOrThrow({
      where: { id: senderId },
      select: { fullName: true },
    });
    return this.notifications.create(
      {
        userId: recipientId,
        type: NotificationType.NEW_MESSAGE,
        title: 'Шинэ мессеж',
        body: `${sender.fullName}: ${body.slice(0, 200)}`,
        data: {
          conversationId: conversation.id,
          listingId: conversation.listingId,
        },
      },
      tx,
    );
  }

  /** Shape for the client: the other person, last message and unread count. */
  private async toView(row: ConversationRow, myId: bigint) {
    const isOwner = row.ownerId === myId;
    const lastReadAt = isOwner ? row.ownerLastReadAt : row.clientLastReadAt;
    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: row.id,
        senderId: { not: myId },
        createdAt: lastReadAt ? { gt: lastReadAt } : undefined,
      },
    });

    return {
      id: row.id,
      listing: withCoverUrl(row.listing),
      myRole: isOwner ? 'OWNER' : 'CLIENT',
      otherUser: isOwner ? row.client : row.owner,
      lastMessage: row.messages[0] ?? null,
      lastMessageAt: row.lastMessageAt,
      unreadCount,
      createdAt: row.createdAt,
    };
  }
}

function isParticipant(
  conversation: { ownerId: bigint; clientId: bigint },
  userId: bigint,
) {
  return conversation.ownerId === userId || conversation.clientId === userId;
}
