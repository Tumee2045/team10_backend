import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
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
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllAsRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseBigIntPipe) id: bigint,
  ) {
    return this.notifications.markAsRead(user.id, id);
  }
}
