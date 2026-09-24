import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateAdminRequest, ShopifyAuthenticationError } from '@/lib/auth/shopify';
import { prisma } from '@/lib/db/client';

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  action: z.enum(['publish', 'unpublish', 'delete']),
});

export async function POST(request: Request) {
  try {
    const { shop } = await authenticateAdminRequest(request);
    const { ids, action } = bulkSchema.parse(await request.json());
    const where = { id: { in: ids }, shopId: shop.id };

    if (action === 'delete') {
      const result = await prisma.location.deleteMany({ where });
      return NextResponse.json({ deleted: result.count });
    }

    const result = await prisma.location.updateMany({ where, data: { published: action === 'publish' } });
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid bulk request' }, { status: 400 });
    console.error('Admin locations bulk failed', error);
    return NextResponse.json({ error: 'Unable to authenticate or update locations' }, { status: error instanceof ShopifyAuthenticationError ? 401 : 500 });
  }
}
