import {useState} from 'preact/hooks';
import {fetchWithIdToken} from '../lib/shopify.js';

const baseUrl = 'https://distributor-map-app.onrender.com/api/admin/import';

/**
 * @typedef {{row: number, valid: boolean, data?: Record<string, string>, errors?: string[]}} PreviewRow
 * @typedef {{total: number, valid: number, invalid: number, rows: PreviewRow[]}} PreviewResult
 */

const MAX_IMAGES_PER_ROW = 5;

/** @param {string} url @returns {Promise<string>} Shopify CDN URL, or the original URL if the upload fails */
const uploadToFiles = async (url) => {
  try {
    const created = await shopify.query(`
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files { id fileStatus ... on MediaImage { image { url } } ... on GenericFile { url } }
          userErrors { field message }
        }
      }`, {variables: {files: [{originalSource: url, contentType: 'IMAGE'}]}});
    const file = /** @type {any} */ (created.data)?.fileCreate?.files?.[0];
    if (!file?.id) return url;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (file.fileStatus === 'READY') return file.image?.url ?? file.url ?? url;
      if (file.fileStatus === 'FAILED') return url;
      await new Promise((resolve) => setTimeout(resolve, 750));
      const polled = await shopify.query(`
        query fileStatus($id: ID!) {
          node(id: $id) { ... on File { id fileStatus } ... on MediaImage { image { url } } ... on GenericFile { url } }
        }`, {variables: {id: file.id}});
      const node = /** @type {any} */ (polled.data)?.node;
      if (node) Object.assign(file, node);
    }
    return url;
  } catch {
    return url;
  }
};

export default function ImportPage() {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(/** @type {PreviewResult | null} */ (null));
  const [uploadImages, setUploadImages] = useState(true);
  const [state, setState] = useState({loading: false, error: '', imported: 0, status: ''});

  /** @param {File | undefined} file */
  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    setState({loading: true, error: '', imported: 0, status: ''});
    try {
      const csv = await file.text();
      const response = await fetchWithIdToken(`${baseUrl}/preview`, {method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json'}, body: JSON.stringify({csv})});
      if (!response.ok) throw new Error(`Preview failed (${response.status})`);
      setPreview(await response.json());
    } catch (error) {
      setState((current) => ({...current, error: error instanceof Error ? error.message : 'Unable to preview CSV'}));
    } finally {
      setState((current) => ({...current, loading: false}));
    }
  };

  const confirmImport = async () => {
    if (!preview) return;
    const rows = preview.rows.filter((row) => row.valid).map((row) => ({...(row.data ?? {})}));
    if (!rows.length) return;
    setState({loading: true, error: '', imported: 0, status: ''});
    try {
      if (uploadImages) {
        const total = rows.reduce((count, row) => count + [row.image_url, ...(row.image_urls ? row.image_urls.split('|') : [])].filter((url) => (url ?? '').trim()).length, 0);
        let done = 0;
        for (const row of rows) {
          const urls = [row.image_url, ...(row.image_urls ? row.image_urls.split('|') : [])].map((url) => (url ?? '').trim()).filter(Boolean).slice(0, MAX_IMAGES_PER_ROW);
          const uploaded = [];
          for (const url of urls) {
            done += 1;
            setState((current) => ({...current, status: `Uploading image ${done} of ${total} to Shopify Files…`}));
            uploaded.push(await uploadToFiles(url));
          }
          row.image_url = uploaded[0] ?? '';
          row.image_urls = uploaded.slice(1).join('|');
        }
        setState((current) => ({...current, status: 'Creating locations…'}));
      }
      const response = await fetchWithIdToken(`${baseUrl}/confirm`, {method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json'}, body: JSON.stringify({rows})});
      if (!response.ok) throw new Error(`Import failed (${response.status})`);
      const payload = await response.json();
      setState({loading: false, error: '', imported: payload?.imported ?? 0, status: ''});
      setPreview(null);
    } catch (error) {
      setState({loading: false, error: error instanceof Error ? error.message : 'Unable to import CSV', imported: 0, status: ''});
    }
  };

  const invalidRows = preview?.rows.filter((row) => !row.valid) ?? [];

  return (
    <s-page heading="Import locations">
      <s-section heading="CSV file">
        {state.imported > 0 && <s-banner tone="success" heading="Import complete">{state.imported} locations were imported. <s-link href="/locations">View locations</s-link></s-banner>}
        {state.error && <s-banner tone="critical" heading="Import failed">{state.error}</s-banner>}
        <s-paragraph>Required columns: name, address, city, postal_code, country. Optional: address2, state, latitude, longitude, phone, email, website, type, description, image_url, image_urls (separate multiple URLs with |), button_url.</s-paragraph>
        <s-checkbox label="Upload images to Shopify Files (Content → Files)" checked={uploadImages} onChange={(event) => setUploadImages(event.currentTarget.checked)}></s-checkbox>
        <s-drop-zone label="Drop a CSV file here or click to browse" accept=".csv,text/csv" onChange={(event) => handleFile(event.currentTarget.files?.[0])}></s-drop-zone>
        {state.loading && <s-spinner accessibilityLabel="Processing CSV" />}
        {state.status && <s-paragraph>{state.status}</s-paragraph>}
      </s-section>
      {preview && (
        <s-section heading={`Preview: ${fileName}`}>
          <s-paragraph>{preview.valid} of {preview.total} rows are valid and ready to import. {preview.invalid > 0 ? `${preview.invalid} rows have errors and will be skipped.` : ''}</s-paragraph>
          {invalidRows.length > 0 && (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Row</s-table-header>
                <s-table-header>Errors</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {invalidRows.slice(0, 20).map((row) => (
                  <s-table-row key={row.row}>
                    <s-table-cell>{row.row}</s-table-cell>
                    <s-table-cell>{(row.errors ?? []).join('; ')}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
          <s-stack direction="inline" gap="base">
            <s-button type="button" variant="primary" disabled={!preview.valid || state.loading} loading={state.loading} onClick={() => void confirmImport()}>Import {preview.valid} locations</s-button>
            <s-button type="button" href="/locations">Cancel</s-button>
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}
