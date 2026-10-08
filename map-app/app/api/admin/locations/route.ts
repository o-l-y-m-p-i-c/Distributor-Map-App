import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticateShopifyRequest, ShopifyAuthenticationError} from '@/lib/auth/shopify';
import {listMetaobjectLocations, upsertMetaobjectLocation} from '@/lib/shopify/location-metaobjects';

const locationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().max(120).optional().nullable(),
  postalCode: z.string().trim().min(1).max(40),
  country: z.string().trim().min(1).max(120),
  countryCode: z.string().trim().length(2).toUpperCase(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  phones: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  emails: z.array(z.string().trim().min(1).max(254)).max(20).optional(),
  websites: z.array(z.string().trim().min(1).max(2048)).max(20).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  imageUrls: z.array(z.string().trim().min(1).max(2048)).max(50).optional(),
  buttonUrl: z.string().trim().max(2048).optional().nullable(),
  customValues: z.record(z.string(), z.string().trim().max(2000)).optional(),
  type: z.string().trim().min(1).max(80).default('store'),
  published: z.boolean().default(false),
});

function errorResponse(message: string, status: number) { return NextResponse.json({error: message}, {status}); }

export async function GET(request: Request) {
  try {
    const {shopDomain, accessToken} = await authenticateShopifyRequest(request);
    const url = new URL(request.url);
    const page = Math.max(Number(url.searchParams.get('page') ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? 25), 1), 100);
    const search = url.searchParams.get('search')?.trim().toLowerCase();
    const all = await listMetaobjectLocations(shopDomain, accessToken);
    const filtered = search ? all.filter((location) => [location.name, location.city, location.addressLine1, location.postalCode, location.country].some((value) => String(value).toLowerCase().includes(search))) : all;
    const items = filtered.slice((page - 1) * pageSize, page * pageSize);
    return NextResponse.json({items, page, pageSize, total: filtered.length});
  } catch (error) {
    console.error('Metaobject locations GET failed', error);
    return errorResponse(error instanceof ShopifyAuthenticationError ? error.message : 'Unable to load Metaobject locations', error instanceof ShopifyAuthenticationError ? 401 : 500);
  }
}

export async function POST(request: Request) {
  try {
    const {shopDomain, accessToken} = await authenticateShopifyRequest(request);
    const input = locationSchema.parse(await request.json());
    const location = await upsertMetaobjectLocation(shopDomain, accessToken, input);
    return NextResponse.json({location, geocoded: input.latitude != null && input.longitude != null}, {status: 201});
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse('Invalid location data', 400);
    console.error('Metaobject locations POST failed', error);
    return errorResponse(error instanceof ShopifyAuthenticationError ? error.message : 'Unable to save Metaobject location', error instanceof ShopifyAuthenticationError ? 401 : 500);
  }
}
