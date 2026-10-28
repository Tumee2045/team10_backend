import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/http/response-message.decorator';
import { IdParam } from '../common/http/route.decorators';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';
import { SavedSearchesService } from './saved-searches.service';

@ApiTags('saved-searches')
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

  @Delete(':id')
  @ResponseMessage('Saved search deleted')
  remove(@CurrentUser() user: AuthUser, @IdParam() id: bigint) {
    return this.savedSearches.remove(user.id, id);
  }
}
