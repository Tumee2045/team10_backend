import { Int } from '../../common/dto/validators';

export class StartConversationDto {
  /** @example 1 */
  @Int({ min: 1 })
  listingId!: number;
}
