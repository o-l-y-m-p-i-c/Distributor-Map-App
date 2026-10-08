import {adminGraphqlWithToken} from '@/lib/shopify/admin-graphql';

export const LOCATION_TYPE = '$app:retail_location';

type MetaobjectNode = {id: string; handle: string; fields: Array<{key: string; value: string | null}>};
type LocationInput = {name: string; slug?: string; addressLine1: string; addressLine2?: string | null; city: string; state?: string | null; postalCode: string; country: string; countryCode: string; latitude?: number | null; longitude?: number | null; phones?: string[]; emails?: string[]; websites?: string[]; description?: string | null; imageUrls?: string[]; buttonUrl?: string | null; type?: string; published?: boolean; customValues?: Record<string, string>};

const LIST_QUERY = `query RetailLocations($type: String!) { metaobjects(type: $type, first: 250) { nodes { id handle fields { key value } } } }`;
const UPSERT_MUTATION = `mutation RetailLocationUpsert($handle: MetaobjectHandleInput!, $values: JSON!) { metaobjectUpsert(handle: $handle, values: $values) { metaobject { id handle fields { key value } } userErrors { field message code } } }`;
const DELETE_MUTATION = `mutation RetailLocationDelete($id: ID!) { metaobjectDelete(id: $id) { deletedId userErrors { field message code } } }`;

function parseValue(value: string | null) {
  if (value == null || value === '') return null;
  try { return JSON.parse(value); } catch { return value; }
}

export function parseLocation(node: MetaobjectNode) {
  const values = Object.fromEntries(node.fields.map((field) => [field.key, parseValue(field.value)]));
  return {
    id: node.id,
    externalId: values.external_id ?? node.handle,
    name: values.name ?? '',
    slug: values.slug ?? node.handle,
    addressLine1: values.address_line_1 ?? '',
    addressLine2: values.address_line_2 ?? null,
    city: values.city ?? '',
    state: values.state ?? null,
    postalCode: values.postal_code ?? '',
    country: values.country ?? '',
    countryCode: values.country_code ?? '',
    latitude: values.latitude == null || values.latitude === '' ? null : Number(values.latitude),
    longitude: values.longitude == null || values.longitude === '' ? null : Number(values.longitude),
    phones: Array.isArray(values.phones) ? values.phones : [],
    emails: Array.isArray(values.emails) ? values.emails : [],
    websites: Array.isArray(values.websites) ? values.websites : [],
    description: values.description ?? null,
    imageUrls: Array.isArray(values.image_urls) ? values.image_urls : [],
    buttonUrl: values.button_url ?? null,
    type: values.type ?? 'store',
    published: values.published === true || values.published === 'true',
    customValues: values.custom_values && typeof values.custom_values === 'object' ? values.custom_values : {},
  };
}

function jsonValue(value: unknown) {
  return JSON.stringify(value ?? null);
}

function locationValues(input: LocationInput) {
  return {
    external_id: input.slug ?? input.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'),
    name: input.name,
    slug: input.slug ?? input.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'),
    address_line_1: input.addressLine1,
    address_line_2: input.addressLine2 ?? '',
    city: input.city,
    state: input.state ?? '',
    postal_code: input.postalCode,
    country: input.country,
    country_code: input.countryCode,
    latitude: input.latitude == null ? '' : String(input.latitude),
    longitude: input.longitude == null ? '' : String(input.longitude),
    phones: jsonValue(input.phones ?? []),
    emails: jsonValue(input.emails ?? []),
    websites: jsonValue(input.websites ?? []),
    description: input.description ?? '',
    image_urls: jsonValue(input.imageUrls ?? []),
    button_url: input.buttonUrl ?? '',
    type: input.type ?? 'store',
    published: String(input.published ?? false),
    custom_values: jsonValue(input.customValues ?? {}),
  };
}

export async function listMetaobjectLocations(shopDomain: string, accessToken: string) {
  const data = await adminGraphqlWithToken<{metaobjects: {nodes: MetaobjectNode[]}}>(shopDomain, accessToken, LIST_QUERY, {type: LOCATION_TYPE});
  return data.metaobjects.nodes.map(parseLocation);
}

export async function upsertMetaobjectLocation(shopDomain: string, accessToken: string, input: LocationInput) {
  const values = locationValues(input);
  const handle = String(values.slug).replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 255);
  const data = await adminGraphqlWithToken<{metaobjectUpsert: {metaobject: MetaobjectNode | null; userErrors: Array<{message: string}>}}>(shopDomain, accessToken, UPSERT_MUTATION, {handle: {type: LOCATION_TYPE, handle}, values});
  if (data.metaobjectUpsert.userErrors.length || !data.metaobjectUpsert.metaobject) throw new Error(data.metaobjectUpsert.userErrors.map((error) => error.message).join('; ') || 'Unable to save Metaobject location');
  return parseLocation(data.metaobjectUpsert.metaobject);
}

export async function deleteMetaobjectLocation(shopDomain: string, accessToken: string, id: string) {
  const data = await adminGraphqlWithToken<{metaobjectDelete: {deletedId: string | null; userErrors: Array<{message: string}>}}>(shopDomain, accessToken, DELETE_MUTATION, {id});
  if (data.metaobjectDelete.userErrors.length || !data.metaobjectDelete.deletedId) throw new Error(data.metaobjectDelete.userErrors.map((error) => error.message).join('; ') || 'Unable to delete Metaobject location');
}
