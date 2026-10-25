import { IsDateString } from 'class-validator';
import { Int, OptionalText } from '../../common/dto/validators';

export class CreateRentalRequestDto {
  /** @example 1 */
  @Int({ min: 1 })
  listingId!: number;

  /** YYYY-MM-DD, today or later. @example "2026-11-01" */
  @IsDateString({ strict: true })
  startDate!: string;

  /** @example 6 */
  @Int({ min: 1, max: 120 })
  months!: number;

  @OptionalText(1000)
  note?: string;
}
