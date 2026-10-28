import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateListingDto } from './create-listing.dto';

/**
 * The listing type (RENT/SALE) can't change after creation; create a new listing instead.
 * Status changes go through PATCH /listings/:id/status.
 */
export class UpdateListingDto extends PartialType(
  OmitType(CreateListingDto, ['listingType', 'publish'] as const),
) {}
