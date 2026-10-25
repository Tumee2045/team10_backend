import { Text } from '../../common/dto/validators';

export class ChangePasswordDto {
  @Text(1, 72)
  currentPassword!: string;

  @Text(8, 72)
  newPassword!: string;
}
