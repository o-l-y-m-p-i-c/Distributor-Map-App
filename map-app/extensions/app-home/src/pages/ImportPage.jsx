import {useState} from 'preact/hooks';
import {fetchWithIdToken} from '../lib/shopify.js';

const baseUrl = 'https://distributor-map-app.onrender.com/api/admin/import';

/**
 * @typedef {{row: number, valid: boolean, data?: Record<string, string>, errors?: string[]}} PreviewRow
 * @typedef {{total: number, valid: number, invalid: number, rows: PreviewRow[]}} PreviewResult
 */

const MAX_IMAGES_PER_ROW = 5;
const FILE_POLL_ATTEMPTS = 90;
const FILE_POLL_INTERVAL_MS = 1000;

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {string} url
 * @returns {Promise<{url: string, uploaded: boolean, error?: string}>} Shopify CDN URL, or the original URL with the failure reason
 */
const uploadToFiles = async (url) => {
  try {
    const created = await shopify.query(`
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files { id fileStatus ... on MediaImage { image { url } } ... on GenericFile { url } }
          userErrors { field message }
        }
      }`, {variables: {files: [{originalSource: url, contentType: 'IMAGE'}]}});
    const payload = /** @type {any} */ (created.data)?.fileCreate;
    const file = payload?.files?.[0];
    if (!file?.id) {
      const reason = payload?.userErrors?.map((/** @type {any} */ error) => error.message).join('; ') || /** @type {any} */ (created.errors)?.[0]?.message || 'fileCreate returned no file';
      return {url, uploaded: false, error: reason};
    }
    for (let attempt = 0; attempt < FILE_POLL_ATTEMPTS; attempt += 1) {
      const cdnUrl = file.image?.url ?? file.url;
      if (file.fileStatus === 'READY' && cdnUrl) return {url: cdnUrl, uploaded: true};
      if (file.fileStatus === 'FAILED') return {url, uploaded: false, error: 'Shopify could not fetch or process this URL'};
      await sleep(FILE_POLL_INTERVAL_MS);
      const polled = await shopify.query(`
        query fileStatus($id: ID!) {
          node(id: $id) { ... on File { id fileStatus } ... on MediaImage { image { url } } ... on GenericFile { url } }
        }`, {variables: {id: file.id}});
      const node = /** @type {any} */ (polled.data)?.node;
      if (node) Object.assign(file, node);
    }
    return {url, uploaded: false, error: 'timed out while Shopify processed the file'};
  } catch (error) {
    return {url, uploaded: false, error: error instanceof Error ? error.message : 'upload failed'};
  }
};

export default function ImportPage() {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(/** @type {PreviewResult | null} */ (null));
  const [uploadImages, setUploadImages] = useState(true);
  const [state, setState] = useState({loading: false, error: '', imported: 0, status: '', warnings: /** @type {string[]} */ ([])});

  /** @param {File | undefined} file */
  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    setState({loading: true, error: '', imported: 0, status: '', warnings: []});
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
    setState({loading: true, error: '', imported: 0, status: '', warnings: []});
    try {
      if (uploadImages) {
        const total = rows.reduce((count, row) => count + [row.image_url, ...(row.image_urls ? row.image_urls.split('|') : [])].filter((url) => (url ?? '').trim()).length, 0);
        const cache = new Map();
        const failures = /** @type {string[]} */ ([]);
        let done = 0;
        for (const row of rows) {
          const urls = [row.image_url, ...(row.image_urls ? row.image_urls.split('|') : [])].map((url) => (url ?? '').trim()).filter(Boolean).slice(0, MAX_IMAGES_PER_ROW);
          const uploaded = [];
          for (const url of urls) {
            done += 1;
            setState((current) => ({...current, status: `Uploading image ${done} of ${total} to Shopify Files…`}));
            if (!cache.has(url)) cache.set(url, await uploadToFiles(url));
            const result = cache.get(url);
            if (!result.uploaded) failures.push(`${url} (${result.error ?? 'unknown error'})`);
            uploaded.push(result.url);
          }
          row.image_url = uploaded[0] ?? '';
          row.image_urls = uploaded.slice(1).join('|');
        }
        setState((current) => ({...current, status: 'Creating locations…', warnings: failures}));
      }
      const response = await fetchWithIdToken(`${baseUrl}/confirm`, {method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json'}, body: JSON.stringify({rows})});
      if (!response.ok) throw new Error(`Import failed (${response.status})`);
      const payload = await response.json();
      setState((current) => ({loading: false, error: '', imported: payload?.imported ?? 0, status: '', warnings: current.warnings ?? []}));
      setPreview(null);
    } catch (error) {
      setState((current) => ({loading: false, error: error instanceof Error ? error.message : 'Unable to import CSV', imported: 0, status: '', warnings: current.warnings ?? []}));
    }
  };

  const invalidRows = preview?.rows.filter((row) => !row.valid) ?? [];

  return (
    <s-page heading="Import locations">
      <s-section heading="CSV file">
        {state.imported > 0 && <s-banner tone="success" heading="Import complete">{state.imported} locations were imported. <s-link href="/locations">View locations</s-link></s-banner>}
        {state.warnings.length > 0 && (
          <s-banner tone="warning" heading={`${state.warnings.length} image(s) kept their original URLs`}>
            Shopify Files could not process these sources, so the original links were saved instead: {state.warnings.slice(0, 10).join(' | ')}
          </s-banner>
        )}
        {state.error && <s-banner tone="critical" heading="Import failed">{state.error}</s-banner>}
        <s-paragraph>Required columns: name, address, city, postal_code, country. Optional: address2, state, latitude, longitude, phone, phones, email, emails, website, websites (separate multiple values with |), type, description, image_url, image_urls, button_url.</s-paragraph>
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
