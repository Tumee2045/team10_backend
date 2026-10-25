import { ListingStatus, ListingType } from '@prisma/client';

const { DRAFT, ACTIVE, INACTIVE, RENTED, SOLD } = ListingStatus;

/** Anyone can open these by id. DRAFT and INACTIVE are for the owner and admins only. */
export const PUBLIC_STATUSES: ListingStatus[] = [ACTIVE, RENTED, SOLD];

interface StatusTransition {
  from: ListingStatus[];
  to: ListingStatus;
  /** Only allowed for this listing type. */
  onlyFor?: ListingType;
}

export type StatusAction =
  'publish' | 'deactivate' | 'markAsRented' | 'markAsSold';

/** Status changes. Names match the methods in the class diagram. */
export const STATUS_TRANSITIONS: Record<StatusAction, StatusTransition> = {
  publish: { from: [DRAFT, INACTIVE, RENTED], to: ACTIVE },
  deactivate: { from: [ACTIVE], to: INACTIVE },
  markAsRented: {
    from: [ACTIVE, INACTIVE],
    to: RENTED,
    onlyFor: ListingType.RENT,
  },
  markAsSold: { from: [ACTIVE, INACTIVE], to: SOLD, onlyFor: ListingType.SALE },
};
