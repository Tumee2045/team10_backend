import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { OptionalText, QueryNumber } from '../../common/dto/validators';
import { SearchFiltersDto } from './search-filters.dto';

export const LISTING_SORTS = [
  'newest',
  'price_asc',
  'price_desc',
  'popular',
] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

export class ListingQueryDto extends IntersectionType(
  SearchFiltersDto,
  PaginationQueryDto,
) {
  /** Text search in title, address and description. */
  @OptionalText(100)
  q?: string;

  @QueryNumber({ min: 0 })
  minArea?: number;

  @QueryNumber({ min: 0 })
  maxArea?: number;

  // Map bounding box: send all four or none.
  @QueryNumber({ min: -90, max: 90 })
  minLat?: number;

  @QueryNumber({ min: -90, max: 90 })
  maxLat?: number;

  @QueryNumber({ min: -180, max: 180 })
  minLng?: number;

  @QueryNumber({ min: -180, max: 180 })
  maxLng?: number;

  @ApiProperty({ enum: LISTING_SORTS, required: false })
  @IsOptional()
  @IsIn(LISTING_SORTS)
  sort: ListingSort = 'newest';
}
