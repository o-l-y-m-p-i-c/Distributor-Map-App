import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateAdminRequest, ShopifyAuthenticationError } from '@/lib/auth/shopify';
import { geocodeAddress } from '@/lib/geo/geocode';
import { prisma } from '@/lib/db/client';

const createLocationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().max(120).optional().nullable(),
  postalCode: z.string().trim().min(1).max(40),
  country: z.string().trim().min(1).max(120),
  countryCode: z.string().trim().length(2).toUpperCase(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  email: z.string().email().max(254).optional().nullable(),
  website: z.string().url().max(2048).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  imageUrl: z.string().url().max(2048).optional().nullable(),
  buttonUrl: z.string().url().max(2048).optional().nullable(),
  type: z.string().trim().min(1).max(80).default('store'),
  published: z.boolean().default(false),
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const { shop } = await authenticateAdminRequest(request);
    const url = new URL(request.url);
    const page = Math.max(Number(url.searchParams.get('page') ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? 25), 1), 100);
    const search = url.searchParams.get('search')?.trim();

    const where = {
      shopId: shop.id,
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { city: { contains: search, mode: 'insensitive' as const } }] } : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.location.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, name: true, slug: true, city: true, country: true, type: true, published: true, latitude: true, longitude: true, updatedAt: true },
      }),
      prisma.location.count({ where }),
    ]);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (error) {
    console.error('Admin locations GET failed', error);
    return jsonError('Unable to authenticate or load locations', error instanceof ShopifyAuthenticationError ? 401 : 500);
  }
}

export async function POST(request: Request) {
  try {
    const { shop } = await authenticateAdminRequest(request);
    const input = createLocationSchema.parse(await request.json());
    const hasCoordinates = input.latitude != null && input.longitude != null;
    const location = await prisma.location.create({ data: { ...input, coordinatesSource: hasCoordinates ? 'manual' : 'missing', shopId: shop.id } });

    if (!hasCoordinates) {
      const address = [input.addressLine1, input.addressLine2, input.city, input.state, input.postalCode, input.country].filter(Boolean).join(', ');
      try {
        const geocoded = await geocodeAddress(address);
        if (geocoded) {
          const updated = await prisma.location.update({ where: { id: location.id }, data: { latitude: geocoded.latitude, longitude: geocoded.longitude, coordinatesSource: 'geocoded' } });
          return NextResponse.json({ location: updated, geocoded: true }, { status: 201 });
        }
      } catch (geocodeError) {
        console.error('Location geocoding failed after create', geocodeError);
      }
    }

    return NextResponse.json({ location, geocoded: false }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError('Invalid location data', 400);
    console.error('Admin locations POST failed', error);
    return jsonError('Unable to authenticate or create location', error instanceof ShopifyAuthenticationError ? 401 : 500);
  }
}
