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

  static of<T>(items: T[], total: number, query: PaginationQueryDto) {
    return new Page(items, total, query.page, query.limit);
  }
}

/** Prisma `skip`/`take` for a page query. */
export function pageArgs(query: PaginationQueryDto) {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}
