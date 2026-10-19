import 'dotenv/config';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../generated/prisma/client';
import {ensureDistributorDefinitions, jsonValue, upsertMetaobject, LOCATION_TYPE, SETTINGS_TYPE} from '../lib/shopify/metaobjects';

const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('DIRECT_DATABASE_URL or DATABASE_URL is required');

const prisma = new PrismaClient({adapter: new PrismaPg({connectionString})});

function shopToken(shop: {shopifyDomain: string; accessTokenEncrypted: string}) {
  return {shopifyDomain: shop.shopifyDomain, accessTokenEncrypted: shop.accessTokenEncrypted};
}

async function main() {
  const shops = await prisma.shop.findMany({include: {locations: {include: {openingHours: true, products: true, tagRelations: {include: {tag: true}}}}, settings: true}});
  let migratedLocations = 0;
  let migratedSettings = 0;

  for (const shop of shops) {
    const tokenShop = shopToken(shop);
    await ensureDistributorDefinitions(tokenShop);
    for (const location of shop.locations) {
      await upsertMetaobject(tokenShop, LOCATION_TYPE, `location-${location.id}`, {
        external_id: location.id,
        name: location.name,
        slug: location.slug,
        address_line_1: location.addressLine1,
        address_line_2: location.addressLine2 ?? '',
        city: location.city,
        state: location.state ?? '',
        postal_code: location.postalCode,
        country: location.country,
        country_code: location.countryCode,
        latitude: location.latitude == null ? '' : String(location.latitude),
        longitude: location.longitude == null ? '' : String(location.longitude),
        phones: jsonValue(location.phones),
        emails: jsonValue(location.emails),
        websites: jsonValue(location.websites),
        description: location.description ?? '',
        image_urls: jsonValue(location.imageUrls),
        button_url: location.buttonUrl ?? '',
        type: location.type,
        published: String(location.published),
        opening_hours: jsonValue(location.openingHours),
        custom_values: jsonValue(location.customValues),
        product_ids: jsonValue(location.products.map((product) => ({productId: product.shopifyProductId, variantId: product.shopifyVariantId}))),
        tags: jsonValue(location.tagRelations.map((relation) => relation.tag.slug)),
      });
      migratedLocations += 1;
    }

    if (shop.settings) {
      const settings = shop.settings;
      await upsertMetaobject(tokenShop, SETTINGS_TYPE, 'global', {
        map_provider: settings.mapProvider,
        map_style: settings.mapStyle,
        default_latitude: settings.defaultLatitude == null ? '' : String(settings.defaultLatitude),
        default_longitude: settings.defaultLongitude == null ? '' : String(settings.defaultLongitude),
        default_zoom: String(settings.defaultZoom),
        search_radius: String(settings.searchRadius),
        settings_json: jsonValue(settings),
        modal_config: jsonValue(settings.modalConfig),
      });
      migratedSettings += 1;
    }

    console.log(`Migrated ${shop.shopifyDomain}: ${shop.locations.length} locations`);
  }

  console.log(`Migration complete: ${migratedLocations} locations, ${migratedSettings} settings records`);
}

main().finally(() => prisma.$disconnect());
