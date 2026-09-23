import {createHmac, timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {getEnv} from '@/lib/config/env';
import {prisma} from '@/lib/db/client';

function verifyHmac(body: string, signature: string | null) {
  if (!signature) return false;
  const digest = createHmac('sha256', getEnv().SHOPIFY_SECRET).update(body, 'utf8').digest('base64');
  const expected = Buffer.from(digest, 'utf8');
  const actual = Buffer.from(signature, 'utf8');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  const body = await request.text();
  if (!verifyHmac(body, request.headers.get('x-shopify-hmac-sha256'))) {
    return NextResponse.json({error: 'Invalid webhook signature'}, {status: 401});
  }

  const topic = request.headers.get('x-shopify-topic');
  const shopDomain = request.headers.get('x-shopify-shop-domain');
  if (!shopDomain) return NextResponse.json({error: 'Missing shop domain'}, {status: 400});

  if (topic === 'app/uninstalled') {
    await prisma.shop.deleteMany({where: {shopifyDomain: shopDomain}});
  }

  if (topic === 'products/delete') {
    const payload = JSON.parse(body) as {id?: number | string};
    if (payload.id != null) {
      await prisma.locationProduct.deleteMany({
        where: {
          shopifyProductId: String(payload.id),
          location: {shop: {shopifyDomain: shopDomain}},
        },
      });
    }
  }

  return new NextResponse(null, {status: 204});
}
