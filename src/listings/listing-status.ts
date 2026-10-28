import { ListingStatus, ListingType } from '@prisma/client';

const { DRAFT, ACTIVE, INACTIVE, RENTED, SOLD } = ListingStatus;

/** Anyone can open these by id. DRAFT and INACTIVE are for the owner and admins only. */
export const PUBLIC_STATUSES: ListingStatus[] = [ACTIVE, RENTED, SOLD];

/** Statuses a client can set with PATCH /listings/:id/status (DRAFT is only the initial state). */
export const SETTABLE_STATUSES = [ACTIVE, INACTIVE, RENTED, SOLD] as const;
export type SettableStatus = (typeof SETTABLE_STATUSES)[number];

interface StatusRule {
  /** Statuses the listing may currently be in. */
  from: ListingStatus[];
  /** Only allowed for this listing type. */
  onlyFor?: ListingType;
}

/** Allowed status changes, keyed by the target status. */
export const STATUS_RULES: Record<SettableStatus, StatusRule> = {
  ACTIVE: { from: [DRAFT, INACTIVE, RENTED] },
  INACTIVE: { from: [ACTIVE] },
  RENTED: { from: [ACTIVE, INACTIVE], onlyFor: ListingType.RENT },
  SOLD: { from: [ACTIVE, INACTIVE], onlyFor: ListingType.SALE },
};
