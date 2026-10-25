import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ListingType, PropertyType } from '@prisma/client';

const MAX_MNT = Number.MAX_SAFE_INTEGER;

export class CreateListingDto {
  @ApiProperty({ enum: ListingType })
  @IsEnum(ListingType)
  listingType!: ListingType;

  @ApiProperty({ enum: PropertyType })
  @IsEnum(PropertyType)
  propertyType!: PropertyType;

  @ApiProperty({ example: '2 өрөө байр, 13-р хороолол' })
  @IsString()
  @Length(3, 150)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  districtId!: number;

  // ---------------------------------------------------------------- price (MNT)
  @ApiPropertyOptional({ description: 'Required for RENT', example: 1500000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MNT)
  monthlyRent?: number;

  @ApiPropertyOptional({ description: 'RENT only' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MNT)
  deposit?: number;

  @ApiPropertyOptional({ description: 'RENT only' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  minMonths?: number;

  @ApiPropertyOptional({ description: 'RENT only: СӨХ, дулаан included' })
  @IsOptional()
  @IsBoolean()
  utilitiesIncluded?: boolean;

  @ApiPropertyOptional({ description: 'Required for SALE', example: 250000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MNT)
  salePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  priceNegotiable?: boolean;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  availableFrom?: string;

  // ---------------------------------------------------------------- property details
  @ApiProperty({ example: 56.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  areaM2!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  rooms?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  bathrooms?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(-5)
  @Max(200)
  floor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  totalFloors?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearBuilt?: number;

  // ---------------------------------------------------------------- location
  @ApiPropertyOptional({ example: '3-р хороо' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  khoroo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiProperty({ example: 47.918873 })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: 106.917701 })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ type: [Number], example: [1, 3] })
  @IsOptional()
  @IsInt({ each: true })
  @ArrayMaxSize(30)
  amenityIds?: number[];

  @ApiPropertyOptional({
    description: 'true → ACTIVE right away, otherwise DRAFT',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
