import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateAdminRequest, ShopifyAuthenticationError } from '@/lib/auth/shopify';
import { prisma } from '@/lib/db/client';

const rowSchema = z.object({
  name: z.string().trim().min(1), address: z.string().trim().min(1), city: z.string().trim().min(1), postal_code: z.string().trim().min(1), country: z.string().trim().min(1), country_code: z.string().optional().default(''),
  address2: z.string().optional().default(''), state: z.string().optional().default(''), latitude: z.string().optional().default(''), longitude: z.string().optional().default(''), phone: z.string().optional().default(''), phones: z.string().optional().default(''), email: z.string().optional().default(''), emails: z.string().optional().default(''), website: z.string().optional().default(''), websites: z.string().optional().default(''), type: z.string().optional().default('store'), description: z.string().optional().default(''), image_url: z.string().optional().default(''), image_urls: z.string().optional().default(''), button_url: z.string().optional().default(''), published: z.string().optional().default(''),
});

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 170);
}

export async function POST(request: Request) {
  try {
    const { shop } = await authenticateAdminRequest(request);
    const body = await request.json() as { rows?: unknown[] };
    const rows = z.array(rowSchema).max(5000).parse(body.rows ?? []);
    const batch = Date.now().toString(36);
    const imported = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const row of rows) {
        const latitude = row.latitude ? Number(row.latitude) : null;
        const longitude = row.longitude ? Number(row.longitude) : null;
        await tx.location.create({ data: { shopId: shop.id, name: row.name, slug: `${slugify(row.name) || 'location'}-${batch}-${count + 1}`, addressLine1: row.address, addressLine2: row.address2 || null, city: row.city, state: row.state || null, postalCode: row.postal_code, country: row.country, countryCode: (row.country_code || row.country.slice(0, 2)).toUpperCase(), latitude: Number.isFinite(latitude) ? latitude : null, longitude: Number.isFinite(longitude) ? longitude : null, coordinatesSource: Number.isFinite(latitude) && Number.isFinite(longitude) ? 'manual' : 'missing', phones: [row.phone, ...(row.phones ? row.phones.split('|') : [])].map((value) => value.trim()).filter(Boolean), emails: [row.email, ...(row.emails ? row.emails.split('|') : [])].map((value) => value.trim()).filter(Boolean), websites: [row.website, ...(row.websites ? row.websites.split('|') : [])].map((value) => value.trim()).filter(Boolean), phone: row.phone || row.phones.split('|')[0]?.trim() || null, email: row.email || row.emails.split('|')[0]?.trim() || null, website: row.website || row.websites.split('|')[0]?.trim() || null, description: row.description || null, imageUrls: [row.image_url, ...(row.image_urls ? row.image_urls.split('|') : [])].map((url) => url.trim()).filter(Boolean), buttonUrl: row.button_url || null, type: row.type || 'store', published: row.published === 'true' || row.published === '1' } });
        count += 1;
      }
      return count;
    });
    return NextResponse.json({ imported });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid import rows' }, { status: 400 });
    console.error('CSV import failed', error);
    return NextResponse.json({ error: 'Unable to authenticate or import CSV' }, { status: error instanceof ShopifyAuthenticationError ? 401 : 500 });
  }
}
