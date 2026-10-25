import { ListingType, PropertyType } from '@prisma/client';
import {
  OptionalEnum,
  QueryInt,
  QueryIntArray,
} from '../../common/dto/validators';

/**
 * Filters a user can save (saved_searches.filters jsonb).
 * Also the core of the GET /listings query params.
 */
export class SearchFiltersDto {
  @OptionalEnum(ListingType)
  listingType?: ListingType;

  @OptionalEnum(PropertyType)
  propertyType?: PropertyType;

  @QueryIntArray()
  districtIds?: number[];

  /** MNT. Monthly rent for RENT, sale price for SALE (both if listingType is omitted). */
  @QueryInt({ min: 0 })
  minPrice?: number;

  /** MNT. */
  @QueryInt({ min: 0 })
  maxPrice?: number;

  /** Minimum number of rooms. */
  @QueryInt({ min: 0, max: 50 })
  rooms?: number;

  /** The listing must have ALL of these. */
  @QueryIntArray()
  amenityIds?: number[];
}
