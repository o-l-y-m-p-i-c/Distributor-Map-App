import {useEffect, useState} from 'preact/hooks';
import {fetchWithIdToken} from '../lib/shopify.js';

const settingsUrl = 'https://distributor-map-app.onrender.com/api/admin/settings';

const FIELD_TYPES = ['text', 'textarea', 'url', 'email', 'phone', 'number'];

const BUILTIN_SECTIONS = [
  {key: 'gallery', label: 'Image gallery'},
  {key: 'header', label: 'Title & type'},
  {key: 'description', label: 'Description'},
  {key: 'address', label: 'Address'},
  {key: 'contacts', label: 'Contact links'},
  {key: 'directions', label: 'Directions button'},
];

const DEFAULT_MODAL = {
  backgroundColor: '#ffffff',
  textColor: '#092633',
  accentColor: '#176274',
  borderRadius: 18,
  width: 480,
  sections: ['gallery', 'header', 'description', 'address', 'contacts', 'directions'],
  hidden: Array(),
};

/** @typedef {{id: string, label: string, type: string}} CustomField */
/** @typedef {{id: string, title: string, fields: CustomField[]}} CustomSection */
/** @typedef {{backgroundColor: string, textColor: string, accentColor: string, borderRadius: number, width: number, sections: string[], hidden: string[]}} ModalConfig */

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Move an item in an array.
 * @param {string[]} list @param {number} index @param {number} delta @returns {string[]}
 */
