import {adminGraphql} from '@/lib/shopify/admin-graphql';

type ShopifyShop = {shopifyDomain: string; accessTokenEncrypted: string};
type FieldDefinition = {key: string; name: string; type: string; description?: string};

const DEFINITION_CREATE = `mutation MetaobjectDefinitionCreate($definition: MetaobjectDefinitionCreateInput!) { metaobjectDefinitionCreate(definition: $definition) { metaobjectDefinition { id type } userErrors { field message } } }`;
const DEFINITION_QUERY = `query MetaobjectDefinition($type: String!) { metaobjectDefinitionByType(type: $type) { id type } }`;
const UPSERT = `mutation MetaobjectUpsert($handle: MetaobjectHandleInput!, $values: JSON!) { metaobjectUpsert(handle: $handle, values: $values) { metaobject { id handle values } userErrors { field message code } } }`;

export const LOCATION_TYPE = 'retail_location';
export const SETTINGS_TYPE = 'retail_locator_settings';

const locationFields: FieldDefinition[] = [
  {key: 'external_id', name: 'External ID', type: 'single_line_text_field'},
  {key: 'name', name: 'Name', type: 'single_line_text_field'},
  {key: 'slug', name: 'Slug', type: 'single_line_text_field'},
  {key: 'address_line_1', name: 'Address line 1', type: 'single_line_text_field'},
  {key: 'address_line_2', name: 'Address line 2', type: 'single_line_text_field'},
  {key: 'city', name: 'City', type: 'single_line_text_field'},
  {key: 'state', name: 'State', type: 'single_line_text_field'},
  {key: 'postal_code', name: 'Postal code', type: 'single_line_text_field'},
  {key: 'country', name: 'Country', type: 'single_line_text_field'},
  {key: 'country_code', name: 'Country code', type: 'single_line_text_field'},
  {key: 'latitude', name: 'Latitude', type: 'number_decimal'},
  {key: 'longitude', name: 'Longitude', type: 'number_decimal'},
  {key: 'phones', name: 'Phones', type: 'json'},
  {key: 'emails', name: 'Emails', type: 'json'},
  {key: 'websites', name: 'Websites', type: 'json'},
  {key: 'description', name: 'Description', type: 'multi_line_text_field'},
  {key: 'image_urls', name: 'Image URLs', type: 'json'},
  {key: 'button_url', name: 'Button URL', type: 'url'},
  {key: 'type', name: 'Location type', type: 'single_line_text_field'},
  {key: 'published', name: 'Published', type: 'boolean'},
  {key: 'opening_hours', name: 'Opening hours', type: 'json'},
  {key: 'custom_values', name: 'Custom values', type: 'json'},
  {key: 'product_ids', name: 'Product IDs', type: 'json'},
  {key: 'tags', name: 'Tags', type: 'json'},
];

const settingsFields: FieldDefinition[] = [
  {key: 'map_provider', name: 'Map provider', type: 'single_line_text_field'},
  {key: 'map_style', name: 'Map style', type: 'single_line_text_field'},
  {key: 'default_latitude', name: 'Default latitude', type: 'number_decimal'},
  {key: 'default_longitude', name: 'Default longitude', type: 'number_decimal'},
  {key: 'default_zoom', name: 'Default zoom', type: 'number_decimal'},
  {key: 'search_radius', name: 'Search radius', type: 'number_integer'},
  {key: 'settings_json', name: 'Settings JSON', type: 'json'},
  {key: 'modal_config', name: 'Modal configuration', type: 'json'},
];

export async function ensureMetaobjectDefinition(shop: ShopifyShop, type: string, name: string, fields: FieldDefinition[]) {
  const existing = await adminGraphql<{metaobjectDefinitionByType: {id: string; type: string} | null}>(shop, DEFINITION_QUERY, {type});
  if (existing.metaobjectDefinitionByType) return existing.metaobjectDefinitionByType;
  const result = await adminGraphql<{metaobjectDefinitionCreate: {metaobjectDefinition: {id: string; type: string} | null; userErrors: Array<{message: string}>}}>(shop, DEFINITION_CREATE, {definition: {type, name, description: `Distributor Map ${name}`, access: {storefront: 'PUBLIC_READ'}, fieldDefinitions: fields}});
  if (result.metaobjectDefinitionCreate.userErrors.length || !result.metaobjectDefinitionCreate.metaobjectDefinition) throw new Error(result.metaobjectDefinitionCreate.userErrors.map((error) => error.message).join('; ') || `Unable to create ${type} definition`);
  return result.metaobjectDefinitionCreate.metaobjectDefinition;
}

export async function ensureDistributorDefinitions(shop: ShopifyShop) {
  await ensureMetaobjectDefinition(shop, LOCATION_TYPE, 'Retail location', locationFields);
  await ensureMetaobjectDefinition(shop, SETTINGS_TYPE, 'Retail locator settings', settingsFields);
}

export async function upsertMetaobject(shop: ShopifyShop, type: string, handle: string, values: Record<string, string>) {
  const result = await adminGraphql<{metaobjectUpsert: {metaobject: {id: string; handle: string} | null; userErrors: Array<{message: string}>}}>(shop, UPSERT, {handle: {type, handle}, values});
  if (result.metaobjectUpsert.userErrors.length || !result.metaobjectUpsert.metaobject) throw new Error(result.metaobjectUpsert.userErrors.map((error) => error.message).join('; ') || `Unable to upsert ${type}/${handle}`);
  return result.metaobjectUpsert.metaobject;
}

export function jsonValue(value: unknown) {
  return JSON.stringify(value ?? null);
}
