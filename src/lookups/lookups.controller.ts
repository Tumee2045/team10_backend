import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/** Read-only reference data for dropdowns/filters. Seeded by prisma/seed.ts. */
@ApiTags('lookups')
@Public()
@Controller()
export class LookupsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('districts')
  districts() {
    return this.prisma.district.findMany({ orderBy: { id: 'asc' } });
  }

  @Get('amenities')
  amenities() {
    return this.prisma.amenity.findMany({ orderBy: { id: 'asc' } });
  }
}
