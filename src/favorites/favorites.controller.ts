import { Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ResponseMessage } from '../common/http/response-message.decorator';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.favorites.findAll(user.id, query);
  }

  @Put(':listingId')
  @ResponseMessage('Added to favorites')
  add(
    @CurrentUser() user: AuthUser,
    @Param('listingId', ParseBigIntPipe) listingId: bigint,
  ) {
    return this.favorites.add(user.id, listingId);
  }

  @Delete(':listingId')
  @ResponseMessage('Removed from favorites')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('listingId', ParseBigIntPipe) listingId: bigint,
  ) {
    return this.favorites.remove(user.id, listingId);
  }
}
