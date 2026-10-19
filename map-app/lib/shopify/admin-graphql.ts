import {decryptAccessToken} from '@/lib/security/token-encryption';

type GraphQLResponse<T> = {data?: T; errors?: Array<{message: string}>};

type ShopWithToken = {shopifyDomain: string; accessTokenEncrypted: string};

export async function adminGraphql<T>(shop: ShopWithToken, query: string, variables?: Record<string, unknown>) {
  return adminGraphqlWithToken<T>(shop.shopifyDomain, decryptAccessToken(shop.accessTokenEncrypted), query, variables);
}

export async function adminGraphqlWithToken<T>(shopDomain: string, accessToken: string, query: string, variables?: Record<string, unknown>) {
  const response = await fetch(`https://${shopDomain}/admin/api/2026-07/graphql.json`, {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-shopify-access-token': accessToken},
    body: JSON.stringify({query, variables}),
    cache: 'no-store',
  });
  const payload = await response.json() as GraphQLResponse<T>;
  if (!response.ok || payload.errors?.length) throw new Error(payload.errors?.map((error) => error.message).join('; ') || `Shopify Admin API request failed (${response.status})`);
  return payload.data as T;
}
