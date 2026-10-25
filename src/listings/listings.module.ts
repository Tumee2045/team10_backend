import { Module } from '@nestjs/common';
import { ListingPhotosService } from './listing-photos.service';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  controllers: [ListingsController],
  providers: [ListingsService, ListingPhotosService],
  exports: [ListingsService],
})
export class ListingsModule {}
