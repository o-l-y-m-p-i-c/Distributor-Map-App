import {createHash} from 'node:crypto';
import {prisma} from '@/lib/db/client';
import {getEnv} from '@/lib/config/env';

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function addressHash(address: string) {
  return createHash('sha256').update(normalize(address)).digest('hex');
}

type GeocodeResult = {latitude: number; longitude: number; formattedAddress: string; rawResponse: unknown};

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const hash = addressHash(address);
  const provider = getEnv().GEOCODER_URL;
  const cached = await prisma.geocodingCache.findUnique({where: {addressHash_provider: {addressHash: hash, provider}}});
  if (cached) {
    return {latitude: Number(cached.latitude), longitude: Number(cached.longitude), formattedAddress: cached.formattedAddress, rawResponse: cached.rawResponse};
  }

  const url = new URL('/search', provider.endsWith('/') ? provider : `${provider}/`);
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  const response = await fetch(url, {headers: {'user-agent': 'DistributorMap/1.0 contact@distributor-map.app'}, cache: 'no-store'});
  if (!response.ok) throw new Error(`Geocoder request failed (${response.status})`);
  const results = (await response.json()) as Array<{lat: string; lon: string; display_name: string}>;
  const first = results[0];
  if (!first) return null;

  const result = {latitude: Number(first.lat), longitude: Number(first.lon), formattedAddress: first.display_name, rawResponse: first};
  await prisma.geocodingCache.create({data: {addressHash: hash, provider, latitude: result.latitude, longitude: result.longitude, formattedAddress: result.formattedAddress, rawResponse: result.rawResponse}});
  return result;
}
