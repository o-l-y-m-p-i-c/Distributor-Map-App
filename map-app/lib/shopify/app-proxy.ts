import {createHmac, timingSafeEqual} from 'node:crypto';
import {getEnv} from '@/lib/config/env';

const shopDomainPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function verifyAppProxyRequest(request: Request) {
  const url = new URL(request.url);
  const signature = url.searchParams.get('signature');
  const shop = url.searchParams.get('shop');
  if (!signature || !shop || !shopDomainPattern.test(shop)) return null;

  const message = [...url.searchParams.entries()]
    .filter(([key]) => key !== 'signature')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('');
  const digest = createHmac('sha256', getEnv().SHOPIFY_SECRET).update(message).digest('hex');
  const expected = Buffer.from(digest, 'utf8');
  const received = Buffer.from(signature, 'utf8');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  return shop;
}
