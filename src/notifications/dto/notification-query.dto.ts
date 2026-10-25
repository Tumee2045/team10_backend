import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { QueryBoolean } from '../../common/dto/validators';

export class NotificationQueryDto extends PaginationQueryDto {
  /** Only unread notifications. */
  @QueryBoolean()
  unreadOnly?: boolean;
}
