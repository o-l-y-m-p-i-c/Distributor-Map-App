'use client';

import {useEffect, useRef, useState, type CSSProperties, type DragEvent} from 'react';

type Block = {
  id: string;
  type: 'header' | 'text' | 'field' | 'divider' | 'spacer';
  text: string;
  source: string;
  label: string;
  color: string;
  size: string;
  hidden: boolean;
};
type Col = { id: string; blocks: Block[] };
type Row = { id: string; columns: Col[] };
type CustomField = { id: string; label: string; type: string };
type CustomSection = { id: string; title: string; fields: CustomField[] };
type ModalConfig = {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  borderRadius: number;
  width: number;
  layout: Row[];
};
type SelectedRef = { rowId: string; colId: string; blockIndex: number };
type DragRef = { kind: 'block' | 'column' | 'row'; rowId: string; colId: string; index: number } | null;

const BLOCK_TYPES: { value: Block['type']; label: string }[] = [
  {value: 'header', label: 'Header'},
  {value: 'text', label: 'Text'},
  {value: 'field', label: 'Output'},
  {value: 'divider', label: 'Divider'},
  {value: 'spacer', label: 'Spacer'},
];
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
const makeBlock = (type: Block['type'], source = ''): Block => ({id: uid(), type, text: '', source, label: '', color: '', size: 'base', hidden: false});
const makeColumn = (blocks: Block[] = []): Col => ({id: uid(), blocks});
const makeRow = (columns: Col[] = []): Row => ({id: uid(), columns});
const defaultLayout = (): Row[] => [makeRow([makeColumn([
  makeBlock('field', 'gallery'),
  makeBlock('field', 'type'),
  makeBlock('field', 'name'),
  makeBlock('field', 'description'),
  makeBlock('field', 'address'),
  makeBlock('field', 'contacts'),
  makeBlock('field', 'directions'),
])])];

const DEFAULT_MODAL: ModalConfig = {
  backgroundColor: '#ffffff',
  textColor: '#092633',
  accentColor: '#176274',
  borderRadius: 18,
  width: 480,
  layout: [],
};

// Flatten any legacy blocks/sections config into rows -> columns -> blocks.
const toLayout = (config: Record<string, unknown>, sections: CustomSection[]): Row[] => {
  const normalizeBlock = (b: Partial<Block> | undefined): Block => ({...makeBlock((b?.type as Block['type']) ?? 'field', b?.source ?? ''), ...(b ?? {})});
  if (Array.isArray(config.layout) && config.layout.length) {
    const rows = (config.layout as {id?: string; columns?: {id?: string; blocks?: Partial<Block>[]}[]}[])
      .filter((row) => row && Array.isArray(row.columns) && row.columns.length)
      .map((row) => ({
        id: row.id ?? uid(),
        columns: row.columns!.map((col) => ({
          id: col.id ?? uid(),
          blocks: (Array.isArray(col.blocks) ? col.blocks : []).map(normalizeBlock),
        })),
      }));
    if (rows.length) return rows;
  }
  const blocks: Block[] = Array.isArray(config.blocks) && config.blocks.length
    ? (config.blocks as Partial<Block>[]).map(normalizeBlock)
    : [];
  if (!blocks.length) {
    const hidden = new Set(Array.isArray(config.hidden) ? (config.hidden as string[]) : []);
    const savedOrder = Array.isArray(config.sections) && (config.sections as string[]).length ? (config.sections as string[]) : [];
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

// ---- storefront rendering (ported from extensions/store-locator/assets/store-locator.js) ----

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character] as string));

const sampleLocation = {
  id: 'sample',
  name: 'Rīga Flagship Store',
  type: 'store',
  description: 'Our flagship showroom in the city centre with the full collection on display.',
  addressLine1: 'Brīvības iela 40',
  city: 'Rīga',
  postalCode: 'LV-1050',
  country: 'Latvia',
  phones: ['+371 2000 0000', '+371 6700 0000'],
  emails: ['riga@example.com'],
  websites: ['https://example.com'],
  imageUrls: ['https://placehold.co/640x320/176274/ffffff?text=Gallery', 'https://placehold.co/640x320/66808b/ffffff?text=Photo+2'],
  buttonUrl: '',
  latitude: 56.95,
  longitude: 24.11,
};

const sampleValueFor = (type: string, label: string) => {
  if (type === 'url') return 'https://example.com/details';
  if (type === 'email') return 'hello@example.com';
  if (type === 'phone') return '+371 2000 0000';
  if (type === 'number') return '42';
  if (type === 'textarea') return `Sample text for ${label}. Second line of content.`;
  return `Sample ${label.toLowerCase()}`;
};

