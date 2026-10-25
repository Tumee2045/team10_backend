/**
 * Every response has the same top-level shape, so the frontend can always do:
 *
 *   if (res.success) use(res.data) else show(res.message)
 */

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  /** Only on paged lists. */
  meta?: PageMeta;
}

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface FieldError {
  /** Dot path of the invalid field, e.g. `email` or `filters.maxPrice`. */
  field: string;
  message: string;
}

export interface ApiError {
  success: false;
  statusCode: number;
  /** Stable code for `switch`ing in the frontend. */
  error: ErrorCode;
  /** Human-readable, safe to show to the user. */
  message: string;
  /** Only for VALIDATION_ERROR. */
  errors?: FieldError[];
  path: string;
  timestamp: string;
}
