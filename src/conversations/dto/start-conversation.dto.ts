import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class StartConversationDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  listingId!: number;
}
