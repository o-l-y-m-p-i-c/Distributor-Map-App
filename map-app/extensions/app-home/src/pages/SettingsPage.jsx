import {useEffect, useState} from 'preact/hooks';
import {fetchWithIdToken, getIdToken} from '../lib/shopify.js';

const settingsUrl = 'https://distributor-map-app.onrender.com/api/admin/settings';
const constructorUrl = 'https://distributor-map-app.onrender.com/constructor';

const FIELD_TYPES = ['text', 'textarea', 'url', 'email', 'phone', 'number'];

const uid = () => Math.random().toString(36).slice(2, 10);

/** @typedef {{id: string, label: string, type: string}} CustomField */
/** @typedef {{id: string, title: string, fields: CustomField[]}} CustomSection */

export default function SettingsPage() {
  const [sections, setSections] = useState(/** @type {CustomSection[]} */ ([]));
  const [modalSummary, setModalSummary] = useState(/** @type {string} */ (''));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchWithIdToken(settingsUrl, {headers: {accept: 'application/json'}})
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json();
      })
      .then((payload) => {
        const nextSections = Array.isArray(payload?.customSections) ? payload.customSections : [];
        setSections(nextSections);
        const layout = payload?.modalConfig?.layout;
        const rows = Array.isArray(layout) ? layout.length : 0;
        const blocks = Array.isArray(layout)
          ? layout.reduce((/** @type {number} */ total, /** @type {any} */ row) => total + (row?.columns ?? []).reduce((/** @type {number} */ sum, /** @type {any} */ col) => sum + (col?.blocks ?? []).length, 0), 0)
          : 0;
        setModalSummary(rows ? `${rows} row${rows === 1 ? '' : 's'}, ${blocks} block${blocks === 1 ? '' : 's'} configured` : 'Default layout (single column)');
        setLoading(false);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load settings');
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const response = await fetchWithIdToken(settingsUrl, {method: 'PUT', headers: {'content-type': 'application/json', accept: 'application/json'}, body: JSON.stringify({customSections: sections})});
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };

  const openEditor = async () => {
    setOpening(true);
    setError('');
    try {
      const token = await getIdToken();
      const url = `${constructorUrl}?token=${encodeURIComponent(token)}`;
      if (typeof open === 'function') open(url, '_blank');
      else window.open(url, '_blank');
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Unable to open the layout editor');
    } finally {
      setOpening(false);
    }
  };

  /** @param {number} index @param {Partial<CustomSection>} patch */
  const patchSection = (index, patch) => setSections((current) => current.map((section, i) => (i === index ? {...section, ...patch} : section)));

  const addSection = () => setSections((current) => [...current, {id: uid(), title: 'New section', fields: []}]);
  /** @param {number} index */
  const removeSection = (index) => setSections((current) => current.filter((_, i) => i !== index));
  /** @param {number} index @param {number} delta */
  const moveSection = (index, delta) => setSections((current) => {
    const next = [...current];
    const target = index + delta;
    if (target < 0 || target >= next.length) return next;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  /** @param {number} sectionIndex */
  const addField = (sectionIndex) => setSections((current) => current.map((section, i) => (i === sectionIndex ? {...section, fields: [...section.fields, {id: uid(), label: 'New field', type: 'text'}]} : section)));

  /** @param {number} sectionIndex @param {number} fieldIndex @param {Partial<CustomField>} patch */
  const patchField = (sectionIndex, fieldIndex, patch) => setSections((current) => current.map((section, i) => (i === sectionIndex ? {...section, fields: section.fields.map((field, j) => (j === fieldIndex ? {...field, ...patch} : field))} : section)));

  /** @param {number} sectionIndex @param {number} fieldIndex */
  const removeField = (sectionIndex, fieldIndex) => setSections((current) => current.map((section, i) => (i === sectionIndex ? {...section, fields: section.fields.filter((_, j) => j !== fieldIndex)} : section)));

  return (
    <s-page heading="Settings">
      <s-button slot="primary-action" variant="primary" loading={saving} onClick={() => void save()}>Save settings</s-button>
      {saved && <s-banner tone="success" heading="Settings saved">Your storefront locator will use the new configuration.</s-banner>}
      {error && <s-banner tone="critical" heading="Settings error">{error}</s-banner>}
      {loading && <s-spinner accessibilityLabel="Loading settings" />}

      {!loading && (
        <s-section heading="Storefront modal layout">
          <s-paragraph>Edit the location detail modal on a visual canvas — real storefront rendering, drag-and-drop rows, columns and blocks, colors and sizing.</s-paragraph>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-button type="button" variant="primary" loading={opening} onClick={() => void openEditor()}>Open layout editor</s-button>
            <s-text color="subdued">{modalSummary}</s-text>
          </s-stack>
          <s-paragraph tone="neutral">The editor opens in a new tab. Save there, then reload this page to see the updated summary.</s-paragraph>
        </s-section>
      )}

      {!loading && (
        <s-section heading="Location data constructor">
          <s-paragraph>Create custom sections with typed fields. They appear on the location form and can be placed inside the storefront modal in the layout editor.</s-paragraph>
          <s-stack direction="block" gap="base">
            {sections.map((section, sectionIndex) => (
              <s-box key={section.id} padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="block" gap="base">
                  <s-grid gridTemplateColumns="1fr auto auto auto" gap="small" alignItems="end">
                    <s-text-field label="Section title" value={section.title} onInput={(event) => patchSection(sectionIndex, {title: event.currentTarget.value})}></s-text-field>
                    <s-button type="button" icon="arrow-up" accessibilityLabel="Move section up" onClick={() => moveSection(sectionIndex, -1)} disabled={sectionIndex === 0}></s-button>
                    <s-button type="button" icon="arrow-down" accessibilityLabel="Move section down" onClick={() => moveSection(sectionIndex, 1)} disabled={sectionIndex === sections.length - 1}></s-button>
                    <s-button type="button" tone="critical" icon="delete" accessibilityLabel="Remove section" onClick={() => removeSection(sectionIndex)}></s-button>
                  </s-grid>
                  {(section.fields ?? []).map((field, fieldIndex) => (
                    <s-grid key={field.id} gridTemplateColumns="1fr 160px auto" gap="small" alignItems="end">
                      <s-text-field label="Field label" value={field.label} onInput={(event) => patchField(sectionIndex, fieldIndex, {label: event.currentTarget.value})}></s-text-field>
                      <s-select label="Type" value={field.type} onChange={(event) => patchField(sectionIndex, fieldIndex, {type: event.currentTarget.value})}>
                        {FIELD_TYPES.map((type) => <s-option key={type} value={type}>{type}</s-option>)}
                      </s-select>
                      <s-button type="button" tone="critical" icon="delete" accessibilityLabel="Remove field" onClick={() => removeField(sectionIndex, fieldIndex)}></s-button>
                    </s-grid>
                  ))}
                  <s-button type="button" onClick={() => addField(sectionIndex)}>Add field</s-button>
                </s-stack>
              </s-box>
            ))}
            <s-button type="button" onClick={addSection}>Add section</s-button>
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}
