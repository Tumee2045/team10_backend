import { QueryInt } from '../../common/dto/validators';

export class MessagesQueryDto {
  /** Load messages older than this message id. */
  @QueryInt({ min: 1 })
  before?: number;

  @QueryInt({ min: 1, max: 100 })
  limit: number = 50;
}
