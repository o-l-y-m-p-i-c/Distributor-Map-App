import {useEffect, useState} from 'preact/hooks';
import {fetchWithIdToken} from '../lib/shopify.js';

const settingsUrl = 'https://distributor-map-app.onrender.com/api/admin/settings';

const FIELD_TYPES = ['text', 'textarea', 'url', 'email', 'phone', 'number'];

const BLOCK_TYPES = [
  {value: 'header', label: 'Header'},
  {value: 'text', label: 'Text'},
  {value: 'field', label: 'Location output'},
  {value: 'divider', label: 'Divider'},
  {value: 'spacer', label: 'Spacer'},
];

/** @type {Record<string, string>} */
const BLOCK_TYPE_LABELS = {header: 'Header', text: 'Text', field: 'Output', divider: 'Divider', spacer: 'Spacer'};

const FIELD_SOURCES = [
  {value: 'gallery', label: 'Image gallery'},
  {value: 'type', label: 'Location type badge'},
  {value: 'name', label: 'Location name'},
  {value: 'description', label: 'Description'},
  {value: 'address', label: 'Address'},
  {value: 'phones', label: 'Phone numbers'},
  {value: 'emails', label: 'Email addresses'},
  {value: 'websites', label: 'Websites'},
  {value: 'contacts', label: 'Contact links (all)'},
  {value: 'directions', label: 'Directions button'},
];

const HEADER_SIZES = ['small', 'base', 'large'];

/**
 * Create a full-shape block so every literal shares one inferred type.
 * @param {string} type @param {string} [source]
 * @returns {ModalBlock}
 */
const makeBlock = (type, source = '') => ({id: uid(), type, text: '', source, label: '', color: '', size: 'base', hidden: false});

/** @returns {ModalBlock[]} */
const defaultBlocks = () => [
  makeBlock('field', 'gallery'),
  makeBlock('field', 'type'),
  makeBlock('field', 'name'),
  makeBlock('field', 'description'),
  makeBlock('field', 'address'),
  makeBlock('field', 'contacts'),
  makeBlock('field', 'directions'),
];

const DEFAULT_MODAL = {
  backgroundColor: '#ffffff',
  textColor: '#092633',
  accentColor: '#176274',
  borderRadius: 18,
  width: 480,
  blocks: Array(),
};

/** @typedef {{id: string, label: string, type: string}} CustomField */
/** @typedef {{id: string, title: string, fields: CustomField[]}} CustomSection */
/** @typedef {{id: string, type: string, text?: string, source?: string, label?: string, color?: string, size?: string, hidden?: boolean}} ModalBlock */
/** @typedef {{backgroundColor: string, textColor: string, accentColor: string, borderRadius: number, width: number, blocks: ModalBlock[]}} ModalConfig */

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Convert the legacy sections-order config into blocks.
 * @param {string[]} order @param {string[]} hiddenKeys @returns {ModalBlock[]}
 */
const legacyOrderToBlocks = (order, hiddenKeys) => {
  const hidden = new Set(hiddenKeys);
  /** @type {ModalBlock[]} */
  const blocks = [];
  for (const key of order) {
    const sources = key === 'header' ? ['type', 'name'] : [key];
    for (const source of sources) {
      const block = makeBlock('field', source);
      block.hidden = hidden.has(key);
      blocks.push(block);
    }
  }
  return blocks;
};

/**
 * Live preview mock of the storefront modal rendered from the current blocks.
 * @param {{modal: ModalConfig, sourceLabels: Record<string, string>}} props
 */
