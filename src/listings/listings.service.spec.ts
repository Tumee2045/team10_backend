import { BadRequestException } from '@nestjs/common';
import { ListingStatus, ListingType } from '@prisma/client';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from './listings.service';

describe('ListingsService.buildWhere', () => {
  const service = new ListingsService(
    {} as PrismaService,
    {} as CloudinaryService,
  );

  it('only searches ACTIVE listings', () => {
    expect(service.buildWhere({}).status).toBe(ListingStatus.ACTIVE);
  });

  it('applies the price range to monthlyRent for RENT', () => {
    const where = service.buildWhere({
      listingType: ListingType.RENT,
      minPrice: 100,
      maxPrice: 200,
    });
    expect(where.monthlyRent).toEqual({ gte: 100n, lte: 200n });
    expect(where.salePrice).toBeUndefined();
  });

  it('applies the price range to both types when listingType is omitted', () => {
    const where = service.buildWhere({ maxPrice: 500 });
    expect(where.AND).toContainEqual({
      OR: [
        { listingType: ListingType.RENT, monthlyRent: { lte: 500n } },
        { listingType: ListingType.SALE, salePrice: { lte: 500n } },
      ],
    });
  });

  it('requires every amenity', () => {
    const where = service.buildWhere({ amenityIds: [1, 2] });
    expect(where.AND).toEqual([
      { amenities: { some: { amenityId: 1 } } },
      { amenities: { some: { amenityId: 2 } } },
    ]);
  });

  it('rejects an inverted price range', () => {
    expect(() => service.buildWhere({ minPrice: 10, maxPrice: 1 })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a partial bounding box', () => {
    expect(() => service.buildWhere({ minLat: 47 })).toThrow(
      BadRequestException,
    );
  });
});
