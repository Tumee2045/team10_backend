import { Prisma } from '@prisma/client';
import { coverPhotoSelect, userContactSelect } from '../prisma/selects';

/** Fields for search results and lists ("cards"). Map with `withCoverUrl`. */
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
  photos: coverPhotoSelect,
} satisfies Prisma.ListingSelect;

/** Lightweight map markers. Map with `withCoverUrl`. */
export const listingMapPointSelect = {
  id: true,
  title: true,
  listingType: true,
  propertyType: true,
  monthlyRent: true,
  salePrice: true,
  latitude: true,
  longitude: true,
  photos: coverPhotoSelect,
} satisfies Prisma.ListingSelect;

/** Everything for the listing detail page. Map with `toListingDetail`. */
export const listingDetailInclude = {
  district: true,
  photos: {
    select: { id: true, url: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  },
  amenities: { select: { amenity: true } },
  owner: { select: { ...userContactSelect, createdAt: true } },
} satisfies Prisma.ListingInclude;

type ListingDetailRow = Prisma.ListingGetPayload<{
  include: typeof listingDetailInclude;
}>;

/** Flattens `amenities: [{ amenity }]` → `amenities: [amenity]`. */
export function toListingDetail({ amenities, ...rest }: ListingDetailRow) {
  return { ...rest, amenities: amenities.map((a) => a.amenity) };
}
