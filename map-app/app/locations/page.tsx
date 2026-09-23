import {LocationsClient} from './LocationsClient';

type LocationsPageProps = {
  searchParams: Promise<{host?: string | string[]}>;
};

export default async function LocationsPage({searchParams}: LocationsPageProps) {
  const params = await searchParams;
  const host = Array.isArray(params.host) ? params.host[0] : params.host;
  return <LocationsClient host={host ?? null} />;
}
