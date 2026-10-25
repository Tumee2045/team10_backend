import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { instanceToPlain } from 'class-transformer';
import { AuthUser } from '../common/auth-user';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { SearchFiltersDto } from '../listings/dto/search-filters.dto';
import { ListingsService } from '../listings/listings.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSavedSearchDto,
  UpdateSavedSearchDto,
} from './dto/saved-search.dto';

/** Use case: Хайлтын шүүлтүүр хадгалах. */
@Injectable()
export class SavedSearchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: ListingsService,
  ) {}

  list(userId: bigint) {
    return this.prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(userId: bigint, dto: CreateSavedSearchDto) {
    return this.prisma.savedSearch.create({
      data: { userId, name: dto.name, filters: this.toJson(dto.filters) },
    });
  }

  async update(userId: bigint, id: bigint, dto: UpdateSavedSearchDto) {
    await this.getOwn(userId, id);
    return this.prisma.savedSearch.update({
      where: { id },
      data: {
        name: dto.name,
        filters: dto.filters ? this.toJson(dto.filters) : undefined,
      },
    });
  }

  async remove(userId: bigint, id: bigint) {
    await this.getOwn(userId, id);
    await this.prisma.savedSearch.delete({ where: { id } });
    return { ok: true };
  }

  /** apply(): runs the saved filters as a listing search. */
  async results(user: AuthUser, id: bigint, q: PaginationQueryDto) {
    const saved = await this.getOwn(user.id, id);
    const filters = saved.filters as SearchFiltersDto;
    return this.listings.search(
      { ...filters, page: q.page, limit: q.limit, sort: 'newest' },
      user,
    );
  }

  private async getOwn(userId: bigint, id: bigint) {
    const saved = await this.prisma.savedSearch.findFirst({
      where: { id, userId },
    });
    if (!saved) throw new NotFoundException('Saved search not found');
    return saved;
  }

  /** Drop undefined keys so the stored jsonb stays clean. */
  private toJson(filters: SearchFiltersDto): Prisma.InputJsonObject {
    return JSON.parse(
      JSON.stringify(instanceToPlain(filters)),
    ) as Prisma.InputJsonObject;
  }
}
