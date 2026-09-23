import {useState} from 'preact/hooks';

const apiUrl = 'https://distributor-map-app.onrender.com/api/admin/locations';

/** @typedef {{name: string, addressLine1: string, city: string, postalCode: string, country: string, countryCode: string, type: string, published: boolean}} LocationForm */

export default function NewLocationPage() {
  const [form, setForm] = useState({name: '', addressLine1: '', city: '', postalCode: '', country: '', countryCode: '', type: 'store', published: false});
  const [state, setState] = useState({loading: false, error: '', success: false});

  /** @param {keyof LocationForm} field @param {string | boolean} value */
  const update = (field, value) => setForm((current) => ({...current, [field]: value}));

  /** @param {SubmitEvent} event */
  const submit = async (event) => {
    event.preventDefault();
    setState({loading: true, error: '', success: false});
    try {
      const response = await fetch(apiUrl, {method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json'}, body: JSON.stringify({...form, slug: form.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')})});
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setState({loading: false, error: '', success: true});
      setForm({name: '', addressLine1: '', city: '', postalCode: '', country: '', countryCode: '', type: 'store', published: false});
    } catch (error) {
      setState({loading: false, error: error instanceof Error ? error.message : 'Unable to create location', success: false});
    }
  };

  return (
    <s-page heading="Add location">
      <s-section heading="Location details">
        {state.success && <s-banner tone="success" heading="Location created">The location was saved to your Distributor Map database.</s-banner>}
        {state.error && <s-banner tone="critical" heading="Could not create location">{state.error}</s-banner>}
        <form onSubmit={submit}>
          <s-text-field label="Store name" value={form.name} onInput={(event) => update('name', event.currentTarget.value)} required></s-text-field>
          <s-text-field label="Address" value={form.addressLine1} onInput={(event) => update('addressLine1', event.currentTarget.value)} required></s-text-field>
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            <s-text-field label="City" value={form.city} onInput={(event) => update('city', event.currentTarget.value)} required></s-text-field>
            <s-text-field label="Postal code" value={form.postalCode} onInput={(event) => update('postalCode', event.currentTarget.value)} required></s-text-field>
          </s-grid>
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            <s-text-field label="Country" value={form.country} onInput={(event) => update('country', event.currentTarget.value)} required></s-text-field>
            <s-text-field label="Country code" value={form.countryCode} onInput={(event) => update('countryCode', event.currentTarget.value.toUpperCase())} required></s-text-field>
          </s-grid>
          <s-select label="Location type" value={form.type} onChange={(event) => update('type', event.currentTarget.value)}>
            <s-option value="store">Store</s-option>
            <s-option value="retailer">Retailer</s-option>
            <s-option value="stockist">Stockist</s-option>
            <s-option value="distributor">Distributor</s-option>
            <s-option value="dealer">Dealer</s-option>
          </s-select>
          <s-checkbox label="Publish immediately" checked={form.published} onChange={(event) => update('published', event.currentTarget.checked)}></s-checkbox>
          <s-button type="submit" variant="primary" loading={state.loading}>Create location</s-button>
        </form>
      </s-section>
    </s-page>
  );
}
