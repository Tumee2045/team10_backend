import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/http/response-message.decorator';
import { ConversationsService } from './conversations.service';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import { Action, IdParam } from '../common/http/route.decorators';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  @Action('Conversation opened')
  @ApiOperation({
    summary: 'Open (or get the existing) chat with a listing owner',
  })
  start(@CurrentUser() user: AuthUser, @Body() dto: StartConversationDto) {
    return this.conversations.start(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.conversations.findAll(user);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Conversation + message history (use ?before=<messageId> for older)',
  })
  findOne(
    @CurrentUser() user: AuthUser,
    @IdParam() id: bigint,
    @Query() query: MessagesQueryDto,
  ) {
    return this.conversations.findOne(user, id, query);
  }

  @Post(':id/messages')
  @ResponseMessage('Message sent')
  sendMessage(
    @CurrentUser() user: AuthUser,
    @IdParam() id: bigint,
    @Body() dto: SendMessageDto,
  ) {
    return this.conversations.sendMessage(user, id, dto.body);
  }

  @Post(':id/read')
  @Action('Marked as read')
  markAsRead(@CurrentUser() user: AuthUser, @IdParam() id: bigint) {
    return this.conversations.markAsRead(user, id);
  }
}
