import { RequestStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { OptionalEnum } from '../../common/dto/validators';

export class RentalRequestQueryDto extends PaginationQueryDto {
  @OptionalEnum(RequestStatus)
  status?: RequestStatus;
}
