'use client';

import {useCallback, useEffect, useState} from 'react';
import {authenticatedFetch} from '@shopify/app-bridge/utilities';
import {Provider, useAppBridge} from '@shopify/app-bridge-react';

type Location = {
  id: string;
  name: string;
  city: string;
  country: string;
  type: string;
  published: boolean;
  latitude: number | null;
  longitude: number | null;
  updatedAt: string;
};

type LocationResponse = {items: Location[]; total: number; page: number; pageSize: number};

function EmbeddedLocations() {
  const app = useAppBridge();
  const [data, setData] = useState<LocationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchWithToken = authenticatedFetch(app);
      const response = await fetchWithToken('/api/admin/locations');
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setData((await response.json()) as LocationResponse);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load locations');
    } finally {
      setLoading(false);
    }
  }, [app]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return <LocationsView data={data} error={error} loading={loading} reload={load} />;
}

function LocationsView({
  data,
  error,
  loading,
  reload,
}: {
  data: LocationResponse | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}) {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Locations</p>
          <h1>Retail network</h1>
        </div>
        <a className="button" href="/locations/new">Add location</a>
      </header>
      {loading && <p className="hero-copy">Loading locations…</p>}
      {error && <p className="error-message">{error}</p>}
      {!loading && !error && (
        <section className="table-card">
          <div className="table-toolbar"><strong>{data?.total ?? 0} locations</strong><button type="button" onClick={() => void reload()}>Refresh</button></div>
          {data?.items.length ? (
            <div className="location-table">
              {data.items.map((location) => (
                <div className="location-row" key={location.id}>
                  <div><strong>{location.name}</strong><span>{location.city}, {location.country}</span></div>
                  <span>{location.type}</span>
                  <span className={location.published ? 'badge badge--published' : 'badge'}>{location.published ? 'Published' : 'Draft'}</span>
                  <span>{location.latitude != null && location.longitude != null ? 'Located' : 'Needs coordinates'}</span>
                </div>
              ))}
            </div>
          ) : <p className="hero-copy">No locations have been added yet.</p>}
        </section>
      )}
    </main>
  );
}

export function LocationsClient({host}: {host: string | null}) {
  if (!host) {
    return <LocationsView data={null} error="Open Distributor Map from your Shopify admin to load locations." loading={false} reload={async () => undefined} />;
  }

  return (
    <Provider config={{apiKey: process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID ?? '', host, forceRedirect: true}}>
      <EmbeddedLocations />
    </Provider>
  );
}
