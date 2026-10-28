import {
  Controller,
  Delete,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/http/response-message.decorator';
import { ImageFilesPipe } from '../common/pipes/image-files.pipe';
import {
  ListingPhotosService,
  MAX_PHOTOS_PER_LISTING,
} from './listing-photos.service';
import { IdParam } from '../common/http/route.decorators';

@ApiTags('listings')
@Controller('listings/:listingId/photos')
export class ListingPhotosController {
  constructor(private readonly photos: ListingPhotosService) {}

  @Post()
  @ApiOperation({
    summary: `Upload photos (multipart field "files", max ${MAX_PHOTOS_PER_LISTING} per listing). The first photo is the cover.`,
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
    @IdParam('listingId') listingId: bigint,
    @CurrentUser() user: AuthUser,
    @UploadedFiles(ImageFilesPipe) files: Express.Multer.File[],
  ) {
    return this.photos.add(listingId, user, files);
  }

  @Delete(':photoId')
  @ResponseMessage('Photo deleted')
  remove(
    @IdParam('listingId') listingId: bigint,
    @IdParam('photoId') photoId: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.photos.remove(listingId, photoId, user);
  }
}