const moveItem = (list, index, delta) => {
  const next = [...list];
  const target = index + delta;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/**
 * Live preview mock of the storefront modal rendered from the current config.
 * @param {{modal: ModalConfig, order: string[], labels: Record<string, string>}} props
 */
function ModalPreview({modal, order, labels}) {
  /** @param {string} width @param {string} [color] @param {number} [height] */
  const bar = (width, color = '#d8e8ec', height = 7) => (
    <div style={{width, height: `${height}px`, background: color, borderRadius: '4px', marginBottom: '6px'}}></div>
  );
  const hidden = new Set(modal.hidden);

  /** @param {string} key */
  const previewFor = (key) => {
    if (key === 'gallery') return <div style={{height: '90px', background: 'linear-gradient(135deg,#c5d8de,#8fb4bf)'}}></div>;
    if (key === 'header') return (
      <div style={{padding: '0 16px'}}>
        <div style={{fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '4px', color: modal.accentColor}}>Store</div>
        <div style={{fontSize: '14px', fontWeight: 700}}>Location name</div>
      </div>
    );
    if (key === 'description') return <div style={{padding: '0 16px'}}>{bar('100%')}{bar('90%')}{bar('60%')}</div>;
    if (key === 'address') return <div style={{padding: '0 16px'}}>{bar('75%', '#b9cdd4')}</div>;
    if (key === 'contacts') return (
      <div style={{display: 'flex', gap: '6px', padding: '0 16px', flexWrap: 'wrap'}}>
        {['Phone', 'Email', 'Website'].map((item) => (
          <span key={item} style={{color: modal.accentColor, fontSize: '10px', fontWeight: 600}}>{item}</span>
        ))}
      </div>
    );
    if (key === 'directions') return (
      <div style={{padding: '4px 16px 16px'}}>
        <span style={{display: 'inline-block', background: modal.accentColor, color: '#fff', borderRadius: '999px', padding: '7px 16px', fontSize: '10px', fontWeight: 700}}>Get directions</span>
      </div>
    );
    if (key.startsWith('section:')) return (
      <div style={{padding: '0 16px'}}>
        <div style={{fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px', color: modal.accentColor}}>{labels[key]}</div>
        {bar('80%')}{bar('55%')}
      </div>
    );
    return null;
  };

  return (
    <div style={{display: 'flex', justifyContent: 'center', padding: '8px 0'}}>
      <div style={{width: '250px', background: modal.backgroundColor, color: modal.textColor, borderRadius: `${modal.borderRadius}px`, overflow: 'hidden', border: '1px solid #d8e8ec', boxShadow: '0 12px 32px rgba(9,38,51,.18)'}}>
        {order.filter((key) => !hidden.has(key)).map((key) => <div key={key} style={{marginBottom: '12px'}}>{previewFor(key)}</div>)}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [sections, setSections] = useState(/** @type {CustomSection[]} */ ([]));
  const [modal, setModal] = useState(DEFAULT_MODAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchWithIdToken(settingsUrl, {headers: {accept: 'application/json'}})
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json();
      })
      .then((payload) => {
        setSections(Array.isArray(payload?.customSections) ? payload.customSections : []);
        setModal({...DEFAULT_MODAL, ...(payload?.modalConfig ?? {})});
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
      const response = await fetchWithIdToken(settingsUrl, {method: 'PUT', headers: {'content-type': 'application/json', accept: 'application/json'}, body: JSON.stringify({customSections: sections, modalConfig: modal})});
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };

  // --- data constructor helpers -------------------------------------------------

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

  // --- modal config helpers -----------------------------------------------------

  /** @param {keyof ModalConfig} key @param {string | number | string[]} value */
  const patchModal = (key, value) => setModal((current) => ({...current, [key]: value}));

  const allKeys = [...BUILTIN_SECTIONS.map((item) => item.key), ...sections.map((section) => `section:${section.id}`)];
  /** @type {Record<string, string>} */
  const labels = {};
  for (const item of BUILTIN_SECTIONS) labels[item.key] = item.label;
  for (const section of sections) labels[`section:${section.id}`] = section.title;
  const savedOrder = Array.isArray(modal.sections) ? modal.sections : [];
  const order = [...savedOrder.filter((key) => allKeys.includes(key)), ...allKeys.filter((key) => !savedOrder.includes(key))];
  const hiddenSet = new Set(modal.hidden);

  /** @param {string} key @param {number} delta */
  const moveModalSection = (key, delta) => {
    const index = order.indexOf(key);
    patchModal('sections', moveItem(order, index, delta));
  };

  /** @param {string} key @param {boolean} visible */
  const toggleModalSection = (key, visible) => {
    patchModal('hidden', visible ? [...hiddenSet].filter((item) => item !== key) : [...hiddenSet, key]);
  };

  return (
    <s-page heading="Settings">
      <s-button slot="primary-action" variant="primary" loading={saving} onClick={() => void save()}>Save settings</s-button>
      {saved && <s-banner tone="success" heading="Settings saved">Your storefront locator will use the new configuration.</s-banner>}
      {error && <s-banner tone="critical" heading="Settings error">{error}</s-banner>}
      {loading && <s-spinner accessibilityLabel="Loading settings" />}

      {!loading && (
        <s-section heading="Location data constructor">
          <s-paragraph>Create custom sections with typed fields. They appear on the location form and are rendered inside the storefront modal.</s-paragraph>
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
                  {section.fields.map((field, fieldIndex) => (
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

      {!loading && (
        <s-section heading="Storefront modal">
          <s-paragraph>Customize the location detail modal. The preview updates as you edit.</s-paragraph>
          <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
            <s-color-field label="Background" value={modal.backgroundColor} onChange={(event) => patchModal('backgroundColor', event.currentTarget.value)}></s-color-field>
            <s-color-field label="Text" value={modal.textColor} onChange={(event) => patchModal('textColor', event.currentTarget.value)}></s-color-field>
            <s-color-field label="Accent (links &amp; buttons)" value={modal.accentColor} onChange={(event) => patchModal('accentColor', event.currentTarget.value)}></s-color-field>
          </s-grid>
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            <s-number-field label="Corner radius (px)" value={String(modal.borderRadius)} min={0} max={40} onChange={(event) => patchModal('borderRadius', Number(event.currentTarget.value))}></s-number-field>
            <s-number-field label="Max width (px)" value={String(modal.width)} min={280} max={900} onChange={(event) => patchModal('width', Number(event.currentTarget.value))}></s-number-field>
          </s-grid>

          <s-stack direction="block" gap="small">
            <s-text type="strong">Section placement</s-text>
            {order.map((key, index) => (
              <s-grid key={key} gridTemplateColumns="auto 1fr auto auto" gap="small" alignItems="center">
                <s-checkbox checked={!hiddenSet.has(key)} onChange={(event) => toggleModalSection(key, event.currentTarget.checked)} accessibilityLabel={`Show ${labels[key]}`}></s-checkbox>
                <s-text>{labels[key]}</s-text>
                <s-button type="button" icon="arrow-up" accessibilityLabel="Move up" onClick={() => moveModalSection(key, -1)} disabled={index === 0}></s-button>
                <s-button type="button" icon="arrow-down" accessibilityLabel="Move down" onClick={() => moveModalSection(key, 1)} disabled={index === order.length - 1}></s-button>
              </s-grid>
            ))}
          </s-stack>
        </s-section>
      )}

      {!loading && (
        <s-section heading="Preview">
          <ModalPreview modal={modal} order={order} labels={labels} />
        </s-section>
      )}
    </s-page>
  );
}
