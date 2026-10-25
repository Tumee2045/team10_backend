import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { LookupsService } from './lookups.service';

@ApiTags('lookups')
@Public()
@Controller()
export class LookupsController {
  constructor(private readonly lookups: LookupsService) {}

  @Get('districts')
  districts() {
    return this.lookups.districts();
  }

  @Get('amenities')
  amenities() {
    return this.lookups.amenities();
  }
}
