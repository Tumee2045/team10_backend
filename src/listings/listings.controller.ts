import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ImageFilesPipe } from '../common/pipes/image-files.pipe';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { MyListingsQueryDto } from './dto/my-listings-query.dto';
import { ReorderPhotosDto } from './dto/reorder-photos.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import {
  ListingPhotosService,
  MAX_PHOTOS_PER_LISTING,
} from './listing-photos.service';
import { ListingsService } from './listings.service';

@ApiTags('listings')
@ApiBearerAuth()
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly photos: ListingPhotosService,
  ) {}

  // ---------------------------------------------------------------- read

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Search ACTIVE listings (filters, text, bbox, sort, paging)',
  })
  search(@Query() q: ListingQueryDto, @CurrentUser() user?: AuthUser) {
    return this.listings.search(q, user);
  }

  @Public()
  @Get('map')
  @ApiOperation({
    summary: 'Lightweight map markers (max 500) for the same filters',
  })
  map(@Query() q: ListingQueryDto) {
    return this.listings.mapPoints(q);
  }

  @Get('mine')
  @ApiOperation({ summary: 'My listings in any status' })
  mine(@CurrentUser() user: AuthUser, @Query() q: MyListingsQueryDto) {
    return this.listings.mine(user.id, q);
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
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateListingDto) {
    return this.listings.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listings.update(id, user, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete listing (owner or ADMIN)' })
  remove(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.remove(id, user);
  }

  // ---------------------------------------------------------------- status

  @Post(':id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'DRAFT/INACTIVE/RENTED → ACTIVE' })
  publish(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.changeStatus(id, user, 'publish');
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'ACTIVE → INACTIVE (owner or ADMIN)' })
  deactivate(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.changeStatus(id, user, 'deactivate');
  }

  @Post(':id/mark-rented')
  @HttpCode(200)
  @ApiOperation({ summary: 'RENT listing → RENTED' })
  markRented(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.changeStatus(id, user, 'markRented');
  }

  @Post(':id/mark-sold')
  @HttpCode(200)
  @ApiOperation({ summary: 'SALE listing → SOLD' })
  markSold(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.changeStatus(id, user, 'markSold');
  }

  // ---------------------------------------------------------------- photos

  @Post(':id/photos')
  @ApiOperation({
    summary: `Upload photos (field "files", up to ${MAX_PHOTOS_PER_LISTING} total)`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', MAX_PHOTOS_PER_LISTING))
  addPhotos(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
    @UploadedFiles(ImageFilesPipe) files: Express.Multer.File[],
  ) {
    return this.photos.add(id, user, files);
  }

  @Put(':id/photos/order')
  reorderPhotos(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderPhotosDto,
  ) {
    return this.photos.reorder(id, user, dto.photoIds);
  }

  @Delete(':id/photos/:photoId')
  removePhoto(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Param('photoId', ParseBigIntPipe) photoId: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.photos.remove(id, photoId, user);
  }
}
