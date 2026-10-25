import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRentalRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  listingId!: number;

  @ApiProperty({
    example: '2026-11-01',
    description: 'YYYY-MM-DD, today or later',
  })
  @IsDateString({ strict: true })
  startDate!: string;

  @ApiProperty({ example: 6 })
  @IsInt()
  @Min(1)
  @Max(120)
  months!: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
