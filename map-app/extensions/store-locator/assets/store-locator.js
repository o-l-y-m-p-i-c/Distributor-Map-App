(() => {
  const roots = document.querySelectorAll('[data-dm-locator]');
  const mapScriptUrl = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
  const mapCssUrl = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
  let mapLoader;

  const loadMapLibre = () => {
    if (mapLoader) return mapLoader;
    mapLoader = new Promise((resolve, reject) => {
      if (window.maplibregl) return resolve(window.maplibregl);
      if (!document.querySelector(`link[href="${mapCssUrl}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = mapCssUrl;
        document.head.appendChild(link);
      }
      const script = document.createElement('script');
      script.src = mapScriptUrl;
      script.onload = () => resolve(window.maplibregl);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return mapLoader;
  };

  roots.forEach((root) => {
    const form = root.querySelector('[data-dm-search]');
    const searchInput = form?.querySelector('input[name="q"]');
    const clearSearchButton = root.querySelector('[data-dm-clear-search]');
    const list = root.querySelector('[data-dm-list]');
    const resultsPane = root.querySelector('.dm-locator__results');
    const resultsScrollbar = root.querySelector('[data-dm-results-scrollbar]');
    const count = root.querySelector('[data-dm-count]');
    const status = root.querySelector('[data-dm-status]');
    const empty = root.querySelector('[data-dm-empty]');
    const error = root.querySelector('[data-dm-error]');
    const mapContainer = root.querySelector('[data-dm-map]');
    const searchAreaButton = root.querySelector('[data-dm-search-area]');
    const openListButton = root.querySelector('[data-dm-open-list]');
    const closeListButton = root.querySelector('[data-dm-close-list]');
    const endpoint = root.dataset.endpoint;
    const translationScript = root.parentElement?.querySelector('[data-dm-locator-translations]');
    let translations = {};
    try { translations = JSON.parse(translationScript?.textContent || '{}'); } catch {}
    const translate = (key, fallback) => translations[key] || fallback;
    const snapshotScript = root.parentElement?.querySelector('[data-dm-locator-snapshot]');
    let snapshotLocations = null;
    try {
      const parsed = JSON.parse(snapshotScript?.textContent || 'null');
      if (Array.isArray(parsed)) {
        const parseArray = (value) => {
          if (Array.isArray(value)) return value;
          if (typeof value !== 'string') return [];
          try { const result = JSON.parse(value); return Array.isArray(result) ? result : []; } catch { return value.split('|').filter(Boolean); }
        };
        snapshotLocations = parsed.map((location) => ({...location, latitude: location.latitude == null || location.latitude === '' ? null : Number(location.latitude), longitude: location.longitude == null || location.longitude === '' ? null : Number(location.longitude), phones: parseArray(location.phones), emails: parseArray(location.emails), websites: parseArray(location.websites), imageUrls: parseArray(location.imageUrls), productIds: parseArray(location.productIds)}));
      }
    } catch {}
    let map;
    let locations = [];
    const locationCache = new Map();
    let suppressNextMoveend = false;
    let viewportSearchActive = false;
    let viewportSearchTimer = null;
    let searchSequence = 0;
    const markerStyle = root.dataset.dmMarkerStyle || 'default';
    const cardStyle = root.dataset.dmCardStyle || 'default';
    const markerShape = root.dataset.dmMarkerShape || '50%';
    const photoMarkers = new Map();

    if (!form || !searchInput || !list || !count || !status || !empty || !error || !mapContainer || !endpoint) return;

    const syncResultsScrollbar = () => {
      const thumb = resultsScrollbar?.querySelector('span');
      if (!resultsPane || !resultsScrollbar || !thumb) return;
      const overflow = resultsPane.scrollHeight > resultsPane.clientHeight + 1;
      resultsScrollbar.hidden = !overflow;
      if (!overflow) return;
      const ratio = resultsPane.clientHeight / resultsPane.scrollHeight;
      const thumbSize = Math.max(ratio * 100, 12);
      thumb.style.height = `${thumbSize}%`;
      thumb.style.transform = `translateY(${(resultsPane.scrollTop / (resultsPane.scrollHeight - resultsPane.clientHeight)) * (100 - thumbSize)}%)`;
    };

    resultsPane?.addEventListener('scroll', syncResultsScrollbar, {passive: true});
    if (typeof ResizeObserver !== 'undefined' && resultsPane) new ResizeObserver(syncResultsScrollbar).observe(resultsPane);
    window.setTimeout(syncResultsScrollbar, 0);

    const normalizeThemeColor = (value) => {
      const color = String(value ?? '').trim();
      if (!color) return '';
      if (/^#|^(rgb|rgba|hsl|hsla)\(/i.test(color)) return color;
      const channels = color.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
      return channels.length === 3 && channels.every((channel) => /^\d+(?:\.\d+)?$/.test(channel))
        ? `rgb(${channels.join(',')})`
        : color;
    };
    const themeStyles = getComputedStyle(root);
    let themeSurface = '';
    let themeForeground = '';
    let themeNode = root.parentElement;
    while (themeNode && (!themeSurface || !themeForeground)) {
      const styles = getComputedStyle(themeNode);
      const background = styles.backgroundColor;
      const foreground = styles.color;
      if (!themeSurface && background && !/rgba?\(0,\s*0,\s*0(?:,\s*0)?\)/.test(background)) themeSurface = background;
      if (!themeForeground && foreground) themeForeground = foreground;
      themeNode = themeNode.parentElement;
    }
    const themeColors = {
      primary: normalizeThemeColor(themeStyles.getPropertyValue('--color-button')) || themeForeground,
      accent: normalizeThemeColor(themeStyles.getPropertyValue('--color-link')) || themeForeground,
      buttonText: normalizeThemeColor(themeStyles.getPropertyValue('--color-button-text')) || themeSurface,
      ink: normalizeThemeColor(themeStyles.getPropertyValue('--color-foreground')) || themeForeground,
      muted: normalizeThemeColor(themeStyles.getPropertyValue('--color-foreground-secondary')) || themeForeground,
    };
    Object.entries(themeColors).forEach(([name, color]) => {
      if (color) root.style.setProperty(`--dm-${name}`, color);
    });
    if (themeSurface) root.style.setProperty('--dm-surface', themeSurface);

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;',
    }[character]));

    const modal = document.createElement('div');
    modal.className = 'dm-locator__modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="dm-locator__modal-backdrop" data-dm-modal-close></div>
      <div class="dm-locator__modal-card" role="dialog" aria-modal="true">
        <button type="button" class="dm-locator__modal-close" data-dm-modal-close aria-label="${translate('close', 'Close')}">&#215;</button>
        <div data-dm-modal-body></div>
      </div>`;
    root.appendChild(modal);
    const modalBody = modal.querySelector('[data-dm-modal-body]');
    const navigationModal = document.createElement('div');
    navigationModal.className = 'dm-locator__navigation-modal';
    navigationModal.hidden = true;
    navigationModal.innerHTML = `
      <div class="dm-locator__navigation-backdrop" data-dm-navigation-close></div>
      <div class="dm-locator__navigation-card" role="dialog" aria-modal="true" aria-labelledby="dm-navigation-title-${root.dataset.dmLocator || 'locator'}">
        <button type="button" class="dm-locator__modal-close" data-dm-navigation-close aria-label="${translate('close', 'Close')}">&#215;</button>
        <strong id="dm-navigation-title-${root.dataset.dmLocator || 'locator'}">${translate('chooseNavigation', 'Choose navigation app')}</strong>
        <div class="dm-locator__navigation-options">
          <button type="button" data-dm-nav-provider="auto">${translate('automaticNavigation', 'Automatic / System')}</button>
          <button type="button" data-dm-nav-provider="google">Google Maps</button>
          <button type="button" data-dm-nav-provider="apple">Apple Maps</button>
          <button type="button" data-dm-nav-provider="waze">Waze</button>
          <button type="button" data-dm-nav-provider="here">HERE WeGo</button>
        </div>
      </div>`;
    root.appendChild(navigationModal);

    const closeNavigationModal = () => { navigationModal.hidden = true; };

    const closeModal = () => {
      modal.hidden = true;
      document.body.classList.remove('dm-locator-modal-open');
    };

    const setListOpen = (open) => {
      root.classList.toggle('dm-locator--list-open', open);
      document.body.classList.toggle('dm-locator-list-open', open);
      openListButton?.setAttribute('aria-expanded', String(open));
    };

    openListButton?.addEventListener('click', () => setListOpen(true));
    closeListButton?.addEventListener('click', () => setListOpen(false));

    let storefrontSettings = null;
    const settingsEndpoint = endpoint.replace(/\/search$/, '/settings');
    if (settingsEndpoint !== endpoint) {
      fetch(settingsEndpoint, {headers: {Accept: 'application/json'}})
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          storefrontSettings = payload;
          const config = payload?.modalConfig ?? {};
          const themeModalBackground = root.style.getPropertyValue('--dm-surface').trim();
          const themeModalInk = root.style.getPropertyValue('--dm-ink').trim();
          const themeModalAccent = root.style.getPropertyValue('--dm-accent').trim();
          root.style.setProperty('--dm-modal-bg', themeModalBackground || config.backgroundColor || '#fff');
          root.style.setProperty('--dm-modal-ink', themeModalInk || config.textColor || '#092633');
          root.style.setProperty('--dm-modal-accent', themeModalAccent || config.accentColor || '#176274');
          if (Number.isFinite(config.borderRadius)) root.style.setProperty('--dm-modal-radius', `${config.borderRadius}px`);
          if (Number.isFinite(config.width)) root.style.setProperty('--dm-modal-width', `${config.width}px`);
        })
        .catch(() => {});
    }
    const loadModalImage = (url) => {
      const gallery = modal.querySelector('.dm-locator__modal-gallery');
      const image = modal.querySelector('.dm-locator__modal-image');
      const backdrop = modal.querySelector('[data-dm-modal-backdrop]');
      if (!gallery || !image) return;
      gallery.classList.add('dm-locator__modal-gallery--loading');
      image.classList.add('is-loading');
      if (backdrop) backdrop.style.backgroundImage = `url(${JSON.stringify(url)})`;
      const finish = (valid) => {
        gallery.classList.remove('dm-locator__modal-gallery--loading');
        image.classList.remove('is-loading');
        image.classList.toggle('is-error', !valid);
      };
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      image.src = url;
      if (image.complete) finish(image.naturalWidth > 0);
    };

    modal.addEventListener('click', (event) => {
      const navigationTrigger = event.target.closest('[data-dm-nav-open]');
      if (navigationTrigger) { event.preventDefault(); navigationModal.hidden = false; return; }
      if (event.target.closest('[data-dm-modal-close]')) { closeModal(); return; }
      const thumb = event.target.closest('[data-dm-modal-thumb]');
      if (thumb) {
        loadModalImage(thumb.dataset.dmModalThumb);
        modal.querySelectorAll('.dm-locator__modal-thumb').forEach((item) => item.classList.toggle('is-active', item === thumb));
      }
    });
    navigationModal.addEventListener('click', (event) => {
      if (event.target.closest('[data-dm-navigation-close]')) { closeNavigationModal(); return; }
      const providerButton = event.target.closest('[data-dm-nav-provider]');
      if (!providerButton || !modalLocation) return;
      window.open(navigationUrl(modalLocation, providerButton.dataset.dmNavProvider), '_blank', 'noopener,noreferrer');
      closeNavigationModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeNavigationModal();
      if (event.key === 'Escape') closeModal();
    });

    const addressOf = (location) => [location.addressLine1, location.city, location.state, location.postalCode, location.country].filter(Boolean).join(', ');

    const isAndroid = () => /Android/i.test(navigator.userAgent);
    const isAppleDevice = () => /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
    const navigationProvider = () => isAppleDevice() ? 'apple' : 'google';
    const navigationUrl = (location, provider = 'auto') => {
      if (provider === 'auto' && location.buttonUrl && /^https?:\/\//.test(location.buttonUrl)) return location.buttonUrl;
      const hasCoordinates = location.latitude != null && location.longitude != null;
      const coordinates = hasCoordinates ? `${Number(location.latitude)},${Number(location.longitude)}` : '';
      const query = encodeURIComponent(addressOf(location));
      if (provider === 'auto' && isAndroid() && hasCoordinates) return `geo:${coordinates}?q=${encodeURIComponent(`${coordinates} (${location.name})`)}`;
      const selectedProvider = provider === 'auto' ? navigationProvider() : provider;
      if (selectedProvider === 'apple') return hasCoordinates ? `https://maps.apple.com/?daddr=${coordinates}` : `https://maps.apple.com/?address=${query}`;
      if (selectedProvider === 'waze') return hasCoordinates ? `https://www.waze.com/ul?ll=${encodeURIComponent(coordinates)}&navigate=yes` : `https://www.waze.com/ul?q=${query}&navigate=yes`;
      if (selectedProvider === 'here') return hasCoordinates ? `https://wego.here.com/directions/mix/${coordinates}` : `https://wego.here.com/search/${query}`;
      return hasCoordinates ? `https://www.google.com/maps/dir/?api=1&destination=${coordinates}` : `https://www.google.com/maps/search/?api=1&query=${query}`;
    };

    const directionsHtml = () => `<div class="dm-locator__directions">
      <button type="button" class="dm-locator__modal-directions" data-dm-nav-open>${translate('getDirections', 'Get directions')}</button>
    </div>`;

    let modalLocation = null;

    /** @param {{id: string, label: string, type: string}} field @param {string} value */
    const customFieldHtml = (field, value) => {
      const escaped = escapeHtml(value);
      let rendered = `<span>${escaped}</span>`;
      if (field.type === 'url') rendered = `<a href="${escaped}" target="_blank" rel="noopener noreferrer">${escaped}</a>`;
      if (field.type === 'email') rendered = `<a href="mailto:${escaped}">${escaped}</a>`;
      if (field.type === 'phone') rendered = `<a href="tel:${escaped}">${escaped}</a>`;
      return `<div class="dm-locator__modal-field"><span class="dm-locator__modal-field-label">${escapeHtml(field.label)}</span>${rendered}</div>`;
    };

    const openModal = (location) => {
      modalLocation = location;
      const address = addressOf(location);
      const images = Array.isArray(location.imageUrls) && location.imageUrls.length ? location.imageUrls : (location.imageUrl ? [location.imageUrl] : []);
      const phones = Array.isArray(location.phones) ? location.phones : location.phone ? [location.phone] : [];
      const emails = Array.isArray(location.emails) ? location.emails : location.email ? [location.email] : [];
      const websites = Array.isArray(location.websites) ? location.websites : location.website ? [location.website] : [];
      const customValues = location.customValues && typeof location.customValues === 'object' ? location.customValues : {};
      const customSections = Array.isArray(storefrontSettings?.customSections) ? storefrontSettings.customSections : [];
      const fieldById = new Map(customSections.flatMap((section) => (section.fields ?? []).map((field) => [field.id, field])));
      const sectionById = new Map(customSections.map((section) => [section.id, section]));

      const linkRow = (links) => (links.length ? `<div class="dm-locator__modal-meta">${links.join('')}</div>` : '');
      const phoneLinks = phones.map((phone) => `<a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a>`);
      const emailLinks = emails.map((email) => `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`);
      const websiteLinks = websites.map((site, index) => `<a href="${escapeHtml(site)}" target="_blank" rel="noopener noreferrer">Website${websites.length > 1 ? ` ${index + 1}` : ''}</a>`);

      const outputs = {
        gallery: images.length ? `<div class="dm-locator__modal-gallery">
          <div class="dm-locator__modal-image-backdrop" data-dm-modal-backdrop aria-hidden="true"></div>
          <img class="dm-locator__modal-image" src="${escapeHtml(images[0])}" alt="${escapeHtml(location.name)}" loading="lazy">
          ${images.length > 1 ? `<div class="dm-locator__modal-thumbs">${images.map((url, index) => `<img class="dm-locator__modal-thumb${index === 0 ? ' is-active' : ''}" src="${escapeHtml(url)}" data-dm-modal-thumb="${escapeHtml(url)}" alt="${escapeHtml(location.name)} ${index + 1}" loading="lazy">`).join('')}</div>` : ''}
        </div>` : '',
        type: location.type ? `<span class="dm-locator__modal-type">${escapeHtml(location.type)}</span>` : '',
        name: `<h3 class="dm-locator__modal-title">${escapeHtml(location.name)}</h3>`,
        description: location.description ? `<p class="dm-locator__modal-description">${escapeHtml(location.description)}</p>` : '',
        address: address ? `<address class="dm-locator__modal-address">${escapeHtml(address)}</address>` : '',
        phones: storefrontSettings?.showPhone === false ? '' : linkRow(phoneLinks),
        emails: linkRow(emailLinks),
        websites: storefrontSettings?.showWebsite === false ? '' : linkRow(websiteLinks),
        contacts: linkRow([
          ...(storefrontSettings?.showPhone === false ? [] : phoneLinks),
          ...emailLinks,
          ...(storefrontSettings?.showWebsite === false ? [] : websiteLinks),
        ]),
        directions: storefrontSettings?.showDirections === false ? '' : directionsHtml(location),
      };

      /** @param {string} source */
      const sourceHtml = (source) => {
        if (source in outputs) return outputs[source];
        if (source.startsWith('field:')) {
          const field = fieldById.get(source.slice(6));
          const value = String(customValues[source.slice(6)] ?? '').trim();
          return field && value ? customFieldHtml(field, value) : '';
        }
        if (source.startsWith('section:')) {
          const section = sectionById.get(source.slice(8));
          if (!section) return '';
          const rows = (section.fields ?? []).map((field) => { const value = String(customValues[field.id] ?? '').trim(); return value ? customFieldHtml(field, value) : ''; }).join('');
          return rows ? `<div class="dm-locator__modal-custom"><h4 class="dm-locator__modal-custom-title">${escapeHtml(section.title)}</h4>${rows}</div>` : '';
        }
        return '';
      };

      // Resolve layout: rows → columns → blocks; fall back to flat blocks, then legacy section order.
      const configured = storefrontSettings?.modalConfig ?? {};
      /** @param {any} block @param {string} source */
      const toBlock = (block, source) => ({type: 'field', text: '', label: '', color: '', size: 'base', hidden: false, ...(block ?? {}), source});
      /** @param {any[]} blockList */
      const wrapRows = (blockList) => [{id: 'row', columns: [{id: 'col', blocks: blockList}]}];
      let rows = Array.isArray(configured.layout) && configured.layout.length ? configured.layout : null;
      if (!rows) {
        let blocks = Array.isArray(configured.blocks) && configured.blocks.length ? configured.blocks : null;
        if (!blocks) {
          const defaultOrder = ['gallery', 'header', 'description', 'address', 'contacts', 'directions', ...customSections.map((section) => `section:${section.id}`)];
          const savedOrder = Array.isArray(configured.sections) ? configured.sections : [];
          const order = [...savedOrder.filter((key) => key in outputs || key.startsWith('section:')), ...defaultOrder.filter((key) => !savedOrder.includes(key))];
          const hiddenKeys = new Set(Array.isArray(configured.hidden) ? configured.hidden : []);
          blocks = order.flatMap((key) => (key === 'header'
            ? [toBlock({hidden: hiddenKeys.has('header')}, 'type'), toBlock({hidden: hiddenKeys.has('header')}, 'name')]
            : [toBlock({hidden: hiddenKeys.has(key)}, key)]));
        }
        rows = wrapRows(blocks);
      }

      const blockStyle = (block) => (block.color ? ` style="--dm-block-accent:${escapeHtml(block.color)};--dm-block-ink:${escapeHtml(block.color)}"` : '');

      /** @param {{type: string, text?: string, source?: string, label?: string, color?: string, size?: string}} block */
      const renderBlockInner = (block) => {
        const ink = block.color ? ` style="color:${escapeHtml(block.color)}"` : '';
        if (block.type === 'header') {
          const size = block.size === 'large' ? 'large' : block.size === 'small' ? 'small' : 'base';
          return `<h4 class="dm-locator__modal-heading dm-locator__modal-heading--${size}"${ink}>${escapeHtml(block.text ?? '')}</h4>`;
        }
        if (block.type === 'text') return block.text ? `<p class="dm-locator__modal-text"${ink}>${escapeHtml(block.text)}</p>` : '';
        if (block.type === 'divider') return `<hr class="dm-locator__modal-divider"${block.color ? ` style="border-color:${escapeHtml(block.color)}"` : ''}>`;
        if (block.type === 'spacer') return '<div class="dm-locator__modal-spacer"></div>';
        if (block.type === 'field') {
          const inner = sourceHtml(block.source ?? '');
          if (!inner) return '';
          const label = block.label ? `<span class="dm-locator__modal-block-label">${escapeHtml(block.label)}</span>` : '';
          return `<div${blockStyle(block)}>${label}${inner}</div>`;
        }
        return '';
      };

      modalBody.innerHTML = rows
        .map((row) => {
          const columns = (row.columns ?? [])
            .map((col) => `<div class="dm-locator__modal-col">${(col.blocks ?? []).filter((block) => !block.hidden).map(renderBlockInner).join('')}</div>`)
            .join('');
          const singleGallery = (row.columns ?? []).length === 1 && (row.columns[0].blocks ?? []).filter((block) => !block.hidden).length === 1 && row.columns[0].blocks[0]?.source === 'gallery';
          return `<div class="dm-locator__modal-row${singleGallery ? ' dm-locator__modal-row--bleed' : ''}">${columns}</div>`;
        })
        .join('');
      if (images[0]) loadModalImage(images[0]);
      modal.hidden = false;
      document.body.classList.add('dm-locator-modal-open');
    };

    const selectLocation = (id) => {
      list.querySelectorAll('.is-active').forEach((item) => item.classList.remove('is-active'));
      const card = list.querySelector(`[data-dm-location="${CSS.escape(id)}"]`);
      card?.classList.add('is-active');
      const location = locations.find((item) => String(item.id) === String(id));
      if (map && location?.longitude != null && location?.latitude != null) {
        const targetZoom = Math.min(Math.max(map.getZoom() + 2, 13), 18);
        map.flyTo({center: [Number(location.longitude), Number(location.latitude)], zoom: targetZoom, essential: true});
      }
      setListOpen(false);
      return location;
    };

    const openLocationModal = (id) => {
      const location = selectLocation(id);
      if (location) openModal(location);
    };

    const visibleLocations = () => {
      if (!map) return locations;
      const bounds = map.getBounds();
      return locations.filter((location) => {
        if (location.latitude == null || location.longitude == null) return true;
        return bounds.contains([Number(location.longitude), Number(location.latitude)]);
      });
    };

    const renderList = (visible) => {
      list.innerHTML = visible.map((location) => `
        <div class="dm-locator__card dm-locator__card--${escapeHtml(cardStyle)}" role="button" tabindex="0" data-dm-location="${escapeHtml(location.id)}">
          ${['photo', 'photo-left'].includes(cardStyle) && (location.imageUrls?.[0] || location.imageUrl) ? `<img class="dm-locator__card-image" src="${escapeHtml(location.imageUrls?.[0] || location.imageUrl)}" alt="${escapeHtml(location.name)}" loading="lazy">` : ''}
          <div class="dm-locator__card-content">
            <strong>${escapeHtml(location.name)}</strong>
            <address>${escapeHtml([location.addressLine1, location.city, location.country].filter(Boolean).join(', '))}</address>
            ${location.distanceKilometers != null ? `<span class="dm-locator__distance">${Number(location.distanceKilometers).toFixed(1)} km away</span>` : ''}
            <button type="button" class="dm-locator__details" data-dm-details="${escapeHtml(location.id)}">${translate('viewDetails', 'View details')}</button>
          </div>
        </div>
      `).join('');
      count.textContent = `${visible.length} ${visible.length === 1 ? 'location' : 'locations'}`;
      empty.hidden = visible.length > 0;
      list.querySelectorAll('[data-dm-location]').forEach((card) => {
        card.addEventListener('click', () => selectLocation(card.dataset.dmLocation));
        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectLocation(card.dataset.dmLocation); }
        });
      });
      list.querySelectorAll('[data-dm-details]').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          openLocationModal(button.dataset.dmDetails);
        });
      });
    };

    const render = (nextLocations) => {
      locations = nextLocations;
      renderList(locations);
    };

    const removePhotoMarkers = () => {
      photoMarkers.forEach((marker) => marker.remove());
      photoMarkers.clear();
    };

    const syncPhotoMarkers = () => {
      if (!map || markerStyle !== 'photo') {
        removePhotoMarkers();
        return;
      }
      const sourceFeatures = map.querySourceFeatures('dm-locations') || [];
      const sourceReady = sourceFeatures.length > 0;
      const visibleIds = new Set(
        sourceFeatures
          .filter((feature) => !feature.properties?.point_count)
          .map((feature) => String(feature.properties?.id)),
      );
      locations.forEach((location) => {
        const imageUrl = Array.isArray(location.imageUrls) && location.imageUrls[0]
          ? location.imageUrls[0]
          : location.imageUrl;
        if (!imageUrl || location.latitude == null || location.longitude == null) return;
        let marker = photoMarkers.get(String(location.id));
        if (!marker) {
          const element = document.createElement('button');
          element.type = 'button';
          element.className = `dm-locator__photo-marker${markerShape === 'raindrop' ? ' dm-locator__photo-marker--raindrop' : ''}`;
          element.setAttribute('aria-label', `View ${location.name}`);
          element.innerHTML = `<span class="dm-locator__photo-marker-shape"><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy"></span>`;
          element.addEventListener('click', (event) => {
            event.stopPropagation();
            openLocationModal(location.id);
          });
          marker = new window.maplibregl.Marker({element, anchor: markerShape === 'raindrop' ? 'bottom' : 'center'})
            .setLngLat([Number(location.longitude), Number(location.latitude)])
            .addTo(map);
          photoMarkers.set(String(location.id), marker);
        } else {
          marker.setLngLat([Number(location.longitude), Number(location.latitude)]);
          if (!marker.getElement().isConnected) marker.addTo(map);
        }
        const inViewport = map.getBounds().contains([Number(location.longitude), Number(location.latitude)]);
        const isVisible = sourceReady ? visibleIds.has(String(location.id)) : inViewport;
        marker.getElement().style.display = isVisible ? '' : 'none';
      });
      photoMarkers.forEach((marker, id) => {
        if (!locations.some((location) => String(location.id) === id)) {
          marker.remove();
          photoMarkers.delete(id);
        }
      });
    };

    const updateMap = (nextLocations, center) => {
      if (!map) return;
      const source = map.getSource('dm-locations');
      const features = nextLocations.filter((location) => location.longitude != null && location.latitude != null).map((location) => ({
        type: 'Feature',
        geometry: {type: 'Point', coordinates: [Number(location.longitude), Number(location.latitude)]},
        properties: {
          id: String(location.id),
          name: location.name,
          photoMarker: Boolean((Array.isArray(location.imageUrls) && location.imageUrls[0]) || location.imageUrl),
        },
      }));
      source?.setData({type: 'FeatureCollection', features});
      setTimeout(syncPhotoMarkers, 0);
      if (center?.latitude != null && center?.longitude != null) {
        suppressNextMoveend = true;
        map.flyTo({center: [center.longitude, center.latitude], zoom: 10, essential: true});
      } else if (features.length) {
        const bounds = features.reduce((result, feature) => result.extend(feature.geometry.coordinates), new window.maplibregl.LngLatBounds(features[0].geometry.coordinates, features[0].geometry.coordinates));
        suppressNextMoveend = true;
        map.fitBounds(bounds, {padding: 50, maxZoom: 12});
      }
    };

    const initializeMap = async () => {
      try {
        const isolateQualifiedGesture = (event) => {
          if (event.type === 'wheel' && (event.ctrlKey || event.metaKey)) event.stopPropagation();
          if (event.type === 'touchmove' && event.touches?.length > 1) event.stopPropagation();
        };
        mapContainer.addEventListener('wheel', isolateQualifiedGesture, {passive: true});
        mapContainer.addEventListener('touchmove', isolateQualifiedGesture, {passive: true});
        const maplibregl = await loadMapLibre();
        map = new maplibregl.Map({container: mapContainer, style: 'https://tiles.openfreemap.org/styles/liberty', center: [0, 20], zoom: 1.5, attributionControl: true, cooperativeGestures: true});
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.on('load', () => {
          const styles = getComputedStyle(root);
          const mapColor = (value, fallback) => {
            const color = String(value ?? '').trim();
            return color && !color.includes('var(') && color !== 'currentColor' ? color : fallback;
          };
          const primary = mapColor(styles.getPropertyValue('--dm-primary'), '#176274');
          const accent = mapColor(styles.getPropertyValue('--dm-accent'), '#4ca9ba');
          const markerText = mapColor(styles.getPropertyValue('--dm-buttonText'), mapColor(styles.getPropertyValue('--dm-ink'), '#fff'));
          map.addSource('dm-locations', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, cluster: true, clusterMaxZoom: 13, clusterRadius: 48});
          const pointFilter = markerStyle === 'photo'
            ? ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'photoMarker'], true]]
            : ['!', ['has', 'point_count']];
          // Halo behind unclustered points (soft ring, Google-Maps-like pin glow).
          map.addLayer({id: 'dm-points-halo', type: 'circle', source: 'dm-locations', filter: pointFilter, paint: {'circle-color': accent, 'circle-opacity': 0.25, 'circle-radius': 16, 'circle-blur': 0.6}});
          map.addLayer({id: 'dm-clusters', type: 'circle', source: 'dm-locations', filter: ['has', 'point_count'], paint: {'circle-color': primary, 'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 30], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff'}});
          map.addLayer({id: 'dm-cluster-count', type: 'symbol', source: 'dm-locations', filter: ['has', 'point_count'], layout: {'text-field': '{point_count_abbreviated}', 'text-size': 12, 'text-font': ['Noto Sans Bold']}, paint: {'text-color': markerText}});
          map.addLayer({id: 'dm-points', type: 'circle', source: 'dm-locations', filter: pointFilter, paint: {'circle-color': accent, 'circle-radius': 9, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#fff'}});
          updateMap(locations);
          map.on('idle', syncPhotoMarkers);
          map.on('moveend', () => {
            syncPhotoMarkers();
            if (suppressNextMoveend) {
              suppressNextMoveend = false;
              return;
            }
            if (viewportSearchActive) {
              if (viewportSearchTimer) clearTimeout(viewportSearchTimer);
              viewportSearchTimer = setTimeout(searchCurrentArea, 300);
            } else if (searchAreaButton) {
              searchAreaButton.textContent = translate('searchArea', 'Search this area');
              searchAreaButton.hidden = false;
            }
          });
          map.on('sourcedata', (event) => {
            if (event.sourceId === 'dm-locations') syncPhotoMarkers();
          });
        });
        map.on('click', 'dm-clusters', async (event) => {
          const feature = map.queryRenderedFeatures(event.point, {layers: ['dm-clusters']})[0];
          if (!feature) return;
          try {
            const source = map.getSource('dm-locations');
            const zoom = await source.getClusterExpansionZoom(Number(feature.properties.cluster_id));
            map.easeTo({center: feature.geometry.coordinates, zoom: Math.min(zoom, 18)});
          } catch (clusterError) {
            console.warn('[Store locator] Unable to expand cluster', clusterError);
          }
        });
        map.on('click', 'dm-points', (event) => openLocationModal(event.features[0].properties.id));
        map.on('mouseenter', 'dm-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'dm-clusters', () => { map.getCanvas().style.cursor = ''; });
        map.on('mouseenter', 'dm-points', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'dm-points', () => { map.getCanvas().style.cursor = ''; });
      } catch {
        mapContainer.querySelector('.dm-locator__map-placeholder')?.replaceChildren(document.createTextNode(translate('mapUnavailable', 'Map unavailable')));
      }
    };

    const updateClearSearchButton = () => {
      if (clearSearchButton) clearSearchButton.hidden = !searchInput.value;
    };

    clearSearchButton?.addEventListener('click', () => {
      searchInput.value = '';
      updateClearSearchButton();
      search(new URLSearchParams());
      searchInput.focus();
    });

    searchInput.addEventListener('input', () => {
      updateClearSearchButton();
      if (!searchInput.value.trim()) search(new URLSearchParams());
    });

    const search = async (params = new URLSearchParams()) => {
      const sequence = ++searchSequence;
      status.textContent = translate('loading', 'Loading');
      empty.hidden = true;
      error.hidden = true;
      if (snapshotLocations) {
        const query = (params.get('q') || '').toLowerCase();
        const latitude = params.get('latitude') == null ? null : Number(params.get('latitude'));
        const longitude = params.get('longitude') == null ? null : Number(params.get('longitude'));
        const radius = Number(params.get('radius') || 50);
        const distanceKm = (location) => {
          if (latitude == null || longitude == null || location.latitude == null || location.longitude == null) return null;
          const radians = (value) => value * Math.PI / 180;
          const a = Math.sin(radians(location.latitude - latitude) / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(location.latitude)) * Math.sin(radians(location.longitude - longitude) / 2) ** 2;
          return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };
        const local = snapshotLocations.map((location) => ({...location, distanceKilometers: distanceKm(location)})).filter((location) => {
          const haystack = String(location.name || '').toLowerCase();
          return (!query || haystack.includes(query)) && (location.distanceKilometers == null || location.distanceKilometers <= radius);
        }).sort((left, right) => (left.distanceKilometers ?? Number.MAX_SAFE_INTEGER) - (right.distanceKilometers ?? Number.MAX_SAFE_INTEGER));
        if (sequence !== searchSequence) return;
        locationCache.clear();
        local.forEach((location) => locationCache.set(String(location.id), location));
        render(local);
        updateMap(local, latitude != null && longitude != null ? {latitude, longitude} : null);
        status.textContent = '';
        return;
      }
      try {
        const response = await fetch(`${endpoint}?${params.toString()}`, {headers: {Accept: 'application/json'}});
        if (!response.ok) throw new Error('Search request failed');
        const payload = await response.json();
        if (sequence !== searchSequence) return;
        const items = payload.items ?? payload.locations ?? [];
        locationCache.clear();
        items.forEach((location) => locationCache.set(String(location.id), location));
        render([...locationCache.values()]);
        updateMap(locations, payload.center);
        status.textContent = '';
      } catch {
        if (sequence !== searchSequence) return;
        status.textContent = '';
        error.hidden = false;
        if (locations.length) renderList(locations);
      }
    };

    const searchCurrentArea = () => {
      if (!map) return;
      renderList(visibleLocations());
      status.textContent = '';
    };

    searchAreaButton?.addEventListener('click', () => {
      if (viewportSearchActive) {
        viewportSearchActive = false;
        searchAreaButton.hidden = true;
        search(new URLSearchParams(new FormData(form)));
        return;
      }
      viewportSearchActive = true;
      searchAreaButton.textContent = 'Show all locations';
      searchAreaButton.hidden = false;
      searchCurrentArea();
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      viewportSearchActive = false;
      if (searchAreaButton) searchAreaButton.hidden = true;
      search(new URLSearchParams(new FormData(form)));
    });

    root.querySelector('[data-dm-locate]')?.addEventListener('click', () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(({coords}) => {
        viewportSearchActive = false;
        if (searchAreaButton) searchAreaButton.hidden = true;
        search(new URLSearchParams({latitude: String(coords.latitude), longitude: String(coords.longitude), radius: '50'}));
      });
    });

    void initializeMap();
    void search();
  });
})();
