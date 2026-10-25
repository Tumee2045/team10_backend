import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Put,
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
import { ResponseMessage } from '../common/http/response-message.decorator';
import { ImageFilesPipe } from '../common/pipes/image-files.pipe';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { ReorderPhotosDto } from './dto/reorder-photos.dto';
import {
  ListingPhotosService,
  MAX_PHOTOS_PER_LISTING,
} from './listing-photos.service';

@ApiTags('listings')
@ApiBearerAuth()
@Controller('listings/:listingId/photos')
export class ListingPhotosController {
  constructor(private readonly photos: ListingPhotosService) {}

  @Post()
  @ApiOperation({
    summary: `Upload photos (multipart field "files", max ${MAX_PHOTOS_PER_LISTING} per listing)`,
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
  @ResponseMessage('Photos uploaded')
  add(
    @Param('listingId', ParseBigIntPipe) listingId: bigint,
    @CurrentUser() user: AuthUser,
    @UploadedFiles(ImageFilesPipe) files: Express.Multer.File[],
  ) {
    return this.photos.add(listingId, user, files);
  }

  @Put('order')
  @ApiOperation({ summary: 'Reorder photos. The first one becomes the cover.' })
  @ResponseMessage('Photos reordered')
  reorder(
    @Param('listingId', ParseBigIntPipe) listingId: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderPhotosDto,
  ) {
    return this.photos.reorder(listingId, user, dto.photoIds);
  }

  @Delete(':photoId')
  @ResponseMessage('Photo deleted')
  remove(
    @Param('listingId', ParseBigIntPipe) listingId: bigint,
    @Param('photoId', ParseBigIntPipe) photoId: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.photos.remove(listingId, photoId, user);
  }
}
