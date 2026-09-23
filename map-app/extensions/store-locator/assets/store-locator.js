(() => {
  const roots = document.querySelectorAll('[data-dm-locator]');

  roots.forEach((root) => {
    const form = root.querySelector('[data-dm-search]');
    const list = root.querySelector('[data-dm-list]');
    const count = root.querySelector('[data-dm-count]');
    const status = root.querySelector('[data-dm-status]');
    const empty = root.querySelector('[data-dm-empty]');
    const error = root.querySelector('[data-dm-error]');
    const endpoint = root.dataset.endpoint;

    if (!form || !list || !count || !status || !empty || !error || !endpoint) return;

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;',
    }[character]));

    const render = (locations) => {
      list.innerHTML = locations.map((location) => `
        <button class="dm-locator__card" type="button" data-dm-location="${escapeHtml(location.id)}">
          <strong>${escapeHtml(location.name)}</strong>
          <address>${escapeHtml([location.addressLine1, location.city, location.country].filter(Boolean).join(', '))}</address>
          ${location.distanceKilometers != null ? `<span class="dm-locator__distance">${Number(location.distanceKilometers).toFixed(1)} km away</span>` : ''}
        </button>
      `).join('');
      count.textContent = `${locations.length} ${locations.length === 1 ? 'location' : 'locations'}`;
      empty.hidden = locations.length > 0;
      list.querySelectorAll('[data-dm-location]').forEach((card) => {
        card.addEventListener('click', () => {
          list.querySelectorAll('.is-active').forEach((item) => item.classList.remove('is-active'));
          card.classList.add('is-active');
          root.dispatchEvent(new CustomEvent('distributor-map:select-location', {detail: {id: card.dataset.dmLocation}}));
        });
      });
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

    const locateButton = root.querySelector('[data-dm-locate]');
    locateButton?.addEventListener('click', () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(({coords}) => {
        search(new URLSearchParams({latitude: String(coords.latitude), longitude: String(coords.longitude), radius: '50'}));
      });
    });

    search();
  });
})();
