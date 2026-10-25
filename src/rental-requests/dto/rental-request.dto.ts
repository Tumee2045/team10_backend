import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

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

export class RejectRentalRequestDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}

export class RentalRequestQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;
}
