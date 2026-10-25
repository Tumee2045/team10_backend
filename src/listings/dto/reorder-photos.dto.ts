import { ArrayMinSize, IsInt } from 'class-validator';

export class ReorderPhotosDto {
  /** Every photo id of the listing, in the new order. The first one is the cover. */
  @IsInt({ each: true })
  @ArrayMinSize(1)
  photoIds!: number[];
}
