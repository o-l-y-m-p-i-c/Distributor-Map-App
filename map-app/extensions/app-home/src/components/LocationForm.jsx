/**
 * @typedef {Object} LocationFormValues
 * @property {string} name
 * @property {string} description
 * @property {string} imageUrl
 * @property {string} buttonUrl
 * @property {string} phone
 * @property {string} email
 * @property {string} website
 * @property {string} addressLine1
 * @property {string} addressLine2
 * @property {string} city
 * @property {string} state
 * @property {string} postalCode
 * @property {string} country
 * @property {string} countryCode
 * @property {string} type
 * @property {boolean} published
 */

/** @returns {LocationFormValues} */
export const createEmptyForm = () => ({
  name: '',
  description: '',
  imageUrl: '',
  buttonUrl: '',
  phone: '',
  email: '',
  website: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  countryCode: '',
  type: 'store',
  published: false,
});

/** @param {LocationFormValues} form @returns {Record<string, unknown>} */
export const serializeForm = (form) => {
  /** @type {Record<string, unknown>} */
  const payload = {...form};
  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim() === '') payload[key] = null;
  }
  return payload;
};

/**
 * @param {{form: LocationFormValues, onChange: (field: keyof LocationFormValues, value: string | boolean) => void, disabled?: boolean}} props
 */
export default function LocationForm({form, onChange, disabled = false}) {
  /** @param {keyof LocationFormValues} field @returns {(event: Event) => void} */
  const update = (field) => (event) => onChange(field, /** @type {HTMLInputElement} */ (event.currentTarget).value);

  return (
    <div>
      <s-section heading="Storefront display">
        <s-text-field label="Title" value={form.name} onInput={update('name')} required disabled={disabled}></s-text-field>
        <s-text-area label="Description" value={form.description} rows={4} maxLength={5000} onInput={update('description')} disabled={disabled}></s-text-area>
        <s-url-field label="Image (asset URL)" value={form.imageUrl} placeholder="https://…" onInput={update('imageUrl')} disabled={disabled}></s-url-field>
        <s-url-field label="Button link (defaults to Google Maps directions)" value={form.buttonUrl} placeholder="https://…" onInput={update('buttonUrl')} disabled={disabled}></s-url-field>
      </s-section>
      <s-section heading="Address">
        <s-text-field label="Address" value={form.addressLine1} onInput={update('addressLine1')} required disabled={disabled}></s-text-field>
        <s-text-field label="Address line 2" value={form.addressLine2} onInput={update('addressLine2')} disabled={disabled}></s-text-field>
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <s-text-field label="City" value={form.city} onInput={update('city')} required disabled={disabled}></s-text-field>
          <s-text-field label="Postal code" value={form.postalCode} onInput={update('postalCode')} required disabled={disabled}></s-text-field>
        </s-grid>
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <s-text-field label="State / region" value={form.state} onInput={update('state')} disabled={disabled}></s-text-field>
          <s-text-field label="Country" value={form.country} onInput={update('country')} required disabled={disabled}></s-text-field>
        </s-grid>
        <s-text-field label="Country code" value={form.countryCode} onInput={(event) => onChange('countryCode', event.currentTarget.value.toUpperCase())} required disabled={disabled}></s-text-field>
      </s-section>
      <s-section heading="Contact">
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <s-text-field label="Phone" value={form.phone} onInput={update('phone')} disabled={disabled}></s-text-field>
          <s-email-field label="Email" value={form.email} onInput={update('email')} disabled={disabled}></s-email-field>
        </s-grid>
        <s-url-field label="Website" value={form.website} placeholder="https://…" onInput={update('website')} disabled={disabled}></s-url-field>
      </s-section>
      <s-section heading="Visibility">
        <s-select label="Location type" value={form.type} onChange={update('type')} disabled={disabled}>
          <s-option value="store">Store</s-option>
          <s-option value="retailer">Retailer</s-option>
          <s-option value="stockist">Stockist</s-option>
          <s-option value="distributor">Distributor</s-option>
          <s-option value="dealer">Dealer</s-option>
        </s-select>
        <s-checkbox label="Published on storefront" checked={form.published} onChange={(event) => onChange('published', event.currentTarget.checked)} disabled={disabled}></s-checkbox>
      </s-section>
    </div>
  );
}
