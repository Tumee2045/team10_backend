import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    maxLength: 2000,
    example: 'Сайн байна уу, байр одоо сул байгаа юу?',
  })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @Length(1, 2000)
  body!: string;
}