const renderModalBody = (modal: ModalConfig, sections: CustomSection[]): string => {
  const location = sampleLocation;
  const address = [location.addressLine1, location.city, location.postalCode, location.country].filter(Boolean).join(', ');
  const images = location.imageUrls;
  const fieldById = new Map(sections.flatMap((section) => (section.fields ?? []).map((field) => [field.id, field] as const)));
  const sectionById = new Map(sections.map((section) => [section.id, section] as const));
  const customValues: Record<string, string> = {};
  for (const section of sections) for (const field of section.fields ?? []) customValues[field.id] = sampleValueFor(field.type, field.label);

  const customFieldHtml = (field: CustomField, value: string) => {
    const escaped = escapeHtml(value);
    let rendered = `<span>${escaped}</span>`;
    if (field.type === 'url') rendered = `<a href="${escaped}">${escaped}</a>`;
    if (field.type === 'email') rendered = `<a href="mailto:${escaped}">${escaped}</a>`;
    if (field.type === 'phone') rendered = `<a href="tel:${escaped}">${escaped}</a>`;
    return `<div class="dm-locator__modal-field"><span class="dm-locator__modal-field-label">${escapeHtml(field.label)}</span>${rendered}</div>`;
  };

  const linkRow = (links: string[]) => (links.length ? `<div class="dm-locator__modal-meta">${links.join('')}</div>` : '');
  const phoneLinks = location.phones.map((phone) => `<a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a>`);
  const emailLinks = location.emails.map((email) => `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`);
  const websiteLinks = location.websites.map((site, index) => `<a href="${escapeHtml(site)}">Website${location.websites.length > 1 ? ` ${index + 1}` : ''}</a>`);

  const outputs: Record<string, string> = {
    gallery: images.length ? `<div class="dm-locator__modal-gallery">
      <img class="dm-locator__modal-image" src="${escapeHtml(images[0])}" alt="${escapeHtml(location.name)}">
      ${images.length > 1 ? `<div class="dm-locator__modal-thumbs">${images.map((url, index) => `<img class="dm-locator__modal-thumb${index === 0 ? ' is-active' : ''}" src="${escapeHtml(url)}" alt="">`).join('')}</div>` : ''}
    </div>` : '',
    type: location.type ? `<span class="dm-locator__modal-type">${escapeHtml(location.type)}</span>` : '',
    name: `<h3 class="dm-locator__modal-title">${escapeHtml(location.name)}</h3>`,
    description: location.description ? `<p class="dm-locator__modal-description">${escapeHtml(location.description)}</p>` : '',
    address: `<address class="dm-locator__modal-address">${escapeHtml(address)}</address>`,
    phones: linkRow(phoneLinks),
    emails: linkRow(emailLinks),
    websites: linkRow(websiteLinks),
    contacts: linkRow([...phoneLinks, ...emailLinks, ...websiteLinks]),
    directions: `<a class="dm-locator__modal-directions" href="#">Get directions</a>`,
  };

  const sourceHtml = (source: string): string => {
    if (source in outputs) return outputs[source];
    if (source.startsWith('field:')) {
      const field = fieldById.get(source.slice(6));
      const value = String(customValues[source.slice(6)] ?? '').trim();
      return field && value ? customFieldHtml(field, value) : '';
    }
    if (source.startsWith('section:')) {
      const section = sectionById.get(source.slice(8));
      if (!section) return '';
      const rows = (section.fields ?? []).map((field) => {
        const value = String(customValues[field.id] ?? '').trim();
        return value ? customFieldHtml(field, value) : '';
      }).join('');
      return rows ? `<div class="dm-locator__modal-custom"><h4 class="dm-locator__modal-custom-title">${escapeHtml(section.title)}</h4>${rows}</div>` : '';
    }
    return '';
  };

  const blockStyle = (block: Block) => (block.color ? ` style="--dm-block-accent:${escapeHtml(block.color)};--dm-block-ink:${escapeHtml(block.color)}"` : '');

  const renderBlockInner = (block: Block): string => {
    const ink = block.color ? ` style="color:${escapeHtml(block.color)}"` : '';
    if (block.type === 'header') {
      const size = block.size === 'large' ? 'large' : block.size === 'small' ? 'small' : 'base';
      return `<h4 class="dm-locator__modal-heading dm-locator__modal-heading--${size}"${ink}>${escapeHtml(block.text || 'Heading')}</h4>`;
    }
    if (block.type === 'text') return `<p class="dm-locator__modal-text"${ink}>${escapeHtml(block.text || 'Text block — edit content in the panel.')}</p>`;
    if (block.type === 'divider') return `<hr class="dm-locator__modal-divider"${block.color ? ` style="border-color:${escapeHtml(block.color)}"` : ''}>`;
    if (block.type === 'spacer') return '<div class="dm-locator__modal-spacer"></div>';
    if (block.type === 'field') {
      const inner = sourceHtml(block.source ?? '');
      if (!inner) return `<span class="dm-editor__empty">No sample output</span>`;
      const label = block.label ? `<span class="dm-locator__modal-block-label">${escapeHtml(block.label)}</span>` : '';
      return `<div${blockStyle(block)}>${label}${inner}</div>`;
    }
    return '';
  };

  return modal.layout
    .map((row) => {
      const columns = (row.columns ?? [])
        .map((col) => `<div class="dm-locator__modal-col">${(col.blocks ?? []).filter((block) => !block.hidden).map(renderBlockInner).join('')}</div>`)
        .join('');
      const singleGallery = (row.columns ?? []).length === 1 && (row.columns[0]?.blocks ?? []).filter((block) => !block.hidden).length === 1 && row.columns[0]?.blocks[0]?.source === 'gallery';
      return `<div class="dm-locator__modal-row${singleGallery ? ' dm-locator__modal-row--bleed' : ''}">${columns}</div>`;
    })
    .join('');
};

