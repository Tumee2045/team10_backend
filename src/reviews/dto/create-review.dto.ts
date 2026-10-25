import { Int, OptionalText } from '../../common/dto/validators';

export class CreateReviewDto {
  /** An APPROVED rental request you are part of. @example 1 */
  @Int({ min: 1 })
  rentalRequestId!: number;

  /** @example 5 */
  @Int({ min: 1, max: 5 })
  rating!: number;

  @OptionalText(1000)
  comment?: string;
}
