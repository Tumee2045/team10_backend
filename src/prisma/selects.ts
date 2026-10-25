// Small Prisma selects reused across modules, so every response shows
// a user or a listing summary the same way.
import { Prisma } from '@prisma/client';

export const userBriefSelect = {
  id: true,
  fullName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

/** Brief + phone, for people you are dealing with (owner, renter). */
export const userContactSelect = {
  ...userBriefSelect,
  phone: true,
} satisfies Prisma.UserSelect;

/** The cover photo only (sort_order 0 = cover). */
export const coverPhotoSelect = {
  select: { url: true },
  orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  take: 1,
} satisfies Prisma.Listing$photosArgs;

export const listingBriefSelect = {
  id: true,
  title: true,
  status: true,
  listingType: true,
  ownerId: true,
  monthlyRent: true,
  salePrice: true,
  photos: coverPhotoSelect,
} satisfies Prisma.ListingSelect;

/** `{ photos: [{ url }] }` → `{ coverUrl }`. */
export function withCoverUrl<T extends { photos: { url: string }[] }>({
  photos,
  ...rest
}: T) {
  return { ...rest, coverUrl: photos[0]?.url ?? null };
}
