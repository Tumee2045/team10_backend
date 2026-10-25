import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/http/response-message.decorator';
import { CreateRentalRequestDto } from './dto/create-rental-request.dto';
import { RejectRentalRequestDto } from './dto/reject-rental-request.dto';
import { RentalRequestQueryDto } from './dto/rental-request-query.dto';
import { RentalRequestsService } from './rental-requests.service';
import { Action, IdParam } from '../common/http/route.decorators';

@ApiTags('rental-requests')
@Controller('rental-requests')
export class RentalRequestsController {
  constructor(private readonly requests: RentalRequestsService) {}

  @Post()
  @ApiOperation({
    summary:
      '409 if you already have a PENDING request or the listing is not ACTIVE',
  })
  @ResponseMessage('Rental request sent')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRentalRequestDto) {
    return this.requests.create(user, dto);
  }

  @Get('sent')
  @ApiOperation({ summary: 'Requests I sent as a renter (paged)' })
  findSent(
    @CurrentUser() user: AuthUser,
    @Query() query: RentalRequestQueryDto,
  ) {
    return this.requests.findSent(user.id, query);
  }

  @Get('received')
  @ApiOperation({ summary: 'Requests on my listings (paged)' })
  findReceived(
    @CurrentUser() user: AuthUser,
    @Query() query: RentalRequestQueryDto,
  ) {
    return this.requests.findReceived(user.id, query);
  }

  @Get(':id')
  findOne(@IdParam() id: bigint, @CurrentUser() user: AuthUser) {
    return this.requests.findOne(id, user);
  }

  @Post(':id/approve')
  @Action('Rental request approved')
  approve(@IdParam() id: bigint, @CurrentUser() user: AuthUser) {
    return this.requests.approve(id, user);
  }

  @Post(':id/reject')
  @Action('Rental request rejected')
  reject(
    @IdParam() id: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: RejectRentalRequestDto,
  ) {
    return this.requests.reject(id, user, dto.reason);
  }

  @Post(':id/cancel')
  @Action('Rental request cancelled')
  cancel(@IdParam() id: bigint, @CurrentUser() user: AuthUser) {
    return this.requests.cancel(id, user);
  }
}
