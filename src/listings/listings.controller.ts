import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/http/response-message.decorator';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { MyListingsQueryDto } from './dto/my-listings-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingSearchService } from './listing-search.service';
import { ListingsService } from './listings.service';

@ApiTags('listings')
@ApiBearerAuth()
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly search: ListingSearchService,
  ) {}

  // ---------------------------------------------------------------- read

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search ACTIVE listings (paged)' })
  findAll(@Query() query: ListingQueryDto, @CurrentUser() user?: AuthUser) {
    return this.search.search(query, user);
  }

  @Public()
  @Get('map')
  @ApiOperation({ summary: 'Map markers for the same filters (max 500)' })
  findMapPoints(@Query() query: ListingQueryDto) {
    return this.search.mapPoints(query);
  }

  @Get('mine')
  @ApiOperation({ summary: 'My listings in any status (paged)' })
  findMine(@CurrentUser() user: AuthUser, @Query() query: MyListingsQueryDto) {
    return this.listings.findMine(user.id, query);
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.listings.findOne(id, user);
  }

  // ---------------------------------------------------------------- write

  @Post()
  @ResponseMessage('Listing created')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateListingDto) {
    return this.listings.create(user.id, dto);
  }

  @Patch(':id')
  @ResponseMessage('Listing updated')
  update(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listings.update(id, user, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Owner or ADMIN' })
  @ResponseMessage('Listing deleted')
  remove(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.remove(id, user);
  }

  // ---------------------------------------------------------------- status

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'DRAFT / INACTIVE / RENTED → ACTIVE' })
  @ResponseMessage('Listing published')
  publish(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.publish(id, user);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ACTIVE → INACTIVE (owner or ADMIN)' })
  @ResponseMessage('Listing deactivated')
  deactivate(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.deactivate(id, user);
  }

  @Post(':id/mark-rented')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'RENT listing → RENTED' })
  @ResponseMessage('Listing marked as rented')
  markAsRented(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.markAsRented(id, user);
  }

  @Post(':id/mark-sold')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SALE listing → SOLD' })
  @ResponseMessage('Listing marked as sold')
  markAsSold(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.markAsSold(id, user);
  }
}
