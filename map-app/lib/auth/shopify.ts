import {decodeJwt, jwtVerify, type JWTPayload} from 'jose';
import {prisma} from '@/lib/db/client';
import {getEnv} from '@/lib/config/env';
import {encryptAccessToken} from '@/lib/security/token-encryption';

const shopifyApiVersion = '2026-07';
const shopDomainPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

type ShopifyIdToken = JWTPayload & {
  dest?: string;
  sub?: string;
};

type TokenExchangeResponse = {
  access_token?: string;
  scope?: string;
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('Missing Shopify ID token');
  }
  return authorization.slice('Bearer '.length).trim();
}

function getShopDomain(payload: ShopifyIdToken) {
  if (!payload.dest) throw new Error('Shopify ID token has no destination');
  const destination = new URL(payload.dest);
  if (!shopDomainPattern.test(destination.hostname)) {
    throw new Error('Invalid Shopify shop domain');
  }
  return destination.hostname;
}

async function verifyIdToken(token: string) {
  const env = getEnv();
  const unverified = decodeJwt(token) as ShopifyIdToken;
  const shopDomain = getShopDomain(unverified);
  const issuer = `https://${shopDomain}/admin`;

  const {payload} = await jwtVerify(
    token,
    new TextEncoder().encode(env.SHOPIFY_SECRET),
    {audience: env.SHOPIFY_CLIENT_ID, issuer, clockTolerance: 5},
  );

  return {shopDomain, payload: payload as ShopifyIdToken};
}

async function exchangeIdToken(shopDomain: string, idToken: string) {
  const env = getEnv();
  const body = new URLSearchParams({
    client_id: env.SHOPIFY_CLIENT_ID,
    client_secret: env.SHOPIFY_SECRET,
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: idToken,
  });

  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body,
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`Shopify token exchange failed (${response.status})`);
  const result = (await response.json()) as TokenExchangeResponse;
  if (!result.access_token) throw new Error('Shopify token exchange returned no token');
  return result.access_token;
}

async function getShopifyShopId(shopDomain: string, accessToken: string) {
  const response = await fetch(`https://${shopDomain}/admin/api/${shopifyApiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-shopify-access-token': accessToken,
    },
    body: JSON.stringify({query: 'query { shop { id } }'}),
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`Shopify shop lookup failed (${response.status})`);
  const result = (await response.json()) as {data?: {shop?: {id?: string}}};
  if (!result.data?.shop?.id) throw new Error('Shopify shop lookup returned no ID');
  return result.data.shop.id;
}

export async function authenticateAdminRequest(request: Request) {
  const idToken = getBearerToken(request);
  const {shopDomain, payload} = await verifyIdToken(idToken);
  const accessToken = await exchangeIdToken(shopDomain, idToken);
  const shopifyShopId = await getShopifyShopId(shopDomain, accessToken);

  const shop = await prisma.shop.upsert({
    where: {shopifyDomain: shopDomain},
    create: {
      shopifyDomain: shopDomain,
      shopifyShopId,
      accessTokenEncrypted: encryptAccessToken(accessToken),
    },
    update: {
      shopifyShopId,
      accessTokenEncrypted: encryptAccessToken(accessToken),
    },
  });

  return {shop, shopifyUserId: payload.sub ?? null};
}