const blockSummary = (block: Block, sourceLabels: Record<string, string>): string => {
  if (block.type === 'field') return sourceLabels[block.source] ?? block.source ?? 'pick an output';
  if (block.type === 'header') return `"${block.text || 'Heading'}"`;
  if (block.type === 'text') return block.text ? `${block.text.slice(0, 40)}${block.text.length > 40 ? '…' : ''}` : 'Free text';
  return '';
};

const BLOCK_LABELS: Record<string, string> = {header: 'Header', text: 'Text', field: 'Output', divider: 'Divider', spacer: 'Spacer'};

export default function ConstructorClient() {
  const [token, setToken] = useState('');
  const [sections, setSections] = useState<CustomSection[]>([]);
  const [modal, setModal] = useState<ModalConfig>({...DEFAULT_MODAL, layout: defaultLayout()});
  const [selected, setSelected] = useState<SelectedRef | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const dragRef = useRef<DragRef>(null);
  const [dropAt, setDropAt] = useState<SelectedRef | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const urlToken = new URLSearchParams(window.location.search).get('token') ?? '';
      if (!urlToken) {
        setError('Missing token. Open this editor from the Distributor Map app settings in Shopify admin.');
        setLoading(false);
        return;
      }
      setToken(urlToken);
      fetch('/api/admin/settings', {headers: {accept: 'application/json', Authorization: `Bearer ${urlToken}`}})
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401) throw new Error('Session expired — close this tab and reopen the editor from Shopify admin → Settings.');
          throw new Error(`Request failed (${response.status})`);
        }
        return response.json();
      })
      .then((payload) => {
        const nextSections: CustomSection[] = Array.isArray(payload?.customSections) ? payload.customSections : [];
        const config = payload?.modalConfig ?? {};
        setSections(nextSections);
        setModal({...DEFAULT_MODAL, ...config, layout: toLayout(config, nextSections)});
        setLoading(false);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load settings');
        setLoading(false);
      });
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const flatBlocks = modal.layout.flatMap((row) => row.columns.flatMap((col) => col.blocks));
      const legacyOrder: string[] = [];
      const legacyHidden: string[] = [];
      for (const block of flatBlocks) {
        if (block.type !== 'field' || !block.source) continue;
        const key = block.source === 'name' || block.source === 'type' ? 'header' : block.source;
        if (!legacyOrder.includes(key)) legacyOrder.push(key);
        if (block.hidden && !legacyHidden.includes(key)) legacyHidden.push(key);
      }
      const {layout, ...rest} = modal;
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {'content-type': 'application/json', accept: 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({modalConfig: {...rest, layout, blocks: flatBlocks, sections: legacyOrder, hidden: legacyHidden}}),
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error('Session expired — close this tab and reopen the editor from Shopify admin → Settings.');
        throw new Error(`Request failed (${response.status})`);
      }
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };

  // --- layout helpers --------------------------------------------------------

  const patchModalKey = <K extends 'backgroundColor' | 'textColor' | 'accentColor' | 'borderRadius' | 'width'>(key: K, value: ModalConfig[K]) =>
    setModal((current) => ({...current, [key]: value}));

  const patchLayout = (fn: (layout: Row[]) => Row[]) =>
    setModal((current) => ({...current, layout: fn(Array.isArray(current.layout) ? current.layout : [])}));

  const addRow = () => patchLayout((layout) => [...layout, makeRow([makeColumn()])]);
  const removeRow = (rowId: string) => patchLayout((layout) => layout.filter((row) => row.id !== rowId));
  const addColumn = (rowId: string) => patchLayout((layout) => layout.map((row) => (row.id === rowId && (row.columns ?? []).length < 4 ? {...row, columns: [...(row.columns ?? []), makeColumn()]} : row)));
  const removeColumn = (rowId: string, colId: string) => patchLayout((layout) => layout
    .map((row) => (row.id === rowId ? {...row, columns: (row.columns ?? []).filter((col) => col.id !== colId)} : row))
    .filter((row) => (row.columns ?? []).length > 0));

  const moveBlockTo = (from: SelectedRef, toRowId: string, toColId: string, toIndex: number) => patchLayout((layout) => {
    let moved: Block | null = null;
    const without = layout.map((row) => ({
      ...row,
      columns: row.columns.map((col) => {
        if (!(row.id === from.rowId && col.id === from.colId)) return col;
        moved = col.blocks[from.blockIndex] ?? null;
        return {...col, blocks: col.blocks.filter((_, i) => i !== from.blockIndex)};
      }),
    }));
    if (!moved) return layout;
    const movedBlock: Block = moved;
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

  const moveRowTo = (fromIndex: number, toIndex: number) => patchLayout((layout) => {
    const next = [...layout];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return layout;
    next.splice(Math.min(toIndex, next.length), 0, moved);
    return next;
  });

  const moveColumnTo = (rowId: string, fromIndex: number, toIndex: number) => patchLayout((layout) => layout.map((row) => {
    if (row.id !== rowId) return row;
    const columns = [...row.columns];
    const [moved] = columns.splice(fromIndex, 1);
    if (!moved) return row;
    columns.splice(Math.min(toIndex, columns.length), 0, moved);
    return {...row, columns};
  }));

  const patchBlockAt = (ref: SelectedRef, patch: Partial<Block>) => patchLayout((layout) => layout.map((row) => ({
    ...row,
    columns: row.columns.map((col) => (row.id === ref.rowId && col.id === ref.colId
      ? {...col, blocks: col.blocks.map((block, i) => (i === ref.blockIndex ? {...block, ...patch} : block))}
      : col)),
  })));

  const removeBlockAt = (ref: SelectedRef) => {
    patchLayout((layout) => layout.map((row) => ({
      ...row,
      columns: row.columns.map((col) => (row.id === ref.rowId && col.id === ref.colId
        ? {...col, blocks: col.blocks.filter((_, i) => i !== ref.blockIndex)}
        : col)),
    })));
    setSelected(null);
  };

  const addBlockTo = (type: Block['type']) => {
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

  // --- selection -------------------------------------------------------------

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
  const sourceLabels: Record<string, string> = {};
  for (const option of sourceOptions) sourceLabels[option.value] = option.label;

  const isSelected = (ref: SelectedRef, block: Block) => Boolean(
    selected && selected.rowId === ref.rowId && selected.colId === ref.colId
      && (modal.layout ?? []).find((row) => row.id === ref.rowId)?.columns?.find((col) => col.id === ref.colId)?.blocks?.[selected.blockIndex] === block,
  );

  // --- drag & drop -----------------------------------------------------------

  const allowDrop = (event: DragEvent) => event.preventDefault();

  const dropOnBlock = (event: DragEvent, ref: SelectedRef) => {
    event.preventDefault();
    event.stopPropagation();
    const drag = dragRef.current;
    dragRef.current = null;
    setDropAt(null);
    if (!drag) return;
    if (drag.kind === 'block') moveBlockTo({rowId: drag.rowId, colId: drag.colId, blockIndex: drag.index}, ref.rowId, ref.colId, ref.blockIndex);
  };

  const dropOnColumn = (event: DragEvent, rowId: string, colId: string) => {
    event.preventDefault();
    const drag = dragRef.current;
    dragRef.current = null;
    setDropAt(null);
    if (!drag) return;
    if (drag.kind === 'block') moveBlockTo({rowId: drag.rowId, colId: drag.colId, blockIndex: drag.index}, rowId, colId, 999);
    if (drag.kind === 'column') {
      const rowIndex = modal.layout.findIndex((row) => row.id === rowId);
      const targetIndex = modal.layout[rowIndex]?.columns.findIndex((col) => col.id === colId) ?? -1;
      if (targetIndex >= 0) moveColumnTo(rowId, drag.index, targetIndex);
    }
  };

  const dropOnRow = (event: DragEvent, rowIndex: number) => {
    event.preventDefault();
    const drag = dragRef.current;
    dragRef.current = null;
    setDropAt(null);
    if (drag?.kind === 'row') moveRowTo(drag.index, rowIndex);
  };

  const markDrop = (event: DragEvent, ref: SelectedRef | null) => {
    event.preventDefault();
    setDropAt(ref);
  };

  const previewVars = {
    '--dm-modal-bg': modal.backgroundColor,
    '--dm-modal-ink': modal.textColor,
    '--dm-modal-accent': modal.accentColor,
    '--dm-modal-radius': `${modal.borderRadius}px`,
    '--dm-modal-width': `${modal.width}px`,
    '--dm-accent': modal.accentColor,
    '--dm-primary': modal.accentColor,
    '--dm-ink': modal.textColor,
    '--dm-muted': '#66808b',
  } as CSSProperties;

  return (
    <main className="dm-editor" onDragLeave={() => setDropAt(null)}>
      <style>{MODAL_CSS}</style>
      <header className="dm-editor__bar">
        <div>
          <h1>Modal layout editor</h1>
          <p>Drag blocks between columns and rows. Click a block to edit it. Changes apply to the storefront modal after saving.</p>
        </div>
        <button type="button" className="dm-editor__save" onClick={() => void save()} disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </header>
      {error ? <div className="dm-editor__banner dm-editor__banner--error">{error}</div> : null}
      {saved ? <div className="dm-editor__banner dm-editor__banner--ok">Saved — the storefront modal uses this layout.</div> : null}
      {loading ? <p className="dm-editor__loading">Loading settings…</p> : (
        <div className="dm-editor__grid">
          <section className="dm-editor__canvas">
            <div className="dm-editor__palette">
              {BLOCK_TYPES.map((type) => (
                <button key={type.value} type="button" onClick={() => addBlockTo(type.value)}>+ {type.label}</button>
              ))}
              <span className="dm-editor__palette-hint">Adds below the selected block&apos;s column, or a new row when nothing is selected.</span>
            </div>

            <div className="dm-editor__modal-wrap" style={previewVars}>
              <div className="dm-locator__modal-card dm-editor__card">
                {(modal.layout ?? []).map((row, rowIndex) => (
                  <div
                    key={row.id}
                    className="dm-editor__row"
                    onDragOver={allowDrop}
                    onDrop={(event) => dropOnRow(event, rowIndex)}
                  >
                    <div className="dm-editor__row-bar">
                      <span
                        className="dm-editor__handle"
                        title="Drag to reorder row"
                        draggable
                        onDragStart={(event) => {dragRef.current = {kind: 'row', rowId: row.id, colId: '', index: rowIndex}; event.stopPropagation();}}
                      >⠿ row {rowIndex + 1}</span>
                      <span className="dm-editor__spacer" />
                      <button type="button" onClick={() => addColumn(row.id)} disabled={(row.columns ?? []).length >= 4}>+ column</button>
                      <button type="button" className="dm-editor__danger" onClick={() => removeRow(row.id)}>remove row</button>
                    </div>
                    <div className="dm-editor__cols">
                      {(row.columns ?? []).map((col, colIndex) => (
                        <div
                          key={col.id}
                          className={`dm-editor__col${dropAt?.colId === col.id && dropAt?.rowId === row.id ? ' dm-editor__col--drop' : ''}`}
                          onDragOver={(event) => markDrop(event, {rowId: row.id, colId: col.id, blockIndex: -1})}
                          onDrop={(event) => dropOnColumn(event, row.id, col.id)}
                        >
                          <div className="dm-editor__col-bar">
                            <span
                              className="dm-editor__handle"
                              title="Drag to reorder column"
                              draggable
                              onDragStart={(event) => {dragRef.current = {kind: 'column', rowId: row.id, colId: col.id, index: colIndex}; event.stopPropagation();}}
                            >⠿</span>
                            <button type="button" className="dm-editor__danger" onClick={() => removeColumn(row.id, col.id)}>✕</button>
                          </div>
                          {(col.blocks ?? []).map((block, blockIndex) => {
                            const ref = {rowId: row.id, colId: col.id, blockIndex};
                            const active = isSelected(ref, block);
                            return (
                              <div
                                key={block.id}
                                className={`dm-editor__block${active ? ' dm-editor__block--active' : ''}${block.hidden ? ' dm-editor__block--hidden' : ''}`}
                                draggable
                                onDragStart={(event) => {dragRef.current = {kind: 'block', rowId: row.id, colId: col.id, index: blockIndex}; event.stopPropagation();}}
                                onDragOver={(event) => markDrop(event, ref)}
                                onDrop={(event) => dropOnBlock(event, ref)}
                                onClick={() => setSelected(ref)}
                              >
                                <div className="dm-editor__block-tag">
                                  {BLOCK_LABELS[block.type] ?? block.type}
                                  {block.type === 'field' ? ` · ${blockSummary(block, sourceLabels)}` : ''}
                                  {block.hidden ? ' · hidden' : ''}
                                </div>
                                <div className="dm-editor__block-body" dangerouslySetInnerHTML={{__html: renderBlock(block, modal, sections)}} />
                              </div>
                            );
                          })}
                          {!(col.blocks ?? []).length && <div className="dm-editor__empty-col">drop blocks here</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button type="button" className="dm-editor__add-row" onClick={addRow}>+ add row</button>
              </div>
            </div>
          </section>

          <aside className="dm-editor__panel">
            <section>
              <h2>Modal style</h2>
              <label>Background
                <input type="color" value={modal.backgroundColor} onChange={(event) => patchModalKey('backgroundColor', event.target.value)} />
              </label>
              <label>Text
                <input type="color" value={modal.textColor} onChange={(event) => patchModalKey('textColor', event.target.value)} />
              </label>
              <label>Accent (links &amp; buttons)
                <input type="color" value={modal.accentColor} onChange={(event) => patchModalKey('accentColor', event.target.value)} />
              </label>
              <label>Corner radius — {modal.borderRadius}px
                <input type="range" min={0} max={40} value={modal.borderRadius} onChange={(event) => patchModalKey('borderRadius', Number(event.target.value))} />
              </label>
              <label>Width — {modal.width}px
                <input type="range" min={280} max={900} step={10} value={modal.width} onChange={(event) => patchModalKey('width', Number(event.target.value))} />
              </label>
            </section>

            {selectedBlock && (
              <section>
                <h2>Block — {BLOCK_LABELS[selectedBlock.block.type] ?? selectedBlock.block.type}</h2>
                {selectedBlock.block.type === 'header' && (
                  <>
                    <label>Heading text
                      <input type="text" value={selectedBlock.block.text} onChange={(event) => patchBlockAt(selectedBlock.ref, {text: event.target.value})} />
                    </label>
                    <label>Size
                      <select value={selectedBlock.block.size} onChange={(event) => patchBlockAt(selectedBlock.ref, {size: event.target.value})}>
                        {HEADER_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                    </label>
                  </>
                )}
                {selectedBlock.block.type === 'text' && (
                  <label>Content
                    <textarea rows={4} value={selectedBlock.block.text} onChange={(event) => patchBlockAt(selectedBlock.ref, {text: event.target.value})} />
                  </label>
                )}
                {selectedBlock.block.type === 'field' && (
                  <>
                    <label>Output
                      <select value={selectedBlock.block.source} onChange={(event) => patchBlockAt(selectedBlock.ref, {source: event.target.value})}>
                        {sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label>Label (optional)
                      <input type="text" value={selectedBlock.block.label} placeholder="Shown above the value" onChange={(event) => patchBlockAt(selectedBlock.ref, {label: event.target.value})} />
                    </label>
                  </>
                )}
                {selectedBlock.block.type !== 'spacer' && (
                  <label>Block color
                    <input type="color" value={selectedBlock.block.color || modal.accentColor} onChange={(event) => patchBlockAt(selectedBlock.ref, {color: event.target.value})} />
                    <button type="button" className="dm-editor__link" onClick={() => patchBlockAt(selectedBlock.ref, {color: ''})}>reset to modal accent</button>
                  </label>
                )}
                <label className="dm-editor__check">
                  <input type="checkbox" checked={selectedBlock.block.hidden} onChange={(event) => patchBlockAt(selectedBlock.ref, {hidden: event.target.checked})} />
                  Hide block on storefront
                </label>
                <button type="button" className="dm-editor__delete" onClick={() => removeBlockAt(selectedBlock.ref)}>Delete block</button>
              </section>
            )}

            {!selectedBlock && (
              <section>
                <h2>How to edit</h2>
                <ul className="dm-editor__help">
                  <li>Click any block to edit its content, output source, label and color.</li>
                  <li>Drag a block onto another block or into a column to move it.</li>
                  <li>Drag ⠿ handles to reorder rows and columns.</li>
                  <li>Use the palette to add headers, text, outputs, dividers and spacers.</li>
                </ul>
              </section>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

// Renders a block's real storefront markup for the canvas preview.
function renderBlock(block: Block, modal: ModalConfig, sections: CustomSection[]): string {
  const single: ModalConfig = {...modal, layout: [{id: 'r', columns: [{id: 'c', blocks: [block]}]}]};
  const body = renderModalBody(single, sections);
  // renderModalBody wraps in a row — strip the row wrapper for inline preview.
  return body.replace(/^<div class="dm-locator__modal-row[^"]*"><div class="dm-locator__modal-col">/, '').replace(/<\/div><\/div>$/, '');
}

const MODAL_CSS = `
.dm-locator *{box-sizing:border-box}
.dm-locator__modal-card{position:relative;width:min(var(--dm-modal-width,480px),100%);max-height:85vh;overflow:auto;background:var(--dm-modal-bg,#fff);color:var(--dm-modal-ink,#092633);border-radius:var(--dm-modal-radius,18px);box-shadow:0 24px 60px rgba(9,38,51,.35)}
.dm-locator__modal-image{display:block;width:100%;max-height:200px;object-fit:cover}
.dm-locator__modal-row{display:flex;gap:16px;padding:0 22px;margin-bottom:16px}
.dm-locator__modal-row--bleed{padding:0}
.dm-locator__modal-col{flex:1;min-width:0}
.dm-locator__modal-col>*{margin-bottom:12px}
.dm-locator__modal-col>*:last-child{margin-bottom:0}
.dm-locator__modal-type{display:inline-block;margin-bottom:6px;color:var(--dm-block-accent,var(--dm-modal-accent,var(--dm-accent)));font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.dm-locator__modal-title{margin:0;font-size:22px;letter-spacing:-.02em;line-height:1.15;color:var(--dm-block-ink,var(--dm-modal-ink,#092633))}
.dm-locator__modal-description{margin:0;color:var(--dm-block-ink,var(--dm-modal-ink,var(--dm-muted)));opacity:.75;font-size:14px;line-height:1.6}
.dm-locator__modal-address{display:block;margin:0;color:var(--dm-block-ink,var(--dm-modal-ink,var(--dm-ink)));font-size:13px;font-style:normal;line-height:1.5}
.dm-locator__modal-meta{display:flex;flex-wrap:wrap;gap:12px;font-size:12px}
.dm-locator__modal-meta a{color:var(--dm-block-accent,var(--dm-modal-accent,var(--dm-primary)))}
.dm-locator__modal-directions{display:inline-block;border-radius:999px;padding:12px 20px;background:var(--dm-block-accent,var(--dm-modal-accent,var(--dm-primary)));color:#fff;font-size:12px;font-weight:700;text-decoration:none}
.dm-locator__modal-custom-title{margin:0 0 8px;color:var(--dm-block-accent,var(--dm-modal-accent,var(--dm-accent)));font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.dm-locator__modal-field{display:flex;gap:8px;margin-bottom:6px;font-size:13px}
.dm-locator__modal-field-label{color:var(--dm-block-ink,var(--dm-modal-ink,var(--dm-ink)));font-weight:600;opacity:.6}
.dm-locator__modal-field a{color:var(--dm-block-accent,var(--dm-modal-accent,var(--dm-primary)))}
.dm-locator__modal-heading{margin:0;color:var(--dm-block-ink,var(--dm-modal-ink,var(--dm-ink)));line-height:1.2}
.dm-locator__modal-heading--small{font-size:12px;text-transform:uppercase;letter-spacing:.1em}
.dm-locator__modal-heading--base{font-size:16px}
.dm-locator__modal-heading--large{font-size:24px;letter-spacing:-.02em}
.dm-locator__modal-text{margin:0;color:var(--dm-block-ink,var(--dm-modal-ink,var(--dm-muted)));font-size:14px;line-height:1.6}
.dm-locator__modal-divider{border:0;border-top:1px solid var(--dm-block-accent,#d8e8ec);margin:0}
.dm-locator__modal-spacer{height:12px}
.dm-locator__modal-block-label{display:block;margin-bottom:3px;color:var(--dm-modal-ink,var(--dm-ink));font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.55}
.dm-locator__modal-thumbs{display:flex;gap:8px;padding:10px 12px;overflow-x:auto;background:#f4f9fa}
.dm-locator__modal-thumb{width:56px;height:56px;flex:0 0 auto;object-fit:cover;border-radius:8px;border:2px solid transparent;opacity:.7}
.dm-locator__modal-thumb.is-active{border-color:var(--dm-accent);opacity:1}

.dm-editor{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f4f5;min-height:100vh;color:#092633}
.dm-editor__bar{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 24px;background:#fff;border-bottom:1px solid #d8e8ec;position:sticky;top:0;z-index:10}
.dm-editor__bar h1{margin:0;font-size:18px}
.dm-editor__bar p{margin:2px 0 0;font-size:12px;color:#66808b}
.dm-editor__save{border:0;border-radius:999px;background:#176274;color:#fff;font:inherit;font-size:13px;font-weight:700;padding:11px 22px;cursor:pointer}
.dm-editor__save:disabled{opacity:.6;cursor:default}
.dm-editor__banner{margin:12px 24px 0;padding:10px 14px;border-radius:8px;font-size:13px}
.dm-editor__banner--error{background:#fdeeee;color:#a33;border:1px solid #eec9c9}
.dm-editor__banner--ok{background:#eaf7ee;color:#1c6b3a;border:1px solid #bfe3cb}
.dm-editor__loading{padding:40px;text-align:center;color:#66808b}
.dm-editor__grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:20px;padding:20px 24px 60px;align-items:start}
.dm-editor__palette{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}
.dm-editor__palette button{border:1px solid #c4d5da;background:#fff;border-radius:999px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;color:#092633}
.dm-editor__palette button:hover{border-color:#176274;color:#176274}
.dm-editor__palette-hint{font-size:11px;color:#66808b}
.dm-editor__modal-wrap{display:flex;justify-content:center;padding:24px;background:#dde7ea;border-radius:16px;border:1px solid #c9d9de}
.dm-editor__card{width:min(var(--dm-modal-width),100%);padding:8px}
.dm-editor__row{border:1.5px dashed #b9cdd4;border-radius:10px;margin-bottom:10px;padding:8px}
.dm-editor__row-bar{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.dm-editor__row-bar button{border:1px solid #c4d5da;background:#fff;border-radius:6px;font-size:11px;padding:3px 9px;cursor:pointer}
.dm-editor__row-bar .dm-editor__danger{color:#a33;border-color:#e0b4b4}
.dm-editor__handle{cursor:grab;font-size:12px;color:#66808b;user-select:none}
.dm-editor__spacer{flex:1}
.dm-editor__cols{display:flex;gap:8px}
.dm-editor__col{flex:1;min-width:0;min-height:60px;border:1.5px dashed #cfe0e5;border-radius:8px;padding:6px;background:rgba(255,255,255,.55)}
.dm-editor__col--drop{border-color:#176274;background:rgba(23,98,116,.08)}
.dm-editor__col-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.dm-editor__col-bar button{border:0;background:none;color:#a33;font-size:11px;cursor:pointer;padding:0}
.dm-editor__block{padding:7px 8px;margin-bottom:7px;border-radius:7px;cursor:grab;border:1.5px solid #dbe7eb;background:#fff}
.dm-editor__block--active{border-color:#176274;box-shadow:0 0 0 1px #176274}
.dm-editor__block--hidden{opacity:.5}
.dm-editor__block-tag{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#66808b;margin-bottom:5px}
.dm-editor__block-body{font-size:12px;pointer-events:none}
.dm-editor__block-body .dm-locator__modal-image{max-height:90px}
.dm-editor__empty-col{font-size:10px;color:#93aab3;text-align:center;padding:14px 0}
.dm-editor__add-row{width:100%;border:1.5px dashed #b9cdd4;background:none;border-radius:10px;padding:10px;font-size:12px;color:#176274;cursor:pointer}
.dm-editor__panel{position:sticky;top:86px;background:#fff;border:1px solid #d8e8ec;border-radius:14px;padding:18px;max-height:calc(100vh - 110px);overflow:auto}
.dm-editor__panel section+section{margin-top:22px;border-top:1px solid #e6eef0;padding-top:18px}
.dm-editor__panel h2{margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#66808b}
.dm-editor__panel label{display:block;font-size:12px;font-weight:600;margin-bottom:12px}
.dm-editor__panel input[type=text],.dm-editor__panel select,.dm-editor__panel textarea{display:block;width:100%;margin-top:5px;border:1px solid #c4d5da;border-radius:8px;padding:8px 10px;font:inherit;font-size:13px;box-sizing:border-box}
.dm-editor__panel input[type=color]{display:block;margin-top:5px;width:100%;height:34px;border:1px solid #c4d5da;border-radius:8px;padding:2px;cursor:pointer;background:#fff}
.dm-editor__panel input[type=range]{display:block;width:100%;margin-top:8px}
.dm-editor__check{display:flex;align-items:center;gap:8px;font-weight:500}
.dm-editor__check input{margin:0}
.dm-editor__link{display:inline-block;margin-top:6px;border:0;background:none;color:#176274;font-size:11px;cursor:pointer;padding:0;text-decoration:underline}
.dm-editor__delete{margin-top:4px;border:1px solid #e0b4b4;background:#fff;color:#a33;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer}
.dm-editor__help{margin:0;padding-left:18px;font-size:12px;color:#445f68;line-height:1.7}
.dm-editor__empty{font-size:11px;color:#93aab3;font-style:italic}
@media (max-width:900px){.dm-editor__grid{grid-template-columns:1fr}.dm-editor__panel{position:static}}
`;
