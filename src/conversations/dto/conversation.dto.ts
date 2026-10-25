import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class StartConversationDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  listingId!: number;
}

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

export class MessagesQueryDto {
  @ApiPropertyOptional({
    description: 'Load messages older than this message id',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  before?: number;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}
