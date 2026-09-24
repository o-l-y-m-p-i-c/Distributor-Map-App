import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateAdminRequest } from '@/lib/auth/shopify';
import { geocodeAddress } from '@/lib/geo/geocode';
import { prisma } from '@/lib/db/client';

const locationUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  addressLine1: z.string().trim().min(1).max(200).optional(),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(1).max(120).optional(),
  state: z.string().trim().max(120).nullable().optional(),
  postalCode: z.string().trim().min(1).max(40).optional(),
  country: z.string().trim().min(1).max(120).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  phone: z.string().trim().max(60).nullable().optional(),
  email: z.string().email().max(254).nullable().optional(),
  website: z.string().url().max(2048).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  imageUrl: z.string().url().max(2048).nullable().optional(),
  buttonUrl: z.string().url().max(2048).nullable().optional(),
  type: z.string().trim().min(1).max(80).optional(),
  published: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { shop } = await authenticateAdminRequest(request);
    const { id } = await params;
    const location = await prisma.location.findFirst({ where: { id, shopId: shop.id }, include: { openingHours: true, tagRelations: { include: { tag: true } }, products: true } });
    if (!location) return errorResponse('Location not found', 404);
    return NextResponse.json({ location });
  } catch (error) {
    console.error('Admin location GET failed', error);
    return errorResponse('Unable to authenticate or load location', 401);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { shop } = await authenticateAdminRequest(request);
    const { id } = await params;
    const input = locationUpdateSchema.parse(await request.json());
    const existing = await prisma.location.findFirst({ where: { id, shopId: shop.id }, select: { id: true } });
    if (!existing) return errorResponse('Location not found', 404);
    const data = { ...input, ...(input.latitude !== undefined || input.longitude !== undefined ? { coordinatesSource: 'manual' } : {}) };
    let location = await prisma.location.update({ where: { id }, data });

    if (location.latitude == null || location.longitude == null) {
      const address = [location.addressLine1, location.addressLine2, location.city, location.state, location.postalCode, location.country].filter(Boolean).join(', ');
      try {
        const geocoded = await geocodeAddress(address);
        if (geocoded) {
          location = await prisma.location.update({ where: { id }, data: { latitude: geocoded.latitude, longitude: geocoded.longitude, coordinatesSource: 'geocoded' } });
        }
      } catch (geocodeError) {
        console.error('Location geocoding failed after update', geocodeError);
      }
    }

    return NextResponse.json({ location });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse('Invalid location data', 400);
    console.error('Admin location PUT failed', error);
    return errorResponse('Unable to authenticate or update location', 401);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { shop } = await authenticateAdminRequest(request);
    const { id } = await params;
    const deleted = await prisma.location.deleteMany({ where: { id, shopId: shop.id } });
    if (!deleted.count) return errorResponse('Location not found', 404);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Admin location DELETE failed', error);
    return errorResponse('Unable to authenticate or delete location', 401);
  }
}
