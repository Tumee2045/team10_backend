import { ListingStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { OptionalEnum } from '../../common/dto/validators';

export class MyListingsQueryDto extends PaginationQueryDto {
  @OptionalEnum(ListingStatus)
  status?: ListingStatus;
}
