import { NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/auth/shopify';
import { prisma } from '@/lib/db/client';
import { geocodeAddress } from '@/lib/geo/geocode';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { shop } = await authenticateAdminRequest(request);
    const { id } = await params;
    const location = await prisma.location.findFirst({ where: { id, shopId: shop.id } });
    if (!location) return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    if (location.coordinatesSource === 'manual') return NextResponse.json({ error: 'Coordinates were manually adjusted and will not be overwritten' }, { status: 409 });
    const address = [location.addressLine1, location.addressLine2, location.city, location.state, location.postalCode, location.country].filter(Boolean).join(', ');
    const result = await geocodeAddress(address);
    if (!result) return NextResponse.json({ error: 'Address could not be geocoded' }, { status: 422 });
    const updated = await prisma.location.update({ where: { id: location.id }, data: { latitude: result.latitude, longitude: result.longitude } });
    return NextResponse.json({ location: updated, formattedAddress: result.formattedAddress });
  } catch (error) {
    console.error('Admin geocode failed', error);
    return NextResponse.json({ error: 'Unable to authenticate or geocode location' }, { status: 500 });
  }
}
