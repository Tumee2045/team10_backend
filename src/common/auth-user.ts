import { UserRole } from '@prisma/client';

/** What the JWT guard attaches to `request.user`. */
export interface AuthUser {
  id: bigint;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
}
