import { ListingType, PropertyType } from '@prisma/client';
import { ArrayMaxSize, IsDateString, IsInt, IsOptional } from 'class-validator';
import {
  Decimal,
  Enum,
  Int,
  OptionalBoolean,
  OptionalInt,
  OptionalText,
  Text,
} from '../../common/dto/validators';

const MAX_MNT = { min: 0, max: Number.MAX_SAFE_INTEGER };

export class CreateListingDto {
  @Enum(ListingType)
  listingType!: ListingType;

  @Enum(PropertyType)
  propertyType!: PropertyType;

  /** @example "2 өрөө байр, 13-р хороолол" */
  @Text(3, 150)
  title!: string;

  @OptionalText(5000)
  description?: string;

  /** @example 1 */
  @Int({ min: 1 })
  districtId!: number;

  /** Required for RENT. @example 1500000 */
  @OptionalInt(MAX_MNT)
  monthlyRent?: number;

  /** RENT only. */
  @OptionalInt(MAX_MNT)
  deposit?: number;

  /** RENT only. */
  @OptionalInt({ min: 1, max: 120 })
  minMonths?: number;

  /** RENT only: СӨХ, дулаан included. */
  @OptionalBoolean()
  utilitiesIncluded?: boolean;

  /** Required for SALE. @example 250000000 */
  @OptionalInt(MAX_MNT)
  salePrice?: number;

  @OptionalBoolean()
  priceNegotiable?: boolean;

  /** @example "2026-11-01" */
  @IsOptional()
  @IsDateString({ strict: true })
  availableFrom?: string;

  /** @example 56.5 */
  @Decimal(2, { min: 0.01, max: 999999.99 })
  areaM2!: number;

  @OptionalInt({ min: 0, max: 50 })
  rooms?: number;

  @OptionalInt({ min: 0, max: 50 })
  bathrooms?: number;

  @OptionalInt({ min: -5, max: 200 })
  floor?: number;

  @OptionalInt({ min: 1, max: 200 })
  totalFloors?: number;

  @OptionalInt({ min: 1900, max: 2100 })
  yearBuilt?: number;

  /** @example "3-р хороо" */
  @OptionalText(50)
  khoroo?: string;

  @OptionalText(255)
  address?: string;

  /** @example 47.918873 */
  @Decimal(6, { min: -90, max: 90 })
  latitude!: number;

  /** @example 106.917701 */
  @Decimal(6, { min: -180, max: 180 })
  longitude!: number;

  /** @example [1, 3] */
  @IsOptional()
  @IsInt({ each: true })
  @ArrayMaxSize(30)
  amenityIds?: number[];

  /** true → ACTIVE right away, otherwise DRAFT. */
  @OptionalBoolean()
  publish?: boolean;
}
