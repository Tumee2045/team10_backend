import { IsOptional } from 'class-validator';
import {
  OptionalPhone,
  OptionalText,
  Text,
  Trim,
} from '../../common/dto/validators';

export class UpdateProfileDto {
  @IsOptional()
  @Trim()
  @Text(2, 100)
  fullName?: string;

  /** @example "99112233" */
  @OptionalPhone()
  phone?: string;

  @OptionalText(500)
  bio?: string;
}
