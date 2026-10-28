import { BadRequestException } from '@nestjs/common';
import { ListingType } from '@prisma/client';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

type PriceFields = Pick<
  CreateListingDto,
  'monthlyRent' | 'deposit' | 'minMonths' | 'utilitiesIncluded' | 'salePrice'
>;

/** RENT needs monthlyRent, SALE needs salePrice (the DB has the same CHECK). */
export function assertPriceFor(type: ListingType, dto: PriceFields) {
  if (type === ListingType.RENT && dto.monthlyRent === undefined) {
    throw new BadRequestException('monthlyRent is required for RENT listings');
  }
  if (type === ListingType.SALE && dto.salePrice === undefined) {
    throw new BadRequestException('salePrice is required for SALE listings');
  }
}

/**
 * Only the price columns that belong to the listing type; the others are ignored.
 * Undefined values are skipped by Prisma, so on update they mean "unchanged".
 */
export function priceColumns(type: ListingType, dto: PriceFields) {
  if (type === ListingType.RENT) {
    return {
      monthlyRent: toBigInt(dto.monthlyRent),
      deposit: toBigInt(dto.deposit),
      minMonths: dto.minMonths,
      utilitiesIncluded: dto.utilitiesIncluded,
    };
  }
  return { salePrice: toBigInt(dto.salePrice) };
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

function toBigInt(value?: number) {
  return value === undefined ? undefined : BigInt(value);
}
