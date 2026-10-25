import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { ConversationsService } from './conversations.service';
import {
  MessagesQueryDto,
  SendMessageDto,
  StartConversationDto,
} from './dto/conversation.dto';

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Open (or get existing) chat with a listing owner' })
  start(@CurrentUser() user: AuthUser, @Body() dto: StartConversationDto) {
    return this.conversations.start(user, BigInt(dto.listingId));
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.conversations.list(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.conversations.get(user, id);
  }

  @Get(':id/messages')
  messages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Query() q: MessagesQueryDto,
  ) {
    return this.conversations.messages(user, id, q);
  }

  @Post(':id/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: SendMessageDto,
  ) {
    return this.conversations.send(user, id, dto.body);
  }

  @Post(':id/read')
  @HttpCode(200)
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseBigIntPipe) id: bigint,
  ) {
    return this.conversations.markRead(user, id);
  }
}
