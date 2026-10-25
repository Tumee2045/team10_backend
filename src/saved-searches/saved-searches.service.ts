import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { instanceToPlain } from 'class-transformer';
import { AuthUser } from '../common/auth-user';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { SearchFiltersDto } from '../listings/dto/search-filters.dto';
import { ListingSearchService } from '../listings/listing-search.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';
import { UpdateSavedSearchDto } from './dto/update-saved-search.dto';

/** Use case: Хайлтын шүүлтүүр хадгалах. */
@Injectable()
export class SavedSearchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listingSearch: ListingSearchService,
  ) {}

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

  async update(userId: bigint, id: bigint, dto: UpdateSavedSearchDto) {
    await this.findOwn(userId, id);
    return this.prisma.savedSearch.update({
      where: { id },
      data: {
        name: dto.name,
        filters: dto.filters ? toJson(dto.filters) : undefined,
      },
    });
  }

  async remove(userId: bigint, id: bigint): Promise<void> {
    await this.findOwn(userId, id);
    await this.prisma.savedSearch.delete({ where: { id } });
  }

  /** Runs the saved filters as a normal listing search. */
  async findListings(user: AuthUser, id: bigint, query: PaginationQueryDto) {
    const saved = await this.findOwn(user.id, id);
    const filters = saved.filters as SearchFiltersDto;
    return this.listingSearch.search(
      { ...filters, page: query.page, limit: query.limit, sort: 'newest' },
      user,
    );
  }

  private async findOwn(userId: bigint, id: bigint) {
    const saved = await this.prisma.savedSearch.findFirst({
      where: { id, userId },
    });
    if (!saved) throw new NotFoundException('Saved search not found');
    return saved;
  }
}

/** DTO → plain JSON without undefined keys, so the stored jsonb stays clean. */
function toJson(filters: SearchFiltersDto) {
  return JSON.parse(
    JSON.stringify(instanceToPlain(filters)),
  ) as Prisma.InputJsonObject;
}
