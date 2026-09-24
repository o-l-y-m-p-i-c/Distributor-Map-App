import {useEffect, useState} from 'preact/hooks';
import LocationForm, {createEmptyForm, serializeForm} from '../components/LocationForm.jsx';
import {fetchWithIdToken, getFilesUrl} from '../lib/shopify.js';

const apiUrl = 'https://distributor-map-app.onrender.com/api/admin/locations';

export default function NewLocationPage() {
  const [form, setForm] = useState(createEmptyForm());
  const [filesUrl, setFilesUrl] = useState('');
  const [state, setState] = useState({loading: false, error: '', success: false, geocoded: true});

  useEffect(() => {
    void getFilesUrl().then(setFilesUrl);
  }, []);

  /** @param {keyof import('../components/LocationForm.jsx').LocationFormValues} field @param {string | boolean | string[]} value */
  const update = (field, value) => setForm((current) => ({...current, [field]: value}));

  const submit = async () => {
    setState({loading: true, error: '', success: false, geocoded: true});
    try {
      const slug = form.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const response = await fetchWithIdToken(apiUrl, {method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json'}, body: JSON.stringify({...serializeForm(form), name: form.name, slug})});
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const payload = await response.json();
      setState({loading: false, error: '', success: true, geocoded: Boolean(payload?.geocoded)});
      setForm(createEmptyForm());
    } catch (error) {
      setState({loading: false, error: error instanceof Error ? error.message : 'Unable to create location', success: false, geocoded: true});
    }
  };

  return (
    <s-page heading="Add location">
      {state.success && (
        <s-banner tone="success" heading="Location created">
          {state.geocoded ? 'The address was located on the map automatically.' : 'Saved, but the address could not be geocoded yet. Edit the location to add coordinates.'}
        </s-banner>
      )}
      {state.error && <s-banner tone="critical" heading="Could not create location">{state.error}</s-banner>}
      <LocationForm form={form} onChange={update} filesUrl={filesUrl} disabled={state.loading} />
      <s-button type="button" variant="primary" loading={state.loading} onClick={() => void submit()}>Create location</s-button>
    </s-page>
  );
}
