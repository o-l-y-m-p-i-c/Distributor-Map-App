import {SettingsClient} from './SettingsClient';

type SettingsPageProps = {searchParams: Promise<{host?: string | string[]}>};

export default async function SettingsPage({searchParams}: SettingsPageProps) {
  const params = await searchParams;
  const host = Array.isArray(params.host) ? params.host[0] : params.host;
  return <SettingsClient host={host ?? null} />;
}
