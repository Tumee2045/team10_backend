import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';
import { Action, IdParam } from '../common/http/route.decorators';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: NotificationQueryDto) {
    return this.notifications.findAll(user.id, query);
  }

  @Get('unread-count')
  countUnread(@CurrentUser() user: AuthUser) {
    return this.notifications.countUnread(user.id);
  }

  @Post('read-all')
  @Action('All notifications marked as read')
  markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllAsRead(user.id);
  }

  @Post(':id/read')
  @Action('Marked as read')
  markAsRead(@CurrentUser() user: AuthUser, @IdParam() id: bigint) {
    return this.notifications.markAsRead(user.id, id);
  }
}
