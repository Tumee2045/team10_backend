import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, Length, ValidateNested } from 'class-validator';
import { SearchFiltersDto } from '../../listings/dto/search-filters.dto';

export class CreateSavedSearchDto {
  @ApiProperty({ example: 'Хан-Уул 2 өрөө' })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({ type: SearchFiltersDto })
  @ValidateNested()
  @Type(() => SearchFiltersDto)
  filters!: SearchFiltersDto;
}
