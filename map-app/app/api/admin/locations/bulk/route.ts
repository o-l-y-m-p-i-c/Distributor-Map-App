import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticateShopifyRequest, ShopifyAuthenticationError} from '@/lib/auth/shopify';
import {deleteMetaobjectLocation, findMetaobjectLocation, upsertMetaobjectLocation} from '@/lib/shopify/location-metaobjects';

const inputSchema = z.object({ids: z.array(z.string().min(1)).min(1).max(100), action: z.enum(['publish', 'unpublish', 'delete'])});

export async function POST(request: Request) {
  try {
    const {shopDomain, accessToken} = await authenticateShopifyRequest(request);
    const input = inputSchema.parse(await request.json());
    let count = 0;
    for (const id of input.ids) {
      const location = await findMetaobjectLocation(shopDomain, accessToken, id);
      if (!location) continue;
      if (input.action === 'delete') await deleteMetaobjectLocation(shopDomain, accessToken, id);
      else await upsertMetaobjectLocation(shopDomain, accessToken, {...location, published: input.action === 'publish'});
      count += 1;
    }
    return NextResponse.json({count});
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({error: 'Invalid bulk action'}, {status: 400});
    return NextResponse.json({error: error instanceof ShopifyAuthenticationError ? error.message : 'Unable to update Metaobject locations'}, {status: error instanceof ShopifyAuthenticationError ? 401 : 500});
  }
}
