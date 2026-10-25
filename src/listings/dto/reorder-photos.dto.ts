import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsInt } from 'class-validator';

export class ReorderPhotosDto {
  @ApiProperty({
    type: [Number],
    description:
      'All photo ids of the listing in the new order. First = cover.',
  })
  @IsInt({ each: true })
  @ArrayMinSize(1)
  photoIds!: number[];
}
