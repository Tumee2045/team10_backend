import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { instanceToPlain } from 'class-transformer';
import { SearchFiltersDto } from '../listings/dto/search-filters.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';

/**
 * Use case: Хайлтын шүүлтүүр хадгалах.
 * Only stores named filter sets; the frontend runs them through GET /listings.
 */
@Injectable()
export class SavedSearchesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: bigint) {
    return this.prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(userId: bigint, dto: CreateSavedSearchDto) {
    return this.prisma.savedSearch.create({
      data: { userId, name: dto.name, filters: toJson(dto.filters) },
    });
  }

  async remove(userId: bigint, id: bigint): Promise<void> {
    const { count } = await this.prisma.savedSearch.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException('Saved search not found');
  }
}

/** DTO → plain JSON without undefined keys, so the stored jsonb stays clean. */
function toJson(filters: SearchFiltersDto) {
  return JSON.parse(
    JSON.stringify(instanceToPlain(filters)),
  ) as Prisma.InputJsonObject;
}
