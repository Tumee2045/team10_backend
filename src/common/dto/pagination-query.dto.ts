import { QueryInt } from './validators';

export class PaginationQueryDto {
  @QueryInt({ min: 1 })
  page: number = 1;

  /** Max 50. */
  @QueryInt({ min: 1, max: 50 })
  limit: number = 20;
}
