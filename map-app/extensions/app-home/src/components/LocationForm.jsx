import {useState} from 'preact/hooks';

/**
 * @typedef {Object} LocationFormValues
 * @property {string} name
 * @property {string} description
 * @property {string[]} imageUrls
 * @property {string} buttonUrl
 * @property {string[]} phones
 * @property {string[]} emails
 * @property {string[]} websites
 * @property {string} addressLine1
 * @property {string} city
 * @property {string} postalCode
 * @property {string} country
 * @property {string} countryCode
 * @property {string} type
 * @property {boolean} published
 */

/** @typedef {{id: string, url: string, alt: string}} LibraryImage */

/** @returns {LocationFormValues} */
export const createEmptyForm = () => {
  /** @type {LocationFormValues} */
  const form = {
    name: '',
    description: '',
    imageUrls: Array(),
    buttonUrl: '',
    phones: Array(),
    emails: Array(),
    websites: Array(),
    addressLine1: '',
    city: '',
    postalCode: '',
    country: '',
    countryCode: '',
    type: 'store',
    published: false,
  };
  return form;
};

/** @param {string | null | undefined} value @returns {string | null} */
const normalizeUrl = (value) => {
  const trimmed = (value ?? '').trim();
  return /^https?:\/\//.test(trimmed) ? trimmed : null;
};

/** @param {LocationFormValues} form @returns {Record<string, unknown>} */
export const serializeForm = (form) => {
  /** @type {Record<string, unknown>} */
  const payload = {...form};
  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim() === '') payload[key] = null;
  }
  payload.websites = form.websites.map(normalizeUrl).filter((url) => url != null);
  payload.buttonUrl = normalizeUrl(form.buttonUrl);
  payload.imageUrls = form.imageUrls.map(normalizeUrl).filter((url) => url != null);
  return payload;
};

