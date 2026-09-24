import {useState} from 'preact/hooks';

/**
 * @typedef {Object} LocationFormValues
 * @property {string} name
 * @property {string} description
 * @property {string[]} imageUrls
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
  imageUrls: [],
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
 * @param {{form: LocationFormValues, onChange: (field: keyof LocationFormValues, value: string | boolean | string[]) => void, filesUrl?: string, disabled?: boolean}} props
 */
export default function LocationForm({form, onChange, filesUrl = '', disabled = false}) {
  const [imageInput, setImageInput] = useState('');

  /** @param {keyof LocationFormValues} field @returns {(event: Event) => void} */
  const update = (field) => (event) => onChange(field, /** @type {HTMLInputElement} */ (event.currentTarget).value);

  const addImage = () => {
    const url = imageInput.trim();
    if (!url || form.imageUrls.includes(url)) return;
    onChange('imageUrls', [...form.imageUrls, url]);
    setImageInput('');
  };

  /** @param {number} index */
  const removeImage = (index) => onChange('imageUrls', form.imageUrls.filter((_, item) => item !== index));

  return (
    <div>
      <s-section heading="Storefront display">
        <s-text-field label="Title" value={form.name} onInput={update('name')} required disabled={disabled}></s-text-field>
        <s-text-area label="Description" value={form.description} rows={4} maxLength={5000} onInput={update('description')} disabled={disabled}></s-text-area>
        <s-url-field label="Button link (defaults to Google Maps directions)" value={form.buttonUrl} placeholder="https://…" onInput={update('buttonUrl')} disabled={disabled}></s-url-field>
      </s-section>
      <s-section heading="Images">
        <s-paragraph>
          Add one or more images shown in the storefront location modal.
          {filesUrl ? <span> Copy a file URL from <s-link href={filesUrl} target="_blank">Content → Files</s-link> and paste it below.</span> : null}
        </s-paragraph>
        {form.imageUrls.length > 0 && (
          <s-stack direction="inline" gap="base">
            {form.imageUrls.map((url, index) => (
              <s-box key={url}>
                <s-thumbnail src={url} alt={`Location image ${index + 1}`} size="large"></s-thumbnail>
                <s-button type="button" variant="tertiary" onClick={() => removeImage(index)} disabled={disabled}>Remove</s-button>
              </s-box>
            ))}
          </s-stack>
        )}
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="end">
          <s-url-field label="Image URL" value={imageInput} placeholder="https://cdn.shopify.com/…" onInput={(event) => setImageInput(event.currentTarget.value)} disabled={disabled}></s-url-field>
          <s-button type="button" onClick={addImage} disabled={disabled || !imageInput.trim()}>Add image</s-button>
        </s-grid>
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
