import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ResponseMessage } from '../common/http/response-message.decorator';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';
import { UpdateSavedSearchDto } from './dto/update-saved-search.dto';
import { SavedSearchesService } from './saved-searches.service';

@ApiTags('saved-searches')
@ApiBearerAuth()
@Controller('saved-searches')
export class SavedSearchesController {
  constructor(private readonly savedSearches: SavedSearchesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.savedSearches.findAll(user.id);
  }

  @Post()
  @ResponseMessage('Search saved')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSavedSearchDto) {
    return this.savedSearches.create(user.id, dto);
  }

  @Patch(':id')
  @ResponseMessage('Saved search updated')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateSavedSearchDto,
  ) {
    return this.savedSearches.update(user.id, id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Saved search deleted')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseBigIntPipe) id: bigint,
  ) {
    return this.savedSearches.remove(user.id, id);
  }

  @Get(':id/listings')
  @ApiOperation({ summary: 'Run the saved filters (paged ACTIVE listings)' })
  findListings(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Query() query: PaginationQueryDto,
  ) {
    return this.savedSearches.findListings(user, id, query);
  }
}
