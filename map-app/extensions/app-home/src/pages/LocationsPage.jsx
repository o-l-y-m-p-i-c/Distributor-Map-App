import {useEffect, useState} from 'preact/hooks';

const apiUrl = 'https://distributor-map-app.onrender.com/api/admin/locations';

export default function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(apiUrl, {headers: {accept: 'application/json'}})
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json();
      })
      .then((payload) => setLocations(payload.items ?? []))
      .catch((requestError) => setError(requestError.message || 'Unable to load locations'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <s-page heading="Locations">
      <s-button slot="primary-action" variant="primary" href="/locations/new">Add location</s-button>
      <s-section heading="Retail network">
        <s-paragraph>Manage stores, retailers, stockists, distributors, and dealers for your storefront locator.</s-paragraph>
        {loading && <s-spinner accessibilityLabel="Loading locations" />}
        {error && <s-banner tone="critical" heading="Could not load locations">{error}</s-banner>}
        {!loading && !error && !locations.length && <s-banner tone="info" heading="No locations yet">Create your first location in the full location manager.</s-banner>}
        {!loading && !error && locations.length > 0 && (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Name</s-table-header>
              <s-table-header>City</s-table-header>
              <s-table-header>Type</s-table-header>
              <s-table-header>Status</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {locations.map((location) => (
                <s-table-row key={location.id}>
                  <s-table-cell>{location.name}</s-table-cell>
                  <s-table-cell>{location.city}, {location.country}</s-table-cell>
                  <s-table-cell>{location.type}</s-table-cell>
                  <s-table-cell><s-badge tone={location.published ? 'success' : 'neutral'}>{location.published ? 'Published' : 'Draft'}</s-badge></s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}
