import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticateShopifyRequest, ShopifyAuthenticationError} from '@/lib/auth/shopify';
import {upsertMetaobjectLocation} from '@/lib/shopify/location-metaobjects';

const rowSchema = z.object({
  external_id: z.string().trim().max(180).optional().default(''), name: z.string().trim().min(1), address: z.string().trim().min(1), city: z.string().trim().min(1), postal_code: z.string().trim().min(1), country: z.string().trim().min(1), country_code: z.string().optional().default(''),
  address2: z.string().optional().default(''), state: z.string().optional().default(''), latitude: z.string().optional().default(''), longitude: z.string().optional().default(''), phone: z.string().optional().default(''), phones: z.string().optional().default(''), email: z.string().optional().default(''), emails: z.string().optional().default(''), website: z.string().optional().default(''), websites: z.string().optional().default(''), type: z.string().optional().default('store'), description: z.string().optional().default(''), image_url: z.string().optional().default(''), image_urls: z.string().optional().default(''), button_url: z.string().optional().default(''), published: z.string().optional().default(''),
});

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 170); }
function split(value: string) { return value.split('|').map((item) => item.trim()).filter(Boolean); }

export async function POST(request: Request) {
  try {
    const {shopDomain, accessToken} = await authenticateShopifyRequest(request);
    const body = await request.json() as {rows?: unknown[]};
    const rows = z.array(rowSchema).max(5000).parse(body.rows ?? []);
    let imported = 0;
    for (const row of rows) {
      const latitude = row.latitude ? Number(row.latitude) : null;
      const longitude = row.longitude ? Number(row.longitude) : null;
      const phones = [row.phone, ...split(row.phones)].map((value) => value.trim()).filter(Boolean);
      const emails = [row.email, ...split(row.emails)].map((value) => value.trim()).filter(Boolean);
      const websites = [row.website, ...split(row.websites)].map((value) => value.trim()).filter(Boolean);
      const imageUrls = [row.image_url, ...split(row.image_urls)].map((value) => value.trim()).filter(Boolean);
      await upsertMetaobjectLocation(shopDomain, accessToken, {
        name: row.name,
        slug: row.external_id || slugify(row.name) || `location-${imported + 1}`,
        addressLine1: row.address,
        addressLine2: row.address2 || null,
        city: row.city,
        state: row.state || null,
        postalCode: row.postal_code,
        country: row.country,
        countryCode: (row.country_code || row.country.slice(0, 2)).toUpperCase(),
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        phones,
        emails,
        websites,
        description: row.description || null,
        imageUrls,
        buttonUrl: row.button_url || null,
        type: row.type || 'store',
        published: ['true', '1', 'yes', 'y'].includes(row.published.trim().toLowerCase()),
      });
      imported += 1;
    }
    return NextResponse.json({imported});
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({error: 'Invalid import rows'}, {status: 400});
    console.error('Metaobject CSV import failed', error);
    return NextResponse.json({error: error instanceof ShopifyAuthenticationError ? error.message : 'Unable to import Metaobject locations'}, {status: error instanceof ShopifyAuthenticationError ? 401 : 500});
  }
}
