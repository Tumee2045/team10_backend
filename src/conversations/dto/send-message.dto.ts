import { Text, Trim } from '../../common/dto/validators';

export class SendMessageDto {
  /** @example "Сайн байна уу, байр одоо сул байгаа юу?" */
  @Trim()
  @Text(1, 2000)
  body!: string;
}
