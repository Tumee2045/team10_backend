import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
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
  @ApiPropertyOptional({
    description: 'Text search in title/address/description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minArea?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxArea?: number;

  // Map bounding box — send all four or none.
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  minLat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  maxLat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  minLng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  maxLng?: number;

  @ApiPropertyOptional({ enum: LISTING_SORTS, default: 'newest' })
  @IsOptional()
  @IsIn(LISTING_SORTS)
  sort: ListingSort = 'newest';
}
