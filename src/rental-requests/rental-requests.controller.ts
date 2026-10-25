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
import {
  CreateRentalRequestDto,
  RejectRentalRequestDto,
  RentalRequestQueryDto,
} from './dto/rental-request.dto';
import { RentalRequestsService } from './rental-requests.service';

@ApiTags('rental-requests')
@ApiBearerAuth()
@Controller('rental-requests')
export class RentalRequestsController {
  constructor(private readonly requests: RentalRequestsService) {}

  @Post()
  @ApiOperation({
    summary: '201 Created, 409 if duplicate PENDING or listing not ACTIVE',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRentalRequestDto) {
    return this.requests.create(user, dto);
  }

  @Get('sent')
  @ApiOperation({ summary: 'Requests I sent (as renter)' })
  sent(@CurrentUser() user: AuthUser, @Query() q: RentalRequestQueryDto) {
    return this.requests.sent(user.id, q);
  }

  @Get('received')
  @ApiOperation({ summary: 'Requests on my listings (as owner)' })
  received(@CurrentUser() user: AuthUser, @Query() q: RentalRequestQueryDto) {
    return this.requests.received(user.id, q);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requests.findOne(id, user);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requests.approve(id, user);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: RejectRentalRequestDto,
  ) {
    return this.requests.reject(id, user, dto.reason);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requests.cancel(id, user);
  }
}
