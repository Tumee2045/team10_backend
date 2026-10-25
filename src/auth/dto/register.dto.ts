import { Email, OptionalPhone, Text, Trim } from '../../common/dto/validators';

export class RegisterDto {
  /** @example bat@example.com */
  @Email()
  email!: string;

  /** 8–72 characters (bcrypt only uses the first 72 bytes). @example secret123 */
  @Text(8, 72)
  password!: string;

  /** @example "Бат Болд" */
  @Trim()
  @Text(2, 100)
  fullName!: string;

  /** @example "99112233" */
  @OptionalPhone()
  phone?: string;
}