function ModalPreview({modal, sourceLabels}) {
  /** @param {string} width @param {string} [color] @param {number} [height] */
  const bar = (width, color = '#d8e8ec', height = 7) => (
    <div style={{width, height: `${height}px`, background: color, borderRadius: '4px', marginBottom: '6px'}}></div>
  );

  /** @param {ModalBlock} block */
  const previewFor = (block) => {
    const color = block.color || '';
    if (block.type === 'header') {
      const fontSize = block.size === 'large' ? '16px' : block.size === 'small' ? '10px' : '13px';
      return <div style={{padding: '0 16px', fontSize, fontWeight: 700, color: color || modal.textColor}}>{block.text || 'Heading'}</div>;
    }
    if (block.type === 'text') return <div style={{padding: '0 16px'}}>{bar('100%', color || '#d8e8ec')}{bar('70%', color || '#d8e8ec')}</div>;
    if (block.type === 'divider') return <div style={{margin: '0 16px', borderTop: `1px solid ${color || '#d8e8ec'}`}}></div>;
    if (block.type === 'spacer') return <div style={{height: '10px'}}></div>;
    // field blocks
    const source = block.source ?? '';
    const label = block.label ? <div style={{fontSize: '8px', fontWeight: 700, color: modal.textColor, opacity: .55, marginBottom: '3px'}}>{block.label}</div> : null;
    let body = bar('70%', color || '#b9cdd4');
    if (source === 'gallery') body = <div style={{height: '90px', background: 'linear-gradient(135deg,#c5d8de,#8fb4bf)', borderRadius: color ? '6px' : 0}}></div>;
    if (source === 'type') body = <span style={{fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: color || modal.accentColor}}>Store</span>;
    if (source === 'name') body = <div style={{fontSize: '14px', fontWeight: 700, color: color || modal.textColor}}>Location name</div>;
    if (source === 'description') body = <div>{bar('100%', color)}{bar('90%', color)}{bar('60%', color)}</div>;
    if (source === 'contacts' || source === 'phones' || source === 'emails' || source === 'websites') body = <span style={{color: color || modal.accentColor, fontSize: '10px', fontWeight: 600}}>{sourceLabels[source] ?? 'Link'}</span>;
    if (source === 'directions') body = <span style={{display: 'inline-block', background: color || modal.accentColor, color: '#fff', borderRadius: '999px', padding: '7px 16px', fontSize: '10px', fontWeight: 700}}>Get directions</span>;
    if (source.startsWith('field:') || source.startsWith('section:')) body = <div>{bar('80%', color)}{bar('55%', color)}</div>;
    const padded = source !== 'gallery';
    return <div style={padded ? {padding: '0 16px'} : {}}>{label}{body}</div>;
  };

  return (
    <div style={{display: 'flex', justifyContent: 'center', padding: '8px 0'}}>
      <div style={{width: '250px', background: modal.backgroundColor, color: modal.textColor, borderRadius: `${modal.borderRadius}px`, overflow: 'hidden', border: '1px solid #d8e8ec', boxShadow: '0 12px 32px rgba(9,38,51,.18)'}}>
        {modal.blocks.filter((block) => !block.hidden).map((block) => <div key={block.id} style={{marginBottom: '12px'}}>{previewFor(block)}</div>)}
        {!modal.blocks.filter((block) => !block.hidden).length && <div style={{padding: '24px 16px', fontSize: '10px', color: '#66808b'}}>No visible blocks</div>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [sections, setSections] = useState(/** @type {CustomSection[]} */ ([]));
  const [modal, setModal] = useState({...DEFAULT_MODAL, blocks: defaultBlocks()});
  const [newBlockType, setNewBlockType] = useState('header');
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
        const nextSections = Array.isArray(payload?.customSections) ? payload.customSections : [];
        const config = payload?.modalConfig ?? {};
        setSections(nextSections);
        /** @type {ModalBlock[]} */
        let blocks = Array.isArray(config.blocks) && config.blocks.length ? config.blocks : Array();
        if (!blocks.length) {
          const legacyOrder = Array.isArray(config.sections) && config.sections.length ? config.sections : Array();
          const customKeys = nextSections.map((/** @type {CustomSection} */ section) => `section:${section.id}`);
          const order = [...legacyOrder, ...customKeys.filter((/** @type {string} */ key) => !legacyOrder.includes(key))];
          blocks = order.length ? legacyOrderToBlocks(order, Array.isArray(config.hidden) ? config.hidden : Array()) : defaultBlocks();
          for (const section of nextSections) {
            if (!blocks.some((block) => block.source === `section:${section.id}`)) blocks.push(makeBlock('field', `section:${section.id}`));
          }
        }
        setModal({...DEFAULT_MODAL, ...config, blocks});
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

  // --- modal block helpers ------------------------------------------------------

  /** @param {'backgroundColor' | 'textColor' | 'accentColor' | 'borderRadius' | 'width'} key @param {string | number} value */
  const patchModalKey = (key, value) => setModal((current) => ({...current, [key]: value}));

  /** @param {number} index @param {Partial<ModalBlock>} patch */
  const patchBlock = (index, patch) => setModal((current) => ({...current, blocks: current.blocks.map((block, i) => (i === index ? {...block, ...patch} : block))}));

  const addBlock = () => {
    const block = makeBlock(newBlockType, newBlockType === 'field' ? 'name' : '');
    if (newBlockType === 'header') block.text = 'Heading';
    setModal((current) => ({...current, blocks: [...current.blocks, block]}));
  };

  /** @param {number} index */
  const removeBlock = (index) => setModal((current) => ({...current, blocks: current.blocks.filter((_, i) => i !== index)}));

  /** @param {number} index @param {number} delta */
  const moveBlock = (index, delta) => setModal((current) => {
    const next = [...current.blocks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return {...current, blocks: next};
  });

  // Field source options: built-ins + custom fields and sections from the constructor
  const sourceOptions = [
    ...FIELD_SOURCES,
    ...sections.flatMap((section) => [
      {value: `section:${section.id}`, label: `Section — ${section.title}`},
      ...section.fields.map((field) => ({value: `field:${field.id}`, label: `${section.title} → ${field.label}`})),
    ]),
  ];
  /** @type {Record<string, string>} */
  const sourceLabels = {};
  for (const option of sourceOptions) sourceLabels[option.value] = option.label;

  return (
    <s-page heading="Settings">
      <s-button slot="primary-action" variant="primary" loading={saving} onClick={() => void save()}>Save settings</s-button>
      {saved && <s-banner tone="success" heading="Settings saved">Your storefront locator will use the new configuration.</s-banner>}
      {error && <s-banner tone="critical" heading="Settings error">{error}</s-banner>}
      {loading && <s-spinner accessibilityLabel="Loading settings" />}

      {!loading && (
        <s-section heading="Location data constructor">
          <s-paragraph>Create custom sections with typed fields. They appear on the location form and can be placed inside the storefront modal below.</s-paragraph>
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
            <s-color-field label="Background" value={modal.backgroundColor} onChange={(event) => patchModalKey('backgroundColor', event.currentTarget.value)}></s-color-field>
            <s-color-field label="Text" value={modal.textColor} onChange={(event) => patchModalKey('textColor', event.currentTarget.value)}></s-color-field>
            <s-color-field label="Accent (links &amp; buttons)" value={modal.accentColor} onChange={(event) => patchModalKey('accentColor', event.currentTarget.value)}></s-color-field>
          </s-grid>
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            <s-number-field label="Corner radius (px)" value={String(modal.borderRadius)} min={0} max={40} onChange={(event) => patchModalKey('borderRadius', Number(event.currentTarget.value))}></s-number-field>
            <s-number-field label="Max width (px)" value={String(modal.width)} min={280} max={900} onChange={(event) => patchModalKey('width', Number(event.currentTarget.value))}></s-number-field>
          </s-grid>
        </s-section>
      )}

      {!loading && (
        <s-section heading="Modal layout constructor">
          <s-paragraph>Build the modal from blocks: headers, free text, outputs bound to location data, and dividers. Reorder them and set a color for each.</s-paragraph>
          <s-stack direction="block" gap="base">
            {modal.blocks.map((block, index) => (
              <s-box key={block.id} padding="base" borderWidth="base" borderRadius="base" background={block.hidden ? 'subdued' : 'base'}>
                <s-stack direction="block" gap="small">
                  <s-grid gridTemplateColumns="auto 1fr auto auto auto" gap="small" alignItems="center">
                    <s-checkbox checked={!block.hidden} onChange={(event) => patchBlock(index, {hidden: !event.currentTarget.checked})} accessibilityLabel="Show block"></s-checkbox>
                    <s-text type="strong">{BLOCK_TYPE_LABELS[block.type] ?? block.type}{block.type === 'field' && block.source ? ` — ${sourceLabels[block.source] ?? block.source}` : ''}</s-text>
                    <s-button type="button" icon="arrow-up" accessibilityLabel="Move block up" onClick={() => moveBlock(index, -1)} disabled={index === 0}></s-button>
                    <s-button type="button" icon="arrow-down" accessibilityLabel="Move block down" onClick={() => moveBlock(index, 1)} disabled={index === modal.blocks.length - 1}></s-button>
                    <s-button type="button" tone="critical" icon="delete" accessibilityLabel="Remove block" onClick={() => removeBlock(index)}></s-button>
                  </s-grid>
                  {block.type === 'header' && (
                    <s-grid gridTemplateColumns="1fr 160px" gap="small">
                      <s-text-field label="Heading text" value={block.text ?? ''} onInput={(event) => patchBlock(index, {text: event.currentTarget.value})}></s-text-field>
                      <s-select label="Size" value={block.size ?? 'base'} onChange={(event) => patchBlock(index, {size: event.currentTarget.value})}>
                        {HEADER_SIZES.map((size) => <s-option key={size} value={size}>{size}</s-option>)}
                      </s-select>
                    </s-grid>
                  )}
                  {block.type === 'text' && (
                    <s-text-area label="Content" value={block.text ?? ''} rows={2} onInput={(event) => patchBlock(index, {text: event.currentTarget.value})}></s-text-area>
                  )}
                  {block.type === 'field' && (
                    <s-grid gridTemplateColumns="1fr 1fr" gap="small">
                      <s-select label="Output" value={block.source ?? 'name'} onChange={(event) => patchBlock(index, {source: event.currentTarget.value})}>
                        {sourceOptions.map((option) => <s-option key={option.value} value={option.value}>{option.label}</s-option>)}
                      </s-select>
                      <s-text-field label="Label (optional)" value={block.label ?? ''} placeholder="Shown above the value" onInput={(event) => patchBlock(index, {label: event.currentTarget.value})}></s-text-field>
                    </s-grid>
                  )}
                  {block.type !== 'spacer' && (
                    <s-color-field label="Color" value={block.color ?? ''} onChange={(event) => patchBlock(index, {color: event.currentTarget.value})}></s-color-field>
                  )}
                </s-stack>
              </s-box>
            ))}
            <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
              <s-select label="Add block" value={newBlockType} onChange={(event) => setNewBlockType(event.currentTarget.value)}>
                {BLOCK_TYPES.map((type) => <s-option key={type.value} value={type.value}>{type.label}</s-option>)}
              </s-select>
              <s-button type="button" onClick={addBlock}>Add block</s-button>
            </s-grid>
          </s-stack>
        </s-section>
      )}

      {!loading && (
        <s-section heading="Preview">
          <ModalPreview modal={modal} sourceLabels={sourceLabels} />
        </s-section>
      )}
    </s-page>
  );
}
