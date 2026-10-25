import { Module } from '@nestjs/common';
import { ListingPhotosController } from './listing-photos.controller';
import { ListingPhotosService } from './listing-photos.service';
import { ListingSearchService } from './listing-search.service';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  controllers: [ListingsController, ListingPhotosController],
  providers: [ListingsService, ListingSearchService, ListingPhotosService],
  exports: [ListingSearchService],
})
export class ListingsModule {}
