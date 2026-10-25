import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateListingDto } from './create-listing.dto';

/** Status changes go through the dedicated endpoints (publish, deactivate…). */
export class UpdateListingDto extends PartialType(
  OmitType(CreateListingDto, ['publish'] as const),
) {}
