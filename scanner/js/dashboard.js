/**
 * Dashboard view — sites list / search (Supabase-backed)
 */
const DashboardView = {
  bound: false,

  bind() {
    if (this.bound) return;
    this.bound = true;

    $('#btn-new-site, #btn-empty-new').on('click', () => this.openSiteModal());
    $('#site-form').on('submit', (e) => this.saveSite(e));
    $('#search-input').on('input', debounce(() => this.onSearch(), 250));

    $('#sites-list').on('click', '[data-action]', async (e) => {
      e.stopPropagation();
      const $card = $(e.currentTarget).closest('[data-site-id]');
      const id = $card.data('site-id');
      const action = $(e.currentTarget).data('action');
      if (action === 'open') App.go('/site/' + id);
      else if (action === 'edit') this.openSiteModal(AppStore.getSite(id));
      else if (action === 'delete') await this.deleteSite(id);
    });

    $('#sites-list').on('click', '.site-card', (e) => {
      if ($(e.target).closest('[data-action]').length) return;
      App.go('/site/' + $(e.currentTarget).data('site-id'));
    });
  },

  render(list) {
    const sites = list || AppStore.getSites();
    const $list = $('#sites-list');
    const $empty = $('#empty-state');
    const $count = $('#site-count');

    $count.text(sites.length === 1 ? '1 site' : `${sites.length} sites`);

    if (!sites.length) {
      $list.empty();
      $empty.removeClass('d-none');
      return;
    }

    $empty.addClass('d-none');
    $list.html(sites.map(site => {
      const count = site.deviceCount ?? 0;
      const initial = (site.name || site.customer || '?').trim().charAt(0).toUpperCase();
      return `
        <article class="site-card" data-site-id="${escapeHtml(site.id)}">
          <div class="site-card-top">
            <div class="site-avatar" aria-hidden="true">${escapeHtml(initial)}</div>
            <div class="site-card-body">
              <h3>${escapeHtml(site.name)}</h3>
              <p class="customer">${escapeHtml(site.customer)}</p>
            </div>
          </div>
          <div class="site-card-meta">
            <span class="count-pill"><i class="bi bi-hdd-stack"></i> ${count}</span>
            <time>${formatDateTime(site.createdAt || site.updatedAt)}</time>
          </div>
          <div class="site-card-actions">
            <button class="btn btn-open" data-action="open" type="button">Open</button>
            <button class="btn btn-outline-secondary" data-action="edit" type="button" aria-label="Edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger" data-action="delete" type="button" aria-label="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </article>
      `;
    }).join(''));
  },

  openSiteModal(site) {
    $('#site-modal-title').text(site ? 'Edit Site' : 'New Site');
    $('#site-id').val(site?.id || '');
    $('#site-name').val(site?.name || '');
    $('#site-customer').val(site?.customer || '');
    $('#site-address').val(site?.address || '');
    $('#site-contact').val(site?.contactPerson || '');
    $('#site-phone').val(site?.phone || '');
    $('#site-notes').val(site?.notes || '');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('site-modal')).show();
  },

  async saveSite(e) {
    e.preventDefault();
    const id = $('#site-id').val();
    const data = {
      name: $('#site-name').val(),
      customer: $('#site-customer').val(),
      address: $('#site-address').val(),
      contactPerson: $('#site-contact').val(),
      phone: $('#site-phone').val(),
      notes: $('#site-notes').val()
    };

    if (!data.name.trim() || !data.customer.trim()) {
      showToast('Site name and customer are required', 'warning');
      return;
    }

    const $btn = $('#site-form button[type="submit"]');
    $btn.prop('disabled', true);

    try {
      if (id) {
        const updated = await updateSite(id, data);
        AppStore.upsertSite({ ...AppStore.getSite(id), ...updated });
        showToast('Site updated');
      } else {
        const created = await createSite(data);
        AppStore.upsertSite(created);
        showToast('Site created');
      }
      bootstrap.Modal.getInstance(document.getElementById('site-modal')).hide();
      this.render();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to save site', 'error');
    } finally {
      $btn.prop('disabled', false);
    }
  },

  async deleteSite(id) {
    const site = AppStore.getSite(id);
    const ok = await confirmAction(
      `Delete "${site?.name || 'this site'}" and all its devices? This cannot be undone.`
    );
    if (!ok) return;

    try {
      await deleteSite(id);
      AppStore.removeSite(id);
      this.render();
      showToast('Site deleted');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to delete site', 'error');
    }
  },

  async onSearch() {
    const q = ($('#search-input').val() || '').trim().toLowerCase();
    const all = AppStore.getSites();

    if (!q) {
      this.render(all);
      $('#search-results').addClass('d-none').empty();
      return;
    }

    const matchedSites = all.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.customer || '').toLowerCase().includes(q) ||
      (s.address || '').toLowerCase().includes(q)
    );
    this.render(matchedSites);

    if (q.length < 2) {
      $('#search-results').addClass('d-none').empty();
      return;
    }

    try {
      const devices = await searchBySerial(q);
      const $results = $('#search-results');
      if (!devices.length) {
        $results.addClass('d-none').empty();
        return;
      }

      const siteMap = Object.fromEntries(all.map(s => [s.id, s]));
      $results.removeClass('d-none').html(`
        <h6 class="mb-2">Matching devices (${devices.length})</h6>
        <div class="list-group mb-3">
          ${devices.map(d => {
            const site = siteMap[d.siteId];
            const siteLabel = d.siteName || site?.name || 'Unknown site';
            return `
              <a href="#/site/${escapeHtml(d.siteId)}" class="list-group-item list-group-item-action search-hit">
                <div class="d-flex justify-content-between">
                  <strong class="serial">${escapeHtml(d.serialNumber)}</strong>
                  <span class="badge text-bg-secondary">${deviceTypeBadgeHtml(d.deviceType)}</span>
                </div>
                <small class="text-secondary">
                  ${escapeHtml(d.model || '—')} · ${escapeHtml(siteLabel)}
                </small>
              </a>
            `;
          }).join('')}
        </div>
      `);
    } catch (err) {
      console.error(err);
    }
  }
};

function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}
