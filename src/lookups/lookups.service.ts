import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Reference data for dropdowns and filters. Seeded by prisma/seed.ts. */
@Injectable()
export class LookupsService {
  constructor(private readonly prisma: PrismaService) {}

  districts() {
    return this.prisma.district.findMany({ orderBy: { id: 'asc' } });
  }

  amenities() {
    return this.prisma.amenity.findMany({ orderBy: { id: 'asc' } });
  }
}
