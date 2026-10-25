import { Prisma } from '@prisma/client';

/** Fields for list/search results ("cards"). */
export const listingCardSelect = {
  id: true,
  ownerId: true,
  listingType: true,
  propertyType: true,
  status: true,
  title: true,
  monthlyRent: true,
  salePrice: true,
  priceNegotiable: true,
  areaM2: true,
  rooms: true,
  floor: true,
  khoroo: true,
  latitude: true,
  longitude: true,
  viewCount: true,
  publishedAt: true,
  createdAt: true,
  district: { select: { id: true, name: true } },
  photos: {
    select: { url: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    take: 1,
  },
} satisfies Prisma.ListingSelect;

type ListingCardRow = Prisma.ListingGetPayload<{
  select: typeof listingCardSelect;
}>;

export function toListingCard({ photos, ...rest }: ListingCardRow) {
  return { ...rest, coverUrl: photos[0]?.url ?? null };
}

/** Everything for the listing detail page. */
export const listingDetailInclude = {
  district: true,
  photos: {
    select: { id: true, url: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  },
  amenities: { select: { amenity: true } },
  owner: {
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      phone: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ListingInclude;

type ListingDetailRow = Prisma.ListingGetPayload<{
  include: typeof listingDetailInclude;
}>;

export function toListingDetail({ amenities, ...rest }: ListingDetailRow) {
  return { ...rest, amenities: amenities.map((a) => a.amenity) };
}
