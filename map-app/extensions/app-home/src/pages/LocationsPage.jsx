import {useEffect, useState} from 'preact/hooks';
import {useLocation} from 'preact-iso';
import {fetchWithIdToken} from '../lib/shopify.js';

const apiUrl = 'https://distributor-map-app.onrender.com/api/admin/locations';

/** @typedef {{id: string, name: string, city: string, country: string, type: string, published: boolean}} Location */
/** @typedef {{items?: Location[]}} LocationResponse */
/** @typedef {'publish' | 'unpublish' | 'delete'} BulkAction */

export default function LocationsPage() {
  const {route} = useLocation();
  const [locations, setLocations] = useState(/** @type {Location[]} */ ([]));
  const [selected, setSelected] = useState(/** @type {Set<string>} */ (new Set()));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(/** @type {string} */ (''));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    fetchWithIdToken(apiUrl, {headers: {accept: 'application/json'}})
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json();
      })
      .then(/** @param {LocationResponse} payload */ (payload) => setLocations(payload.items ?? []))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Unable to load locations'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const exportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      const response = await fetchWithIdToken('https://distributor-map-app.onrender.com/api/admin/export/locations.csv', {headers: {accept: 'text/csv'}});
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'locations.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to export locations');
    } finally {
      setExporting(false);
    }
  };

  /** @param {string} id @param {boolean} checked */
  const toggle = (id, checked) => setSelected((current) => {
    const next = new Set(current);
    if (checked) next.add(id); else next.delete(id);
    return next;
  });

  /** @param {boolean} checked */
  const toggleAll = (checked) => setSelected(checked ? new Set(locations.map((location) => location.id)) : new Set());

  /** @param {string[]} ids @param {BulkAction} action */
  const runBulk = async (ids, action) => {
    if (!ids.length) return;
    setBusy(action);
    setError('');
    try {
      const response = await fetchWithIdToken(`${apiUrl}/bulk`, {method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json'}, body: JSON.stringify({ids, action})});
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setSelected(new Set());
      load();
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : 'Unable to update locations');
    } finally {
      setBusy('');
    }
  };

  /** @param {Location} location */
  const togglePublished = (location) => void runBulk([location.id], location.published ? 'unpublish' : 'publish');

  const allSelected = locations.length > 0 && selected.size === locations.length;
  const selectedIds = [...selected];

  return (
    <s-page heading="Locations">
      <s-button slot="primary-action" variant="primary" href="/locations/new">Add location</s-button>
      <s-button slot="secondary-actions" commandFor="locations-actions">More actions</s-button>
      <s-menu id="locations-actions" accessibilityLabel="Location actions">
        <s-button icon="import" onClick={() => route('/locations/import')}>Import CSV</s-button>
        <s-button icon="export" loading={exporting} onClick={() => void exportCsv()}>Export CSV</s-button>
      </s-menu>
      <s-section heading="Retail network">
        <s-paragraph>Manage stores, retailers, stockists, distributors, and dealers for your storefront locator.</s-paragraph>
        {loading && <s-spinner accessibilityLabel="Loading locations" />}
        {error && <s-banner tone="critical" heading="Could not load locations">{error}</s-banner>}
        {!loading && !error && !locations.length && <s-banner tone="info" heading="No locations yet">Create your first location or import a CSV.</s-banner>}
        {!loading && !error && locations.length > 0 && (
          <div>
            {selected.size > 0 && (
              <s-stack direction="inline" gap="base" alignItems="center">
                <s-text>{selected.size} selected</s-text>
                <s-button type="button" loading={busy === 'publish'} onClick={() => void runBulk(selectedIds, 'publish')}>Publish</s-button>
                <s-button type="button" loading={busy === 'unpublish'} onClick={() => void runBulk(selectedIds, 'unpublish')}>Unpublish</s-button>
                <s-button type="button" tone="critical" commandFor="dm-delete-confirm" command="--show">Delete</s-button>
              </s-stack>
            )}
            <s-table>
              <s-table-header-row>
                <s-table-header><s-checkbox checked={allSelected} onChange={(event) => toggleAll(event.currentTarget.checked)} accessibilityLabel="Select all" /></s-table-header>
                <s-table-header listSlot="primary">Name</s-table-header>
                <s-table-header>City</s-table-header>
                <s-table-header>Type</s-table-header>
                <s-table-header>Status</s-table-header>
                <s-table-header>Actions</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {locations.map((location) => (
                  <s-table-row key={location.id}>
                    <s-table-cell><s-checkbox checked={selected.has(location.id)} onChange={(event) => toggle(location.id, event.currentTarget.checked)} accessibilityLabel={`Select ${location.name}`} /></s-table-cell>
                    <s-table-cell>{location.name}</s-table-cell>
                    <s-table-cell>{location.city}, {location.country}</s-table-cell>
                    <s-table-cell>{location.type}</s-table-cell>
                    <s-table-cell><s-badge tone={location.published ? 'success' : 'neutral'}>{location.published ? 'Published' : 'Draft'}</s-badge></s-table-cell>
                    <s-table-cell>
                      <s-stack direction="inline" gap="small" alignItems="center">
                        <s-link href={`/locations/edit/${location.id}`}>Edit</s-link>
                        <s-button type="button" variant="tertiary" disabled={busy !== ''} onClick={() => togglePublished(location)}>{location.published ? 'Unpublish' : 'Publish'}</s-button>
                      </s-stack>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          </div>
        )}
      </s-section>
      <s-modal id="dm-delete-confirm" heading="Delete locations">
        <s-paragraph>Permanently delete {selected.size} selected {selected.size === 1 ? 'location' : 'locations'}? This cannot be undone.</s-paragraph>
        <s-button slot="secondary-actions" commandFor="dm-delete-confirm" command="--hide">Cancel</s-button>
        <s-button slot="primary-action" variant="primary" tone="critical" commandFor="dm-delete-confirm" command="--hide" loading={busy === 'delete'} onClick={() => void runBulk(selectedIds, 'delete')}>Delete</s-button>
      </s-modal>
    </s-page>
  );
}
