import {useEffect, useState} from 'preact/hooks';
import {fetchWithIdToken} from '../lib/shopify.js';

const settingsUrl = 'https://distributor-map-app.onrender.com/api/admin/settings';

const FIELD_TYPES = ['text', 'textarea', 'url', 'email', 'phone', 'number'];

const BLOCK_TYPES = [
  {value: 'header', label: 'Header'},
  {value: 'text', label: 'Text'},
  {value: 'field', label: 'Output'},
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

const uid = () => Math.random().toString(36).slice(2, 10);

/** @typedef {{id: string, label: string, type: string}} CustomField */
/** @typedef {{id: string, title: string, fields: CustomField[]}} CustomSection */
/** @typedef {{id: string, type: string, text: string, source: string, label: string, color: string, size: string, hidden: boolean}} ModalBlock */
/** @typedef {{id: string, blocks: ModalBlock[]}} ModalColumn */
/** @typedef {{id: string, columns: ModalColumn[]}} ModalRow */
/** @typedef {{backgroundColor: string, textColor: string, accentColor: string, borderRadius: number, width: number, layout: ModalRow[]}} ModalConfig */
/** @typedef {{rowId: string, colId: string, blockIndex: number}} BlockRef */

/**
 * @param {string} type @param {string} [source]
 * @returns {ModalBlock}
 */
const makeBlock = (type, source = '') => ({id: uid(), type, text: '', source, label: '', color: '', size: 'base', hidden: false});

/** @param {ModalBlock[]} [blocks] @returns {ModalColumn} */
const makeColumn = (blocks = Array()) => ({id: uid(), blocks});

/** @param {ModalColumn[]} [columns] @returns {ModalRow} */
const makeRow = (columns = Array()) => ({id: uid(), columns});

/** @returns {ModalRow[]} */
const defaultLayout = () => [makeRow([makeColumn([
  makeBlock('field', 'gallery'),
  makeBlock('field', 'type'),
  makeBlock('field', 'name'),
  makeBlock('field', 'description'),
  makeBlock('field', 'address'),
  makeBlock('field', 'contacts'),
  makeBlock('field', 'directions'),
])])];

const DEFAULT_MODAL = {
  backgroundColor: '#ffffff',
  textColor: '#092633',
  accentColor: '#176274',
  borderRadius: 18,
  width: 480,
  layout: Array(),
};

/**
 * Flatten any legacy blocks/sections config into a rows → columns → blocks layout.
 * @param {Record<string, any>} config @param {CustomSection[]} sections @returns {ModalRow[]}
 */
const toLayout = (config, sections) => {
  if (Array.isArray(config.layout) && config.layout.length) {
    return config.layout
      .filter((/** @type {any} */ row) => row && Array.isArray(row.columns) && row.columns.length)
      .map((/** @type {any} */ row) => ({
        id: row.id ?? uid(),
        columns: row.columns.map((/** @type {any} */ col) => ({
          id: col.id ?? uid(),
          blocks: (Array.isArray(col.blocks) ? col.blocks : []).map((/** @type {any} */ b) => ({...makeBlock(b?.type ?? 'field', b?.source ?? ''), ...b})),
        })),
      }));
  }
  /** @type {ModalBlock[]} */
  let blocks = Array.isArray(config.blocks) && config.blocks.length ? config.blocks.map((/** @type {any} */ b) => ({...makeBlock(b.type ?? 'field', b.source ?? ''), ...b})) : Array();
  if (!blocks.length) {
    const hidden = new Set(Array.isArray(config.hidden) ? config.hidden : []);
    const savedOrder = Array.isArray(config.sections) && config.sections.length ? config.sections : Array();
    const keys = [...savedOrder, ...sections.map((s) => `section:${s.id}`).filter((k) => !savedOrder.includes(k))];
    const order = keys.length ? keys : ['gallery', 'header', 'description', 'address', 'contacts', 'directions'];
    for (const key of order) {
      for (const source of key === 'header' ? ['type', 'name'] : [key]) {
        const block = makeBlock('field', source);
        block.hidden = hidden.has(key);
        blocks.push(block);
      }
    }
  }
  for (const section of sections) {
    if (!blocks.some((block) => block.source === `section:${section.id}`)) blocks.push(makeBlock('field', `section:${section.id}`));
  }
  return blocks.length ? [makeRow([makeColumn(blocks)])] : defaultLayout();
};

/**
 * Text summary of a block shown on its canvas chip.
 * @param {ModalBlock} block @param {Record<string, string>} sourceLabels @returns {string}
 */
const blockSummary = (block, sourceLabels) => {
  if (block.type === 'header') return `"${block.text || 'Heading'}" · ${block.size}`;
  if (block.type === 'text') return block.text ? (block.text.length > 60 ? `${block.text.slice(0, 60)}…` : block.text) : 'Free text';
  if (block.type === 'divider') return 'Horizontal line';
  if (block.type === 'spacer') return 'Empty space';
  const parts = [sourceLabels[block.source] ?? block.source ?? 'pick an output'];
  if (block.label) parts.unshift(`“${block.label}”`);
  if (block.color) parts.push(block.color);
  return parts.join(' · ');
};

export default function SettingsPage() {
  const [sections, setSections] = useState(/** @type {CustomSection[]} */ ([]));
  const [modal, setModal] = useState({...DEFAULT_MODAL, layout: defaultLayout()});
  const [selected, setSelected] = useState(/** @type {BlockRef | null} */ (null));
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
        setModal({...DEFAULT_MODAL, ...config, layout: toLayout(config, nextSections)});
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
      // Derive flat blocks + legacy section order so older widget builds still work.
      const flatBlocks = modal.layout.flatMap((row) => row.columns.flatMap((col) => col.blocks));
      /** @type {string[]} */
      const legacyOrder = Array();
      /** @type {string[]} */
      const legacyHidden = Array();
      for (const block of flatBlocks) {
        if (block.type !== 'field' || !block.source) continue;
        const key = block.source === 'name' || block.source === 'type' ? 'header' : block.source;
        if (!legacyOrder.includes(key)) legacyOrder.push(key);
        if (block.hidden && !legacyHidden.includes(key)) legacyHidden.push(key);
      }
      const payload = {customSections: sections, modalConfig: {...modal, blocks: flatBlocks, sections: legacyOrder, hidden: legacyHidden}};
      const response = await fetchWithIdToken(settingsUrl, {method: 'PUT', headers: {'content-type': 'application/json', accept: 'application/json'}, body: JSON.stringify(payload)});
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

  // --- layout helpers -----------------------------------------------------------

  /** @param {'backgroundColor' | 'textColor' | 'accentColor' | 'borderRadius' | 'width'} key @param {string | number} value */
  const patchModalKey = (key, value) => setModal((current) => ({...current, [key]: value}));

  /** @param {(layout: ModalRow[]) => ModalRow[]} fn */
  const patchLayout = (fn) => setModal((current) => ({...current, layout: fn(Array.isArray(current.layout) ? current.layout : [])}));

  const addRow = () => patchLayout((layout) => [...layout, makeRow([makeColumn()])]);

  /** @param {string} rowId */
  const removeRow = (rowId) => patchLayout((layout) => layout.filter((row) => row.id !== rowId));

  /** @param {string} rowId */
  const addColumn = (rowId) => patchLayout((layout) => layout.map((row) => (row.id === rowId && (row.columns ?? []).length < 4 ? {...row, columns: [...(row.columns ?? []), makeColumn()]} : row)));

  /** @param {string} rowId @param {string} colId */
  const removeColumn = (rowId, colId) => patchLayout((layout) => layout
    .map((row) => (row.id === rowId ? {...row, columns: (row.columns ?? []).filter((col) => col.id !== colId)} : row))
    .filter((row) => (row.columns ?? []).length > 0));

  /**
   * @param {BlockRef} from @param {string} toRowId @param {string} toColId @param {number} toIndex
   */
  const moveBlockTo = (from, toRowId, toColId, toIndex) => patchLayout((layout) => {
    /** @type {ModalBlock | null} */
    let moved = null;
    const without = layout.map((row) => ({
      ...row,
      columns: row.columns.map((col) => {
        if (!(row.id === from.rowId && col.id === from.colId)) return col;
        moved = col.blocks[from.blockIndex] ?? null;
        return {...col, blocks: col.blocks.filter((_, i) => i !== from.blockIndex)};
      }),
    }));
    if (!moved) return layout;
    const movedBlock = moved;
    return without.map((row) => ({
      ...row,
      columns: row.columns.map((col) => {
        if (!(row.id === toRowId && col.id === toColId)) return col;
        const next = [...col.blocks];
        const at = Math.min(toIndex, next.length);
        next.splice(at < 0 ? next.length : at, 0, movedBlock);
        return {...col, blocks: next};
      }),
    }));
  });

  /** @param {number} fromIndex @param {number} toIndex */
  const moveRowTo = (fromIndex, toIndex) => patchLayout((layout) => {
    const next = [...layout];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return layout;
    next.splice(Math.min(toIndex, next.length), 0, moved);
    return next;
  });

  /** @param {string} rowId @param {number} fromIndex @param {number} toIndex */
  const moveColumnTo = (rowId, fromIndex, toIndex) => patchLayout((layout) => layout.map((row) => {
    if (row.id !== rowId) return row;
    const columns = [...row.columns];
    const [moved] = columns.splice(fromIndex, 1);
    if (!moved) return row;
    columns.splice(Math.min(toIndex, columns.length), 0, moved);
    return {...row, columns};
  }));

  /** @param {BlockRef} ref @param {Partial<ModalBlock>} patch */
  const patchBlockAt = (ref, patch) => patchLayout((layout) => layout.map((row) => ({
    ...row,
    columns: row.columns.map((col) => (row.id === ref.rowId && col.id === ref.colId
      ? {...col, blocks: col.blocks.map((block, i) => (i === ref.blockIndex ? {...block, ...patch} : block))}
      : col)),
  })));

  /** @param {BlockRef} ref */
  const removeBlockAt = (ref) => {
    patchLayout((layout) => layout.map((row) => ({
      ...row,
      columns: row.columns.map((col) => (row.id === ref.rowId && col.id === ref.colId
        ? {...col, blocks: col.blocks.filter((_, i) => i !== ref.blockIndex)}
        : col)),
    })));
    setSelected(null);
  };

  /** @param {string} type */
  const addBlockTo = (type) => {
    const lastRow = (modal.layout ?? [])[modal.layout.length - 1];
    const target = selected ?? {rowId: lastRow?.id ?? '', colId: (lastRow?.columns ?? [])[0]?.id ?? '', blockIndex: -1};
    const block = makeBlock(type, type === 'field' ? 'name' : '');
    if (type === 'header') block.text = 'Heading';
    if (!target.rowId || !target.colId) {
      patchLayout((layout) => [...layout, makeRow([makeColumn([block])])]);
    } else {
      patchLayout((layout) => layout.map((row) => ({
        ...row,
        columns: row.columns.map((col) => (row.id === target.rowId && col.id === target.colId ? {...col, blocks: [...col.blocks, block]} : col)),
      })));
    }
    setSelected({rowId: target.rowId, colId: target.colId, blockIndex: 999});
  };

  // --- placement -----------------------------------------------------------------

  /**
   * Move the currently selected block into the given column position.
   * @param {string} rowId @param {string} colId @param {number} index
   */
  const placeSelected = (rowId, colId, index) => {
    if (!selected) return;
    moveBlockTo(selected, rowId, colId, index);
    setSelected(null);
  };

  // --- selection -----------------------------------------------------------------

  const selectedBlock = (() => {
    if (!selected) return null;
    const row = (modal.layout ?? []).find((item) => item.id === selected.rowId);
    const col = (row?.columns ?? []).find((item) => item.id === selected.colId);
    const block = col?.blocks[selected.blockIndex] ?? null;
    return block ? {block, ref: {rowId: selected.rowId, colId: selected.colId, blockIndex: col?.blocks.indexOf(block) ?? 0}} : null;
  })();

  const sourceOptions = [
    ...FIELD_SOURCES,
    ...sections.flatMap((section) => [
      {value: `section:${section.id}`, label: `Section — ${section.title}`},
      ...(section.fields ?? []).map((field) => ({value: `field:${field.id}`, label: `${section.title} → ${field.label}`})),
    ]),
  ];
  /** @type {Record<string, string>} */
  const sourceLabels = {};
  for (const option of sourceOptions) sourceLabels[option.value] = option.label;

  /** @param {BlockRef} ref @param {ModalBlock} block */
  const isSelected = (ref, block) => Boolean(selected && selected.rowId === ref.rowId && selected.colId === ref.colId && (modal.layout ?? []).find((row) => row.id === ref.rowId)?.columns?.find((col) => col.id === ref.colId)?.blocks?.[selected.blockIndex] === block);

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

      {!loading && (
        <s-section heading="Storefront modal">
          <s-paragraph>Customize the modal container. Layout is edited on the canvas below.</s-paragraph>
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
          <s-paragraph>The canvas below mirrors the modal: rows stack vertically, each row splits into columns, and each column holds a stack of blocks. Click a block to select and edit it — while a block is selected, "Place here" slots appear in every column so you can drop it anywhere. Rows and columns are reordered with their position selectors.</s-paragraph>
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="small">
              {BLOCK_TYPES.map((type) => (
                <s-button key={type.value} type="button" onClick={() => addBlockTo(type.value)}>+ {type.label}</s-button>
              ))}
            </s-stack>

            {(modal.layout ?? []).map((row, rowIndex) => (
              <s-box key={row.id} border="base" borderRadius="base" padding="base" background="subdued">
                <s-stack direction="block" gap="base">
                  <s-grid gridTemplateColumns="auto 1fr auto auto" gap="small" alignItems="center">
                    <s-text type="strong">Row {rowIndex + 1}</s-text>
                    <s-select label="Row position" labelAccessibilityVisibility="exclusive" value={String(rowIndex + 1)} onChange={(event) => moveRowTo(rowIndex, Number(event.currentTarget.value) - 1)}>
                      {(modal.layout ?? []).map((_, i) => <s-option key={i} value={String(i + 1)}>Row {i + 1}</s-option>)}
                    </s-select>
                    <s-button type="button" onClick={() => addColumn(row.id)} disabled={(row.columns ?? []).length >= 4}>+ column</s-button>
                    <s-button type="button" tone="critical" icon="delete" accessibilityLabel="Remove row" onClick={() => removeRow(row.id)}></s-button>
                  </s-grid>
                  <s-grid gridTemplateColumns={(row.columns ?? []).map(() => '1fr').join(' ')} gap="small" alignItems="start">
                    {(row.columns ?? []).map((col, colIndex) => (
                      <s-box key={col.id} border="base" borderRadius="base" padding="small">
                        <s-stack direction="block" gap="small">
                          <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="center">
                            <s-select label="Column position" labelAccessibilityVisibility="exclusive" value={String(colIndex + 1)} onChange={(event) => moveColumnTo(row.id, colIndex, Number(event.currentTarget.value) - 1)}>
                              {(row.columns ?? []).map((_, i) => <s-option key={i} value={String(i + 1)}>Col {i + 1}</s-option>)}
                            </s-select>
                            <s-button type="button" tone="critical" icon="delete" accessibilityLabel="Remove column" onClick={() => removeColumn(row.id, col.id)}></s-button>
                          </s-grid>
                          {selected && (
                            <s-clickable onClick={() => placeSelected(row.id, col.id, 0)} padding="small" border="base" borderRadius="base">
                              <s-text color="subdued">+ place here</s-text>
                            </s-clickable>
                          )}
                          {(col.blocks ?? []).map((block, blockIndex) => {
                            const ref = {rowId: row.id, colId: col.id, blockIndex};
                            const active = isSelected(ref, block);
                            return (
                              <s-stack key={block.id} direction="block" gap="small">
                                <s-clickable onClick={() => setSelected(ref)} padding="small" border="base" borderRadius="base" background={active ? 'subdued' : 'base'}>
                                  <s-stack direction="block" gap="small">
                                    <s-stack direction="inline" gap="small">
                                      <s-text type="strong">{BLOCK_TYPE_LABELS[block.type] ?? block.type}</s-text>
                                      {block.type === 'field' && <s-badge>{sourceLabels[block.source] ?? block.source}</s-badge>}
                                      {block.hidden && <s-badge tone="warning">hidden</s-badge>}
                                      {active && <s-badge tone="info">selected</s-badge>}
                                    </s-stack>
                                    <s-text color="subdued">{blockSummary(block, sourceLabels)}</s-text>
                                  </s-stack>
                                </s-clickable>
                                {selected && (
                                  <s-clickable onClick={() => placeSelected(row.id, col.id, blockIndex + 1)} padding="small" border="base" borderRadius="base">
                                    <s-text color="subdued">+ place here</s-text>
                                  </s-clickable>
                                )}
                              </s-stack>
                            );
                          })}
                          {!(col.blocks ?? []).length && !selected && <s-text color="subdued">Empty column — select a block above to place it here</s-text>}
                        </s-stack>
                      </s-box>
                    ))}
                  </s-grid>
                </s-stack>
              </s-box>
            ))}
            <s-button type="button" onClick={addRow}>+ add row</s-button>
          </s-stack>
        </s-section>
      )}

      {!loading && selectedBlock && (
        <s-section heading={`Block settings — ${BLOCK_TYPE_LABELS[selectedBlock.block.type] ?? selectedBlock.block.type}`}>
          <s-stack direction="block" gap="base">
            {selectedBlock.block.type === 'header' && (
              <s-grid gridTemplateColumns="1fr 160px" gap="base">
                <s-text-field label="Heading text" value={selectedBlock.block.text} onInput={(event) => patchBlockAt(selectedBlock.ref, {text: event.currentTarget.value})}></s-text-field>
                <s-select label="Size" value={selectedBlock.block.size} onChange={(event) => patchBlockAt(selectedBlock.ref, {size: event.currentTarget.value})}>
                  {HEADER_SIZES.map((size) => <s-option key={size} value={size}>{size}</s-option>)}
                </s-select>
              </s-grid>
            )}
            {selectedBlock.block.type === 'text' && (
              <s-text-area label="Content" value={selectedBlock.block.text} rows={3} onInput={(event) => patchBlockAt(selectedBlock.ref, {text: event.currentTarget.value})}></s-text-area>
            )}
            {selectedBlock.block.type === 'field' && (
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-select label="Output" value={selectedBlock.block.source} onChange={(event) => patchBlockAt(selectedBlock.ref, {source: event.currentTarget.value})}>
                  {sourceOptions.map((option) => <s-option key={option.value} value={option.value}>{option.label}</s-option>)}
                </s-select>
                <s-text-field label="Label (optional)" value={selectedBlock.block.label} placeholder="Shown above the value" onInput={(event) => patchBlockAt(selectedBlock.ref, {label: event.currentTarget.value})}></s-text-field>
              </s-grid>
            )}
            {selectedBlock.block.type !== 'spacer' && (
              <s-color-field label="Block color" value={selectedBlock.block.color} onChange={(event) => patchBlockAt(selectedBlock.ref, {color: event.currentTarget.value})}></s-color-field>
            )}
            <s-checkbox label="Hide block on storefront" checked={selectedBlock.block.hidden} onChange={(event) => patchBlockAt(selectedBlock.ref, {hidden: event.currentTarget.checked})}></s-checkbox>
            <s-button type="button" tone="critical" onClick={() => removeBlockAt(selectedBlock.ref)}>Delete block</s-button>
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}
