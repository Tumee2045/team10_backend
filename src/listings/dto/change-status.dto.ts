import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { SETTABLE_STATUSES, type SettableStatus } from '../listing-status';

export class ChangeStatusDto {
  /** ACTIVE = publish · INACTIVE = hide · RENTED (RENT only) · SOLD (SALE only) */
  @ApiProperty({ enum: SETTABLE_STATUSES })
  @IsIn(SETTABLE_STATUSES)
  status!: SettableStatus;
}
