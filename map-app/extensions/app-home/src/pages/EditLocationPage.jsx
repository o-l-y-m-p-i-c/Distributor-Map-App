import {useEffect, useState} from 'preact/hooks';
import {useRoute} from 'preact-iso';
import LocationForm, {createEmptyForm, serializeForm} from '../components/LocationForm.jsx';
import {fetchWithIdToken} from '../lib/shopify.js';

const apiUrl = 'https://distributor-map-app.onrender.com/api/admin/locations';

/** @type {(Exclude<keyof import('../components/LocationForm.jsx').LocationFormValues, 'published' | 'imageUrls'>)[]} */
const textFields = ['name', 'description', 'buttonUrl', 'phone', 'email', 'website', 'addressLine1', 'city', 'postalCode', 'country', 'countryCode', 'type'];

export default function EditLocationPage() {
  const {params} = useRoute();
  const id = params?.id;
  const [form, setForm] = useState(createEmptyForm());
  const [state, setState] = useState({loading: true, saving: false, error: '', success: false});

  useEffect(() => {
    if (!id) return;
    fetchWithIdToken(`${apiUrl}/${id}`, {headers: {accept: 'application/json'}})
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json();
      })
      .then((payload) => {
        const location = payload?.location ?? {};
        setForm((current) => {
          const next = {...current, published: Boolean(location.published), imageUrls: Array.isArray(location.imageUrls) ? location.imageUrls : location.imageUrl ? [location.imageUrl] : []};
          for (const field of textFields) next[field] = location[field] ?? '';
          return next;
        });
        setState({loading: false, saving: false, error: '', success: false});
      })
      .catch((requestError) => setState({loading: false, saving: false, error: requestError instanceof Error ? requestError.message : 'Unable to load location', success: false}));
  }, [id]);

  /** @param {keyof import('../components/LocationForm.jsx').LocationFormValues} field @param {string | boolean | string[]} value */
  const update = (field, value) => setForm((current) => ({...current, [field]: value}));

  const submit = async () => {
    if (!id) return;
    setState((current) => ({...current, saving: true, error: '', success: false}));
    try {
      const response = await fetchWithIdToken(`${apiUrl}/${id}`, {method: 'PUT', headers: {'content-type': 'application/json', accept: 'application/json'}, body: JSON.stringify(serializeForm(form))});
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setState({loading: false, saving: false, error: '', success: true});
    } catch (error) {
      setState((current) => ({...current, saving: false, error: error instanceof Error ? error.message : 'Unable to save location', success: false}));
    }
  };

  return (
    <s-page heading="Edit location">
      {state.success && <s-banner tone="success" heading="Location saved">Changes were saved to your Distributor Map database.</s-banner>}
      {state.error && <s-banner tone="critical" heading="Could not load or save location">{state.error}</s-banner>}
      {state.loading && <s-spinner accessibilityLabel="Loading location" />}
      {!state.loading && !state.error && (
        <div>
          <LocationForm form={form} onChange={update} disabled={state.saving} />
          <s-stack direction="inline" gap="base">
            <s-button type="button" variant="primary" loading={state.saving} onClick={() => void submit()}>Save changes</s-button>
            <s-button type="button" href="/locations">Back to locations</s-button>
          </s-stack>
        </div>
      )}
    </s-page>
  );
}
