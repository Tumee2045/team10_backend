import { Email, Text } from '../../common/dto/validators';

export class LoginDto {
  /** @example bat@example.com */
  @Email()
  email!: string;

  /** @example secret123 */
  @Text(1, 72)
  password!: string;
}
