import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ListingType, PropertyType } from '@prisma/client';
import { ToNumberArray } from '../../common/dto/query-transforms';

/**
 * The filters a user can save (saved_searches.filters jsonb) —
 * also the core of GET /listings query params.
 */
export class SearchFiltersDto {
  @ApiPropertyOptional({ enum: ListingType })
  @IsOptional()
  @IsEnum(ListingType)
  listingType?: ListingType;

  @ApiPropertyOptional({ enum: PropertyType })
  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Comma-separated: 1,3',
  })
  @IsOptional()
  @ToNumberArray()
  @IsInt({ each: true })
  @ArrayMaxSize(20)
  districtIds?: number[];

  @ApiPropertyOptional({
    description:
      'MNT. Monthly rent for RENT, sale price for SALE (both if listingType is omitted).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'MNT' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Minimum number of rooms' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  rooms?: number;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Listing must have ALL of these. Comma-separated: 1,2',
  })
  @IsOptional()
  @ToNumberArray()
  @IsInt({ each: true })
  @ArrayMaxSize(20)
  amenityIds?: number[];
}