const FILES_QUERY = `
  query locationLibraryImages($first: Int!, $after: String) {
    files(first: $first, after: $after, query: "media_type:IMAGE") {
      edges {
        node {
          ... on MediaImage { id image { url altText } }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;

/**
 * Repeatable text list: existing values as removable chips + input + Add button.
 * @param {{label: string, values: string[], onChange: (values: string[]) => void, placeholder?: string, disabled?: boolean}} props
 */
function TextListField({label, values, onChange, placeholder = '', disabled = false}) {
  const [input, setInput] = useState('');

  const add = () => {
    const value = input.trim();
    if (!value || values.includes(value)) return;
    onChange([...values, value]);
    setInput('');
  };

  return (
    <div>
      {values.length > 0 && (
        <s-stack direction="inline" gap="small">
          {values.map((value, index) => (
            <s-stack key={value} direction="inline" gap="none" alignItems="center">
              <s-text>{value}</s-text>
              <s-button type="button" variant="tertiary" icon="x" accessibilityLabel={`Remove ${value}`} onClick={() => onChange(values.filter((_, item) => item !== index))} disabled={disabled}></s-button>
            </s-stack>
          ))}
        </s-stack>
      )}
      <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="end">
        <s-text-field label={label} value={input} placeholder={placeholder} onInput={(event) => setInput(event.currentTarget.value)} disabled={disabled}></s-text-field>
        <s-button type="button" onClick={add} disabled={disabled || !input.trim()}>Add</s-button>
      </s-grid>
    </div>
  );
}

/**
 * @param {{form: LocationFormValues, onChange: (field: keyof LocationFormValues, value: string | boolean | string[]) => void, disabled?: boolean}} props
 */
export default function LocationForm({form, onChange, disabled = false}) {
  const [imageInput, setImageInput] = useState('');
  const [library, setLibrary] = useState(/** @type {LibraryImage[]} */ ([]));
  const [libraryCursor, setLibraryCursor] = useState(/** @type {string | null} */ (null));
  const [libraryHasMore, setLibraryHasMore] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [librarySelected, setLibrarySelected] = useState(/** @type {Set<string>} */ (new Set()));

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

  /** @param {string | null} [after] */
  const loadLibrary = async (after = null) => {
    setLibraryLoading(true);
    setLibraryError('');
    try {
      // @ts-ignore - shopify.query is injected by embedded app direct API access
      const result = await shopify.query(FILES_QUERY, {variables: {first: 24, after}});
      if (result.errors?.length) throw new Error(result.errors[0].message);
      const files = /** @type {any} */ (result.data)?.files;
      const items = (files?.edges ?? [])
        .map(/** @param {any} edge */ (edge) => edge?.node)
        .filter(/** @param {any} node */ (node) => node?.image?.url)
        .map(/** @param {any} node */ (node) => ({id: node.id, url: node.image.url, alt: node.image.altText ?? ''}));
      setLibrary((current) => after ? [...current, ...items] : items);
      setLibraryCursor(files?.pageInfo?.endCursor ?? null);
      setLibraryHasMore(Boolean(files?.pageInfo?.hasNextPage));
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : 'Could not load files');
    } finally {
      setLibraryLoading(false);
    }
  };

  /** @param {string} id */
  const toggleLibraryImage = (id) => setLibrarySelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const addLibrarySelection = () => {
    const urls = library.filter((file) => librarySelected.has(file.id)).map((file) => file.url).filter((url) => !form.imageUrls.includes(url));
    if (urls.length) onChange('imageUrls', [...form.imageUrls, ...urls]);
    setLibrarySelected(new Set());
  };

  return (
    <div>
      <s-section heading="Storefront display">
        <s-text-field label="Title" value={form.name} onInput={update('name')} required disabled={disabled}></s-text-field>
        <s-text-area label="Description" value={form.description} rows={4} maxLength={5000} onInput={update('description')} disabled={disabled}></s-text-area>
        <s-url-field label="Button link (defaults to Google Maps directions)" value={form.buttonUrl} placeholder="https://…" onInput={update('buttonUrl')} disabled={disabled}></s-url-field>
      </s-section>
      <s-section heading="Images">
        <s-paragraph>Select images from your Shopify Files library, or paste an image URL. They appear in the storefront location modal.</s-paragraph>
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
        <s-stack direction="inline" gap="base">
          <s-button type="button" commandFor="dm-image-picker" command="--show" onClick={() => { if (!library.length && !libraryLoading) void loadLibrary(); }} disabled={disabled}>Select from library</s-button>
        </s-stack>
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="end">
          <s-url-field label="Image URL" value={imageInput} placeholder="https://cdn.shopify.com/…" onInput={(event) => setImageInput(event.currentTarget.value)} disabled={disabled}></s-url-field>
          <s-button type="button" onClick={addImage} disabled={disabled || !imageInput.trim()}>Add image</s-button>
        </s-grid>
      </s-section>
      <s-modal id="dm-image-picker" heading="Select images from Files">
        {libraryError && <s-banner tone="critical">{libraryError}</s-banner>}
        {libraryLoading && !library.length && <s-spinner accessibilityLabel="Loading files" />}
        {!libraryLoading && !library.length && !libraryError && <s-paragraph>No images found in Content → Files.</s-paragraph>}
        <s-grid gridTemplateColumns="repeat(4, 1fr)" gap="small">
          {library.map((file) => (
            <s-clickable key={file.id} onClick={() => toggleLibraryImage(file.id)}>
              <s-thumbnail src={file.url} alt={file.alt || 'Library image'} size="large"></s-thumbnail>
              {librarySelected.has(file.id) && <s-badge tone="success">Selected</s-badge>}
            </s-clickable>
          ))}
        </s-grid>
        {libraryHasMore && <s-button type="button" loading={libraryLoading} onClick={() => void loadLibrary(libraryCursor)}>Load more</s-button>}
        <s-button slot="secondary-actions" commandFor="dm-image-picker" command="--hide">Cancel</s-button>
        <s-button slot="primary-action" variant="primary" commandFor="dm-image-picker" command="--hide" onClick={addLibrarySelection} disabled={!librarySelected.size}>Add selected</s-button>
      </s-modal>
      <s-section heading="Address">
        <s-text-field label="Address" value={form.addressLine1} onInput={update('addressLine1')} required disabled={disabled}></s-text-field>
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <s-text-field label="City" value={form.city} onInput={update('city')} required disabled={disabled}></s-text-field>
          <s-text-field label="Postal code" value={form.postalCode} onInput={update('postalCode')} required disabled={disabled}></s-text-field>
        </s-grid>
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <s-text-field label="Country" value={form.country} onInput={update('country')} required disabled={disabled}></s-text-field>
          <s-text-field label="Country code" value={form.countryCode} onInput={(event) => onChange('countryCode', event.currentTarget.value.toUpperCase())} required disabled={disabled}></s-text-field>
        </s-grid>
      </s-section>
      <s-section heading="Contact">
        <TextListField label="Phone number" values={form.phones} onChange={(values) => onChange('phones', values)} placeholder="+371 20000000" disabled={disabled} />
        <TextListField label="Email address" values={form.emails} onChange={(values) => onChange('emails', values)} placeholder="store@example.com" disabled={disabled} />
        <TextListField label="Website" values={form.websites} onChange={(values) => onChange('websites', values)} placeholder="https://…" disabled={disabled} />
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
