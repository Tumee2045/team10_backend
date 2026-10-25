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
import { CreateRentalRequestDto } from './dto/create-rental-request.dto';
import { RejectRentalRequestDto } from './dto/reject-rental-request.dto';
import { RentalRequestQueryDto } from './dto/rental-request-query.dto';
import { RentalRequestsService } from './rental-requests.service';

@ApiTags('rental-requests')
@ApiBearerAuth()
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
  findOne(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requests.findOne(id, user);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Rental request approved')
  approve(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requests.approve(id, user);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Rental request rejected')
  reject(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: RejectRentalRequestDto,
  ) {
    return this.requests.reject(id, user, dto.reason);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Rental request cancelled')
  cancel(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requests.cancel(id, user);
  }
}
