import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/http/response-message.decorator';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { ConversationsService } from './conversations.service';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { StartConversationDto } from './dto/start-conversation.dto';

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
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
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseBigIntPipe) id: bigint,
  ) {
    return this.conversations.findOne(user, id);
  }

  @Get(':id/messages')
  findMessages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Query() query: MessagesQueryDto,
  ) {
    return this.conversations.findMessages(user, id, query);
  }

  @Post(':id/messages')
  @ResponseMessage('Message sent')
  sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: SendMessageDto,
  ) {
    return this.conversations.sendMessage(user, id, dto.body);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseBigIntPipe) id: bigint,
  ) {
    return this.conversations.markAsRead(user, id);
  }
}
