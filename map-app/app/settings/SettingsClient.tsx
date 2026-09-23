'use client';

import {useEffect, useState} from 'react';
import {authenticatedFetch} from '@shopify/app-bridge/utilities';
import {Provider, useAppBridge} from '@shopify/app-bridge-react';

type Settings = {searchRadius?: number; enableGeolocation?: boolean; showDirections?: boolean; showPhone?: boolean; showWebsite?: boolean; showOpeningHours?: boolean; primaryColor?: string; accentColor?: string};

function EmbeddedSettings() {
  const app = useAppBridge();
  const [settings, setSettings] = useState<Settings>({searchRadius: 50, enableGeolocation: true, showDirections: true, showPhone: true, showWebsite: true, showOpeningHours: true, primaryColor: '#176274', accentColor: '#4ca9ba'});
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const response = await authenticatedFetch(app)('/api/admin/settings');
      if (response.ok) setSettings((await response.json()) as Settings);
    };
    void load();
  }, [app]);

  const update = (key: keyof Settings, value: string | number | boolean) => setSettings((current) => ({...current, [key]: value}));
  const save = async () => {
    setMessage('Saving…');
    const response = await authenticatedFetch(app)('/api/admin/settings', {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify(settings)});
    setMessage(response.ok ? 'Saved' : 'Unable to save');
  };

  return (
    <main className="shell">
      <header className="topbar"><div><p className="eyebrow">Settings</p><h1>Store locator settings</h1></div><button className="button" type="button" onClick={() => void save()}>Save settings</button></header>
      <section className="table-card settings-form">
        <label>Search radius<select value={settings.searchRadius ?? 50} onChange={(event) => update('searchRadius', Number(event.target.value))}><option value="20">20 km</option><option value="50">50 km</option><option value="100">100 km</option><option value="200">200 km</option></select></label>
        <label className="setting-check"><input type="checkbox" checked={settings.enableGeolocation ?? true} onChange={(event) => update('enableGeolocation', event.target.checked)} /> Enable customer geolocation</label>
        <label className="setting-check"><input type="checkbox" checked={settings.showDirections ?? true} onChange={(event) => update('showDirections', event.target.checked)} /> Show directions</label>
        <label className="setting-check"><input type="checkbox" checked={settings.showPhone ?? true} onChange={(event) => update('showPhone', event.target.checked)} /> Show phone</label>
        <label className="setting-check"><input type="checkbox" checked={settings.showWebsite ?? true} onChange={(event) => update('showWebsite', event.target.checked)} /> Show website</label>
        <label className="setting-check"><input type="checkbox" checked={settings.showOpeningHours ?? true} onChange={(event) => update('showOpeningHours', event.target.checked)} /> Show opening hours</label>
        {message && <p className="hero-copy">{message}</p>}
      </section>
    </main>
  );
}

export function SettingsClient({host}: {host: string | null}) {
  if (!host) return <main className="shell"><p className="eyebrow">Settings</p><h1>Open Distributor Map from Shopify admin</h1></main>;
  return <Provider config={{apiKey: process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID ?? '', host, forceRedirect: true}}><EmbeddedSettings /></Provider>;
}
