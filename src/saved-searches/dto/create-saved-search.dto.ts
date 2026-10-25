import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Text } from '../../common/dto/validators';
import { SearchFiltersDto } from '../../listings/dto/search-filters.dto';

export class CreateSavedSearchDto {
  /** @example "Хан-Уул 2 өрөө" */
  @Text(1, 100)
  name!: string;

  @ValidateNested()
  @Type(() => SearchFiltersDto)
  filters!: SearchFiltersDto;
}
