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
    const endpoint = root.dataset.endpoint;
    let map;
    let locations = [];
    let markerNodes = [];

    if (!form || !list || !count || !status || !empty || !error || !mapContainer || !endpoint) return;

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

    const closeModal = () => { modal.hidden = true; };
    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-dm-modal-close]')) { closeModal(); return; }
      const thumb = event.target.closest('[data-dm-modal-thumb]');
      if (thumb) {
        const main = modal.querySelector('.dm-locator__modal-image');
        if (main) main.src = thumb.dataset.dmModalThumb;
        modal.querySelectorAll('.dm-locator__modal-thumb').forEach((item) => item.classList.toggle('is-active', item === thumb));
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });

    const addressOf = (location) => [location.addressLine1, location.city, location.state, location.postalCode, location.country].filter(Boolean).join(', ');

    const directionsUrl = (location) => {
      if (location.buttonUrl && /^https?:\/\//.test(location.buttonUrl)) return location.buttonUrl;
      if (location.latitude != null && location.longitude != null) {
        return `https://www.google.com/maps/dir/?api=1&destination=${Number(location.latitude)},${Number(location.longitude)}`;
      }
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressOf(location))}`;
    };

    const openModal = (location) => {
      const address = addressOf(location);
      const images = Array.isArray(location.imageUrls) && location.imageUrls.length ? location.imageUrls : (location.imageUrl ? [location.imageUrl] : []);
      modalBody.innerHTML = `
        ${images.length ? `<div class="dm-locator__modal-gallery">
          <img class="dm-locator__modal-image" src="${escapeHtml(images[0])}" alt="${escapeHtml(location.name)}" loading="lazy">
          ${images.length > 1 ? `<div class="dm-locator__modal-thumbs">${images.map((url, index) => `<img class="dm-locator__modal-thumb${index === 0 ? ' is-active' : ''}" src="${escapeHtml(url)}" data-dm-modal-thumb="${escapeHtml(url)}" alt="${escapeHtml(location.name)} ${index + 1}" loading="lazy">`).join('')}</div>` : ''}
        </div>` : ''}
        <div class="dm-locator__modal-content">
          ${location.type ? `<span class="dm-locator__modal-type">${escapeHtml(location.type)}</span>` : ''}
          <h3 class="dm-locator__modal-title">${escapeHtml(location.name)}</h3>
          ${location.description ? `<p class="dm-locator__modal-description">${escapeHtml(location.description)}</p>` : ''}
          ${address ? `<address class="dm-locator__modal-address">${escapeHtml(address)}</address>` : ''}
          <div class="dm-locator__modal-meta">
            ${location.phone ? `<a href="tel:${escapeHtml(location.phone)}">${escapeHtml(location.phone)}</a>` : ''}
            ${location.email ? `<a href="mailto:${escapeHtml(location.email)}">${escapeHtml(location.email)}</a>` : ''}
            ${location.website ? `<a href="${escapeHtml(location.website)}" target="_blank" rel="noopener noreferrer">Website</a>` : ''}
          </div>
          <a class="dm-locator__modal-directions" href="${escapeHtml(directionsUrl(location))}" target="_blank" rel="noopener noreferrer">Get directions</a>
        </div>`;
      modal.hidden = false;
    };

    const selectLocation = (id) => {
      list.querySelectorAll('.is-active').forEach((item) => item.classList.remove('is-active'));
      const card = list.querySelector(`[data-dm-location="${CSS.escape(id)}"]`);
      card?.classList.add('is-active');
      const location = locations.find((item) => String(item.id) === String(id));
      if (map && location?.longitude != null && location?.latitude != null) {
        map.flyTo({center: [Number(location.longitude), Number(location.latitude)], zoom: 13, essential: true});
      }
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
      markerNodes.forEach((marker) => marker.remove());
      markerNodes = nextLocations.filter((location) => location.longitude != null && location.latitude != null).map((location) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'dm-locator__marker';
        element.setAttribute('aria-label', location.name);
        element.addEventListener('click', () => openLocationModal(location.id));
        return new window.maplibregl.Marker({element}).setLngLat([Number(location.longitude), Number(location.latitude)]).addTo(map);
      });
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
        map = new maplibregl.Map({container: mapContainer, style: 'https://tiles.openfreemap.org/styles/liberty', center: [0, 20], zoom: 1.5, attributionControl: true});
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.on('load', () => {
          map.addSource('dm-locations', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, cluster: true, clusterMaxZoom: 13, clusterRadius: 48});
          map.addLayer({id: 'dm-clusters', type: 'circle', source: 'dm-locations', filter: ['has', 'point_count'], paint: {'circle-color': '#176274', 'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 30], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff'}});
          map.addLayer({id: 'dm-cluster-count', type: 'symbol', source: 'dm-locations', filter: ['has', 'point_count'], layout: {'text-field': '{point_count_abbreviated}', 'text-size': 12}, paint: {'text-color': '#fff'}});
          map.addLayer({id: 'dm-points', type: 'circle', source: 'dm-locations', filter: ['!', ['has', 'point_count']], paint: {'circle-color': '#4ca9ba', 'circle-radius': 8, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff'}});
          updateMap(locations);
        });
        map.on('click', 'dm-clusters', (event) => {
          const feature = map.queryRenderedFeatures(event.point, {layers: ['dm-clusters']})[0];
          map.getSource('dm-locations').getClusterExpansionZoom(feature.properties.cluster_id, (err, zoom) => {
            if (!err) map.easeTo({center: feature.geometry.coordinates, zoom});
          });
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
