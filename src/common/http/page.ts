import { PaginationQueryDto } from '../dto/pagination-query.dto';

/**
 * Return this from a service for paged lists. The response interceptor turns it into
 * `{ data: items, meta: { total, page, limit, totalPages } }`.
 */
export class Page<T> {
  constructor(
    readonly items: T[],
    readonly total: number,
    readonly page: number,
    readonly limit: number,
  ) {}

  map<U>(fn: (item: T) => U): Page<U> {
    return new Page(this.items.map(fn), this.total, this.page, this.limit);
  }
}

/**
 * Runs the page query and the count in parallel.
 *
 *   return findPage(query,
 *     (page) => this.prisma.listing.findMany({ where, ...page }),
 *     () => this.prisma.listing.count({ where }));
 */
export async function findPage<T>(
  query: PaginationQueryDto,
  findMany: (page: { skip: number; take: number }) => Promise<T[]>,
  count: () => Promise<number>,
): Promise<Page<T>> {
  const page = { skip: (query.page - 1) * query.limit, take: query.limit };
  const [items, total] = await Promise.all([findMany(page), count()]);
  return new Page(items, total, query.page, query.limit);
}
