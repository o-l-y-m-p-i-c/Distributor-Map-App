import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyAppProxyRequest } from '@/lib/shopify/app-proxy';

export async function GET(request: Request) {
  const shopDomain = verifyAppProxyRequest(request);
  if (!shopDomain) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const settings = await prisma.settings.findFirst({ where: { shop: { shopifyDomain: shopDomain } }, select: { mapProvider: true, defaultLatitude: true, defaultLongitude: true, defaultZoom: true, searchRadius: true, enableGeolocation: true, showDirections: true, showPhone: true, showWebsite: true, showOpeningHours: true, mapStyle: true, markerStyle: true, primaryColor: true, accentColor: true, customSections: true, modalConfig: true } });
  return NextResponse.json(settings ?? { mapProvider: 'openfreemap', defaultZoom: 5, searchRadius: 50, enableGeolocation: true, showDirections: true, showPhone: true, showWebsite: true, showOpeningHours: true, mapStyle: 'liberty', markerStyle: 'pin', primaryColor: '#176274', accentColor: '#4ca9ba', customSections: [], modalConfig: {} });
}
