import { OptionalText } from '../../common/dto/validators';

export class RejectRentalRequestDto {
  @OptionalText(500)
  reason?: string;
}
