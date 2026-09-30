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
    const list = root.querySelector('[data-dm-list]');
    const count = root.querySelector('[data-dm-count]');
    const status = root.querySelector('[data-dm-status]');
    const empty = root.querySelector('[data-dm-empty]');
    const error = root.querySelector('[data-dm-error]');
    const mapContainer = root.querySelector('[data-dm-map]');
    const openListButton = root.querySelector('[data-dm-open-list]');
    const closeListButton = root.querySelector('[data-dm-close-list]');
    const endpoint = root.dataset.endpoint;
    let map;
    let locations = [];

    if (!form || !list || !count || !status || !empty || !error || !mapContainer || !endpoint) return;

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
        <button type="button" class="dm-locator__modal-close" data-dm-modal-close aria-label="Close">&#215;</button>
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
        <button type="button" class="dm-locator__modal-close" data-dm-navigation-close aria-label="Close">&#215;</button>
        <strong id="dm-navigation-title-${root.dataset.dmLocator || 'locator'}">Choose navigation app</strong>
        <div class="dm-locator__navigation-options">
          <button type="button" data-dm-nav-provider="auto">Automatic / System</button>
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
          if (config.backgroundColor) root.style.setProperty('--dm-modal-bg', config.backgroundColor);
          if (config.textColor) root.style.setProperty('--dm-modal-ink', config.textColor);
          if (config.accentColor) root.style.setProperty('--dm-modal-accent', config.accentColor);
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
      <button type="button" class="dm-locator__modal-directions" data-dm-nav-open>Get directions</button>
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

    const render = (nextLocations) => {
      locations = nextLocations;
      list.innerHTML = locations.map((location) => `
        <div class="dm-locator__card" role="button" tabindex="0" data-dm-location="${escapeHtml(location.id)}">
          <strong>${escapeHtml(location.name)}</strong>
          <address>${escapeHtml([location.addressLine1, location.city, location.country].filter(Boolean).join(', '))}</address>
          ${location.distanceKilometers != null ? `<span class="dm-locator__distance">${Number(location.distanceKilometers).toFixed(1)} km away</span>` : ''}
          <button type="button" class="dm-locator__details" data-dm-details="${escapeHtml(location.id)}">View details</button>
        </div>
      `).join('');
      count.textContent = `${locations.length} ${locations.length === 1 ? 'location' : 'locations'}`;
      empty.hidden = locations.length > 0;
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

    const updateMap = (nextLocations, center) => {
      if (!map) return;
      const source = map.getSource('dm-locations');
      const features = nextLocations.filter((location) => location.longitude != null && location.latitude != null).map((location) => ({
        type: 'Feature',
        geometry: {type: 'Point', coordinates: [Number(location.longitude), Number(location.latitude)]},
        properties: {id: String(location.id), name: location.name},
      }));
      source?.setData({type: 'FeatureCollection', features});
      if (center?.latitude != null && center?.longitude != null) {
        map.flyTo({center: [center.longitude, center.latitude], zoom: 10, essential: true});
      } else if (features.length) {
        const bounds = features.reduce((result, feature) => result.extend(feature.geometry.coordinates), new window.maplibregl.LngLatBounds(features[0].geometry.coordinates, features[0].geometry.coordinates));
        map.fitBounds(bounds, {padding: 50, maxZoom: 12});
      }
    };

    const initializeMap = async () => {
      try {
        const maplibregl = await loadMapLibre();
        map = new maplibregl.Map({container: mapContainer, style: 'https://tiles.openfreemap.org/styles/liberty', center: [0, 20], zoom: 1.5, attributionControl: true, cooperativeGestures: true});
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.on('load', () => {
          const styles = getComputedStyle(root);
          const primary = styles.getPropertyValue('--dm-primary').trim() || '#176274';
          const accent = styles.getPropertyValue('--dm-accent').trim() || '#4ca9ba';
          map.addSource('dm-locations', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, cluster: true, clusterMaxZoom: 13, clusterRadius: 48});
          // Halo behind unclustered points (soft ring, Google-Maps-like pin glow).
          map.addLayer({id: 'dm-points-halo', type: 'circle', source: 'dm-locations', filter: ['!', ['has', 'point_count']], paint: {'circle-color': accent, 'circle-opacity': 0.25, 'circle-radius': 16, 'circle-blur': 0.6}});
          map.addLayer({id: 'dm-clusters', type: 'circle', source: 'dm-locations', filter: ['has', 'point_count'], paint: {'circle-color': primary, 'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 30], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff'}});
          map.addLayer({id: 'dm-cluster-count', type: 'symbol', source: 'dm-locations', filter: ['has', 'point_count'], layout: {'text-field': '{point_count_abbreviated}', 'text-size': 12, 'text-font': ['Noto Sans Bold']}, paint: {'text-color': '#fff'}});
          map.addLayer({id: 'dm-points', type: 'circle', source: 'dm-locations', filter: ['!', ['has', 'point_count']], paint: {'circle-color': accent, 'circle-radius': 9, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#fff'}});
          updateMap(locations);
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
        mapContainer.querySelector('.dm-locator__map-placeholder')?.replaceChildren(document.createTextNode('Map unavailable'));
      }
    };

    const search = async (params = new URLSearchParams()) => {
      status.textContent = 'Loading';
      empty.hidden = true;
      error.hidden = true;
      try {
        const response = await fetch(`${endpoint}?${params.toString()}`, {headers: {Accept: 'application/json'}});
        if (!response.ok) throw new Error('Search request failed');
        const payload = await response.json();
        render(payload.items ?? payload.locations ?? []);
        updateMap(locations, payload.center);
        status.textContent = '';
      } catch {
        list.innerHTML = '';
        status.textContent = '';
        error.hidden = false;
      }
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      search(new URLSearchParams(new FormData(form)));
    });

    root.querySelector('[data-dm-locate]')?.addEventListener('click', () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(({coords}) => {
        search(new URLSearchParams({latitude: String(coords.latitude), longitude: String(coords.longitude), radius: '50'}));
      });
    });

    void initializeMap();
    void search();
  });
})();
