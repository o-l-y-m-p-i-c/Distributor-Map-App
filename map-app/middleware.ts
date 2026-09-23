import { NextRequest, NextResponse } from 'next/server';

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && (
      url.hostname === 'shopify.com'
      || url.hostname === 'admin.shopify.com'
      || url.hostname.endsWith('.shopify.com')
      || url.hostname.endsWith('.shopifycdn.com')
      || url.hostname.endsWith('.myshopify.com')
    );
  } catch {
    return false;
  }
}

function applyCors(response: NextResponse, origin: string | null) {
  if (isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin as string);
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
    response.headers.set('Access-Control-Max-Age', '600');
    response.headers.append('Vary', 'Origin');
  }
  return response;
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return applyCors(new NextResponse(null, { status: 204 }), origin);
  return applyCors(NextResponse.next(), origin);
}

export const config = {
  matcher: ['/api/admin/:path*', '/api/storefront/:path*'],
};
