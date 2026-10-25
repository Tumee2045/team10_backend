import { BadRequestException } from '@nestjs/common';
import { Listing, ListingType } from '@prisma/client';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

/** Price fields as the API sends them (MNT as plain numbers). */
export interface PriceInput {
  listingType: ListingType;
  monthlyRent?: number;
  deposit?: number;
  minMonths?: number;
  utilitiesIncluded?: boolean;
  salePrice?: number;
}

/**
 * Price columns for the DB.
 * RENT needs monthlyRent, SALE needs salePrice (the DB has the same CHECK).
 * Fields that don't belong to the listing type are cleared.
 */
export function resolvePricing(input: PriceInput) {
  if (input.listingType === ListingType.RENT) {
    if (input.monthlyRent === undefined) {
      throw new BadRequestException(
        'monthlyRent is required for RENT listings',
      );
    }
    return {
      monthlyRent: BigInt(input.monthlyRent),
      deposit: toBigIntOrNull(input.deposit),
      minMonths: input.minMonths ?? null,
      utilitiesIncluded: input.utilitiesIncluded ?? false,
      salePrice: null,
    };
  }

  if (input.salePrice === undefined) {
    throw new BadRequestException('salePrice is required for SALE listings');
  }
  return {
    monthlyRent: null,
    deposit: null,
    minMonths: null,
    utilitiesIncluded: false,
    salePrice: BigInt(input.salePrice),
  };
}

/** For updates: the new value if sent, otherwise what the listing already has. */
export function mergePricing(
  current: Listing,
  dto: UpdateListingDto,
): PriceInput {
  return {
    listingType: dto.listingType ?? current.listingType,
    monthlyRent: dto.monthlyRent ?? toNumberOrUndefined(current.monthlyRent),
    deposit: dto.deposit ?? toNumberOrUndefined(current.deposit),
    minMonths: dto.minMonths ?? current.minMonths ?? undefined,
    utilitiesIncluded: dto.utilitiesIncluded ?? current.utilitiesIncluded,
    salePrice: dto.salePrice ?? toNumberOrUndefined(current.salePrice),
  };
}

/** Non-price fields of the DTO, converted to DB types. */
export function toListingFields<T extends UpdateListingDto | CreateListingDto>(
  dto: T,
) {
  const {
    amenityIds,
    monthlyRent,
    deposit,
    minMonths,
    utilitiesIncluded,
    salePrice,
    availableFrom,
    ...fields
  } = dto;
  return {
    ...fields,
    availableFrom: availableFrom ? new Date(availableFrom) : undefined,
  };
}

function toBigIntOrNull(value?: number) {
  return value === undefined ? null : BigInt(value);
}

function toNumberOrUndefined(value: bigint | null) {
  return value === null ? undefined : Number(value);
}
