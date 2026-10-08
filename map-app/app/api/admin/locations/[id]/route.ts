import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticateShopifyRequest, ShopifyAuthenticationError} from '@/lib/auth/shopify';
import {deleteMetaobjectLocation, findMetaobjectLocation, upsertMetaobjectLocation} from '@/lib/shopify/location-metaobjects';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  addressLine1: z.string().trim().min(1).max(200).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  postalCode: z.string().trim().min(1).max(40).optional(),
  country: z.string().trim().min(1).max(120).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  type: z.string().trim().min(1).max(80).optional(),
  published: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

type RouteContext = {params: Promise<{id: string}>};

export async function GET(request: Request, {params}: RouteContext) {
  try {
    const {shopDomain, accessToken} = await authenticateShopifyRequest(request);
    const location = await findMetaobjectLocation(shopDomain, accessToken, (await params).id);
    return location ? NextResponse.json({location}) : NextResponse.json({error: 'Location not found'}, {status: 404});
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : 'Unable to load location'}, {status: error instanceof ShopifyAuthenticationError ? 401 : 500});
  }
}

export async function PUT(request: Request, {params}: RouteContext) {
  try {
    const {shopDomain, accessToken} = await authenticateShopifyRequest(request);
    const id = (await params).id;
    const existing = await findMetaobjectLocation(shopDomain, accessToken, id);
    if (!existing) return NextResponse.json({error: 'Location not found'}, {status: 404});
    const input = updateSchema.parse(await request.json());
    const location = await upsertMetaobjectLocation(shopDomain, accessToken, {...existing, ...input, slug: existing.slug});
    return NextResponse.json({location});
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({error: 'Invalid location data'}, {status: 400});
    return NextResponse.json({error: error instanceof Error ? error.message : 'Unable to update location'}, {status: error instanceof ShopifyAuthenticationError ? 401 : 500});
  }
}

export async function DELETE(request: Request, {params}: RouteContext) {
  try {
    const {shopDomain, accessToken} = await authenticateShopifyRequest(request);
    const id = (await params).id;
    const existing = await findMetaobjectLocation(shopDomain, accessToken, id);
    if (!existing) return NextResponse.json({error: 'Location not found'}, {status: 404});
    await deleteMetaobjectLocation(shopDomain, accessToken, id);
    return new NextResponse(null, {status: 204});
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : 'Unable to delete location'}, {status: error instanceof ShopifyAuthenticationError ? 401 : 500});
  }
}
