import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/http/response-message.decorator';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { MyListingsQueryDto } from './dto/my-listings-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingSearchService } from './listing-search.service';
import { ListingsService } from './listings.service';
import { Action, IdParam } from '../common/http/route.decorators';

@ApiTags('listings')
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
  findOne(@IdParam() id: bigint, @CurrentUser() user?: AuthUser) {
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
    @IdParam() id: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listings.update(id, user, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Owner or ADMIN' })
  @ResponseMessage('Listing deleted')
  remove(@IdParam() id: bigint, @CurrentUser() user: AuthUser) {
    return this.listings.remove(id, user);
  }

  // ---------------------------------------------------------------- status

  @Post(':id/publish')
  @Action('Listing published')
  @ApiOperation({ summary: 'DRAFT / INACTIVE / RENTED → ACTIVE' })
  publish(@IdParam() id: bigint, @CurrentUser() user: AuthUser) {
    return this.listings.publish(id, user);
  }

  @Post(':id/deactivate')
  @Action('Listing deactivated')
  @ApiOperation({ summary: 'ACTIVE → INACTIVE (owner or ADMIN)' })
  deactivate(@IdParam() id: bigint, @CurrentUser() user: AuthUser) {
    return this.listings.deactivate(id, user);
  }

  @Post(':id/mark-rented')
  @Action('Listing marked as rented')
  @ApiOperation({ summary: 'RENT listing → RENTED' })
  markAsRented(@IdParam() id: bigint, @CurrentUser() user: AuthUser) {
    return this.listings.markAsRented(id, user);
  }

  @Post(':id/mark-sold')
  @Action('Listing marked as sold')
  @ApiOperation({ summary: 'SALE listing → SOLD' })
  markAsSold(@IdParam() id: bigint, @CurrentUser() user: AuthUser) {
    return this.listings.markAsSold(id, user);
  }
}
