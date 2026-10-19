import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { coordinateBounds, distanceMeters } from '@/lib/geo/distance';
import { geocodeAddress } from '@/lib/geo/geocode';
import { verifyAppProxyRequest } from '@/lib/shopify/app-proxy';

const querySchema = z.object({
  q: z.string().trim().max(200).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  minLatitude: z.coerce.number().min(-90).max(90).optional(),
  maxLatitude: z.coerce.number().min(-90).max(90).optional(),
  minLongitude: z.coerce.number().min(-180).max(180).optional(),
  maxLongitude: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(500).default(50),
  type: z.string().trim().max(80).optional(),
  productId: z.string().trim().max(100).optional(),
});

export async function GET(request: Request) {
  try {
    const shopDomain = verifyAppProxyRequest(request);
    if (!shopDomain) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const input = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    let latitude = input.latitude;
    let longitude = input.longitude;

    if ((latitude == null) !== (longitude == null)) return NextResponse.json({ error: 'Latitude and longitude must be provided together' }, { status: 400 });
    const hasBounds = [input.minLatitude, input.maxLatitude, input.minLongitude, input.maxLongitude].every((value) => value != null);
    const hasPartialBounds = [input.minLatitude, input.maxLatitude, input.minLongitude, input.maxLongitude].some((value) => value != null);
    if (hasPartialBounds && !hasBounds) return NextResponse.json({ error: 'All map bounds must be provided together' }, { status: 400 });
    if (hasBounds && (input.minLatitude! > input.maxLatitude! || input.minLongitude! > input.maxLongitude!)) return NextResponse.json({ error: 'Invalid map bounds' }, { status: 400 });
    const shop = await prisma.shop.findUnique({ where: { shopifyDomain: shopDomain }, select: { id: true } });
    if (!shop) return NextResponse.json({ items: [], total: 0 });

    const filters = {
      shopId: shop.id,
      published: true,
      ...(input.type ? { type: input.type } : {}),
      ...(input.productId ? { products: { some: { shopifyProductId: input.productId } } } : {}),
    };
    const bounds = hasBounds
      ? { minLatitude: input.minLatitude!, maxLatitude: input.maxLatitude!, minLongitude: input.minLongitude!, maxLongitude: input.maxLongitude! }
      : latitude != null && longitude != null
        ? coordinateBounds(latitude, longitude, input.radius)
        : null;
    const candidates = bounds
      ? await prisma.location.findMany({ where: { ...filters, latitude: { not: null, gte: bounds.minLatitude, lte: bounds.maxLatitude }, longitude: { not: null, gte: bounds.minLongitude, lte: bounds.maxLongitude } } })
      : await prisma.location.findMany({ where: { ...filters, ...(input.q ? { name: { contains: input.q, mode: 'insensitive' } } : {}) }, take: 100 });

    const items = candidates.map((location) => {
      const distance = latitude != null && longitude != null && location.latitude != null && location.longitude != null
        ? distanceMeters({ latitude, longitude }, { latitude: Number(location.latitude), longitude: Number(location.longitude) })
        : null;
      return { id: location.id, name: location.name, addressLine1: location.addressLine1, city: location.city, state: location.state, postalCode: location.postalCode, country: location.country, countryCode: location.countryCode, latitude: location.latitude == null ? null : Number(location.latitude), longitude: location.longitude == null ? null : Number(location.longitude), phone: location.phones[0] ?? null, email: location.emails[0] ?? null, website: location.websites[0] ?? null, phones: location.phones, emails: location.emails, websites: location.websites, description: location.description, imageUrl: location.imageUrls[0] ?? null, imageUrls: location.imageUrls, buttonUrl: location.buttonUrl, customValues: location.customValues, type: location.type, distanceMeters: distance, distanceKilometers: distance == null ? null : distance / 1000 };
    }).filter((item) => hasBounds || item.distanceMeters == null || item.distanceMeters <= input.radius * 1000).sort((left, right) => (left.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (right.distanceMeters ?? Number.MAX_SAFE_INTEGER));

    return NextResponse.json({ items, total: items.length, query: input.q ?? null, center: latitude != null && longitude != null ? { latitude, longitude } : null });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid search parameters' }, { status: 400 });
    console.error('Storefront search failed', error);
    return NextResponse.json({ error: 'Unable to search locations' }, { status: 500 });
  }
}
