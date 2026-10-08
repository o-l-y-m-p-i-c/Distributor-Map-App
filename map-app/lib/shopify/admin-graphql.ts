import {decryptAccessToken} from '@/lib/security/token-encryption';

type ShopWithToken = {shopifyDomain: string; accessTokenEncrypted: string};
type GraphQLResponse<T> = {data?: T; errors?: Array<{message: string}>};

export async function adminGraphql<T>(shop: ShopWithToken, query: string, variables?: Record<string, unknown>) {
  const response = await fetch(`https://${shop.shopifyDomain}/admin/api/2026-07/graphql.json`, {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-shopify-access-token': decryptAccessToken(shop.accessTokenEncrypted)},
    body: JSON.stringify({query, variables}),
    cache: 'no-store',
  });
  const payload = await response.json() as GraphQLResponse<T>;
  if (!response.ok || payload.errors?.length) throw new Error(payload.errors?.map((error) => error.message).join('; ') || `Shopify Admin API request failed (${response.status})`);
  return payload.data as T;
}
