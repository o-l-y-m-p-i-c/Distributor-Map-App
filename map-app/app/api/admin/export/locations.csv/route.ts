import {NextResponse} from 'next/server';
import {stringify} from 'csv-stringify/sync';
import {authenticateShopifyRequest} from '@/lib/auth/shopify';
import {listMetaobjectLocations} from '@/lib/shopify/location-metaobjects';

export async function GET(request: Request) {
  try {
    const {shopDomain, accessToken} = await authenticateShopifyRequest(request);
    const locations = await listMetaobjectLocations(shopDomain, accessToken);
    const csv = stringify(locations.map((location) => ({name: location.name, address: location.addressLine1, address2: location.addressLine2 ?? '', city: location.city, state: location.state ?? '', postal_code: location.postalCode, country: location.country, country_code: location.countryCode, latitude: location.latitude ?? '', longitude: location.longitude ?? '', phone: location.phones[0] ?? '', phones: location.phones.join('|'), email: location.emails[0] ?? '', emails: location.emails.join('|'), website: location.websites[0] ?? '', websites: location.websites.join('|'), type: location.type, description: location.description ?? '', image_url: location.imageUrls[0] ?? '', image_urls: location.imageUrls.join('|'), button_url: location.buttonUrl ?? '', published: location.published})), {header: true});
    return new NextResponse(csv, {headers: {'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="locations.csv"'}});
  } catch (error) {
    console.error('Metaobject CSV export failed', error);
    return NextResponse.json({error: 'Unable to export Metaobject locations'}, {status: 401});
  }
}
