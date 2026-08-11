/**
 * SPA views + router — Invoice Hours Manager
 */

const EntriesView = {
  bound: false,
  filterClient: '',
  filterMonth: '',
  LAST_CLIENT_KEY: 'inv_last_entry_client',

  getLastClientId() {
    try {
      return localStorage.getItem(this.LAST_CLIENT_KEY) || '';
    } catch (e) {
      return '';
    }
  },

  setLastClientId(id) {
    try {
      if (id) localStorage.setItem(this.LAST_CLIENT_KEY, id);
      else localStorage.removeItem(this.LAST_CLIENT_KEY);
    } catch (e) { /* ignore */ }
  },

  bind() {
    if (this.bound) return;
    this.bound = true;

    $('#btn-add-entry').on('click', () => this.openModal());
    $('#entry-filter-client').on('change', () => {
      this.filterClient = $('#entry-filter-client').val() || '';
      this.render();
    });
    $('#entry-filter-month').on('change', () => {
      this.filterMonth = $('#entry-filter-month').val() || '';
      this.render();
    });

    $('#entry-form').on('submit', async (e) => {
      e.preventDefault();
      await this.save();
    });

    $('#entry-client').on('change', function () {
      const clientId = $(this).val();
      EntriesView.setLastClientId(clientId);
      const client = AppStore.getClient(clientId);
      if (client) $('#entry-rate').val(client.hourlyRate);
      EntriesView.updateAmountPreview();
    });
    $('#entry-hours, #entry-rate').on('input', () => this.updateAmountPreview());

    $(document).on('click', '.btn-edit-entry', (e) => {
      const id = $(e.currentTarget).closest('[data-entry-id]').data('entry-id');
      const entry = AppStore.getEntries().find(x => x.id === id);
      if (entry) this.openModal(entry);
    });
    $(document).on('click', '.btn-delete-entry', async (e) => {
      const id = $(e.currentTarget).closest('[data-entry-id]').data('entry-id');
      const ok = await confirmAction('Delete this entry?');
      if (!ok) return;
      try {
        await deleteEntry(id);
        AppStore.removeEntry(id);
        this.render();
        showToast('Entry deleted');
      } catch (err) {
        showToast(err.message || 'Delete failed', 'error');
      }
    });
    $(document).on('click', '.btn-toggle-status', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = $(e.currentTarget).closest('[data-entry-id]').data('entry-id');
      const entry = AppStore.getEntries().find(x => x.id === id);
      if (!entry) return;
      const next = entry.paymentStatus === 'paid' ? 'pending' : 'paid';
      try {
        const saved = await updateEntryStatus(id, next);
        const client = AppStore.getClient(saved.clientId);
        if (client && !saved.clientName) saved.clientName = client.name;
        AppStore.upsertEntry(saved);
        this.render();
        showToast(next === 'paid' ? 'Marked as paid' : 'Marked as pending');
      } catch (err) {
        showToast(err.message || 'Status update failed', 'error');
      }
    });
  },

  updateAmountPreview() {
    const hours = Number($('#entry-hours').val()) || 0;
    const rate = Number($('#entry-rate').val()) || 0;
    $('#entry-amount-preview').text(formatMoney(hours * rate));
  },

  fillClientSelect($el, selected, placeholder = 'Select client…') {
    const clients = AppStore.getClients();
    $el.html(`<option value="">${escapeHtml(placeholder)}</option>`);
    clients.forEach(c => {
      $el.append(
        `<option value="${escapeHtml(c.id)}" ${c.id === selected ? 'selected' : ''}>` +
        `${escapeHtml(c.name)} (${formatMoney(c.hourlyRate)}/hr)</option>`
      );
    });
  },

  openModal(entry = null) {
    const isEdit = !!entry?.id;
    $('#entry-modal-title').text(isEdit ? 'Edit Entry' : 'Add Hours');
    $('#entry-id').val(entry?.id || '');

    let clientId = entry?.clientId || '';
    if (!isEdit) {
      const lastId = this.getLastClientId();
      if (lastId && AppStore.getClient(lastId)) clientId = lastId;
    }

    this.fillClientSelect($('#entry-client'), clientId);
    $('#entry-date').val(entry?.workDate || todayISO());
    $('#entry-hours').val(entry?.hours || '');

    const client = AppStore.getClient(clientId);
    const rate = entry?.rateSnapshot ?? client?.hourlyRate ?? '';
    $('#entry-rate').val(rate);
    $('#entry-status').val(entry?.paymentStatus === 'paid' ? 'paid' : 'pending');
    $('#entry-description').val(entry?.description || '');
    this.updateAmountPreview();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('entry-modal')).show();
  },

  async save() {
    const id = $('#entry-id').val();
    const data = {
      clientId: $('#entry-client').val(),
      workDate: $('#entry-date').val(),
      hours: $('#entry-hours').val(),
      rateSnapshot: $('#entry-rate').val(),
      description: $('#entry-description').val(),
      paymentStatus: $('#entry-status').val() === 'paid' ? 'paid' : 'pending'
    };
    if (!data.clientId) {
      showToast('Select a client', 'warning');
      return;
    }
    const $btn = $('#entry-form button[type="submit"]');
    $btn.prop('disabled', true);
    try {
      let saved;
      if (id) {
        saved = await updateEntry(id, data);
        showToast('Entry updated');
      } else {
        saved = await createEntry(data);
        showToast('Entry added');
      }
      this.setLastClientId(saved.clientId);
      const client = AppStore.getClient(saved.clientId);
      if (client && !saved.clientName) saved.clientName = client.name;
      AppStore.upsertEntry(saved);
      bootstrap.Modal.getInstance(document.getElementById('entry-modal'))?.hide();
      this.render();
    } catch (err) {
      showToast(err.message || 'Save failed', 'error');
    } finally {
      $btn.prop('disabled', false);
    }
  },

  filteredEntries() {
    let list = AppStore.getEntries();
    if (this.filterClient) list = list.filter(e => e.clientId === this.filterClient);
    if (this.filterMonth) {
      list = list.filter(e => (e.workDate || '').startsWith(this.filterMonth));
    }
    return list;
  },

  renderFilters() {
    this.fillClientSelect($('#entry-filter-client'), this.filterClient, 'All clients');

    if (!this.filterMonth) {
      const now = new Date();
      this.filterMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    $('#entry-filter-month').val(this.filterMonth);
  },

  render() {
    this.renderFilters();
    const list = this.filteredEntries();
    const $list = $('#entries-list');
    const $empty = $('#entries-empty');
    const $footer = $('#entries-footer');
    const total = list.reduce((s, e) => s + entryAmount(e), 0);
    const hours = list.reduce((s, e) => s + (Number(e.hours) || 0), 0);
    const pending = list
      .filter(e => e.paymentStatus !== 'paid')
      .reduce((s, e) => s + entryAmount(e), 0);
    const paid = list
      .filter(e => e.paymentStatus === 'paid')
      .reduce((s, e) => s + entryAmount(e), 0);

    $('#entries-summary').text(`${formatHours(hours)} hrs · ${formatMoney(total)}`);
    $('#entries-footer-total').text(formatMoney(total));
    $('#entries-footer-pending').text(formatMoney(pending));
    $('#entries-footer-paid').text(formatMoney(paid));

    if (!list.length) {
      $list.addClass('d-none').empty();
      $empty.removeClass('d-none');
      $footer.addClass('d-none');
      return;
    }
    $empty.addClass('d-none');
    $footer.removeClass('d-none');
    $list.removeClass('d-none').html(`
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Client</th>
            <th>Description</th>
            <th>Status</th>
            <th class="text-end">Hours</th>
            <th class="text-end">Rate</th>
            <th class="text-end">Amount</th>
            <th class="actions"></th>
          </tr>
        </thead>
        <tbody>
          ${list.map(e => {
            const status = e.paymentStatus === 'paid' ? 'paid' : 'pending';
            return `
            <tr data-entry-id="${escapeHtml(e.id)}">
              <td>${escapeHtml(formatDate(e.workDate))}</td>
              <td>${escapeHtml(e.clientName || AppStore.getClient(e.clientId)?.name || 'Client')}</td>
              <td>${escapeHtml(e.description || '—')}</td>
              <td>
                <button type="button" class="status-badge ${status} btn-toggle-status" title="Click to toggle">
                  ${status === 'paid' ? 'Paid' : 'Pending'}
                </button>
              </td>
              <td class="text-end">${escapeHtml(formatHours(e.hours))}</td>
              <td class="text-end">${escapeHtml(formatMoney(e.rateSnapshot))}</td>
              <td class="text-end amount">${escapeHtml(formatMoney(entryAmount(e)))}</td>
              <td class="actions">
                <button type="button" class="btn btn-link btn-edit-entry" title="Edit"><i class="bi bi-pencil"></i></button>
                <button type="button" class="btn btn-link text-danger btn-delete-entry" title="Delete"><i class="bi bi-trash"></i></button>
              </td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    `);
  }
};

const ClientsView = {
  bound: false,

  bind() {
    if (this.bound) return;
    this.bound = true;

    $('#btn-add-client').on('click', () => this.openModal());
    $('#client-form').on('submit', async (e) => {
      e.preventDefault();
      await this.save();
    });

    $(document).on('click', '.btn-edit-client', (e) => {
      const id = $(e.currentTarget).closest('[data-client-id]').data('client-id');
      const client = AppStore.getClient(id);
      if (client) this.openModal(client);
    });
    $(document).on('click', '.btn-delete-client', async (e) => {
      const id = $(e.currentTarget).closest('[data-client-id]').data('client-id');
      const client = AppStore.getClient(id);
      const ok = await confirmAction(
        `Delete client "${client?.name || ''}"? All their entries will be deleted too.`
      );
      if (!ok) return;
      try {
        await deleteClient(id);
        AppStore.removeClient(id);
        this.render();
        showToast('Client deleted');
      } catch (err) {
        showToast(err.message || 'Delete failed', 'error');
      }
    });
  },

  openModal(client = null) {
    const isEdit = !!client?.id;
    $('#client-modal-title').text(isEdit ? 'Edit Client' : 'Add Client');
    $('#client-id').val(client?.id || '');
    $('#client-name').val(client?.name || '');
    $('#client-rate').val(client?.hourlyRate ?? '');
    $('#client-email').val(client?.email || '');
    $('#client-address').val(client?.address || '');
    $('#client-notes').val(client?.notes || '');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('client-modal')).show();
    setTimeout(() => $('#client-name').trigger('focus'), 250);
  },

  async save() {
    const id = $('#client-id').val();
    const data = {
      name: $('#client-name').val(),
      hourlyRate: $('#client-rate').val(),
      email: $('#client-email').val(),
      address: $('#client-address').val(),
      notes: $('#client-notes').val()
    };
    const $btn = $('#client-form button[type="submit"]');
    $btn.prop('disabled', true);
    try {
      let saved;
      if (id) {
        saved = await updateClient(id, data);
        showToast('Client updated');
      } else {
        saved = await createClient(data);
        showToast('Client added');
      }
      AppStore.upsertClient(saved);
      bootstrap.Modal.getInstance(document.getElementById('client-modal'))?.hide();
      this.render();
    } catch (err) {
      showToast(err.message || 'Save failed', 'error');
    } finally {
      $btn.prop('disabled', false);
    }
  },

  render() {
    const list = AppStore.getClients();
    const $list = $('#clients-list');
    const $empty = $('#clients-empty');
    $('#client-count').text(list.length ? `${list.length}` : '—');

    if (!list.length) {
      $list.addClass('d-none').empty();
      $empty.removeClass('d-none');
      return;
    }
    $empty.addClass('d-none');
    $list.removeClass('d-none').html(`
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th class="text-end">Hourly rate</th>
            <th>Email</th>
            <th>Address</th>
            <th class="actions"></th>
          </tr>
        </thead>
        <tbody>
          ${list.map(c => `
            <tr data-client-id="${escapeHtml(c.id)}">
              <td><strong>${escapeHtml(c.name)}</strong></td>
              <td class="text-end amount">${escapeHtml(formatMoney(c.hourlyRate))}/hr</td>
              <td>${escapeHtml(c.email || '—')}</td>
              <td>${escapeHtml(c.address || '—')}</td>
              <td class="actions">
                <button type="button" class="btn btn-link btn-edit-client" title="Edit"><i class="bi bi-pencil"></i></button>
                <button type="button" class="btn btn-link text-danger btn-delete-client" title="Delete"><i class="bi bi-trash"></i></button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `);
  }
};

const ExportView = {
  bound: false,
  LAST_EXPORT_KEY: 'inv_last_export_by_client',
  LAST_CLIENT_KEY: 'inv_last_export_client',
  applyingClientDates: false,

  getLastExportMap() {
    try {
      return JSON.parse(localStorage.getItem(this.LAST_EXPORT_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  },

  getLastExportTo(clientId) {
    if (!clientId) return '';
    return this.getLastExportMap()[clientId] || '';
  },

  setLastExportTo(clientId, toDate) {
    if (!clientId || !toDate) return;
    try {
      const map = this.getLastExportMap();
      map[clientId] = toDate;
      localStorage.setItem(this.LAST_EXPORT_KEY, JSON.stringify(map));
    } catch (e) { /* ignore */ }
  },

  getLastClientId() {
    try {
      return localStorage.getItem(this.LAST_CLIENT_KEY) || '';
    } catch (e) {
      return '';
    }
  },

  setLastClientId(id) {
    try {
      if (id) localStorage.setItem(this.LAST_CLIENT_KEY, id);
      else localStorage.removeItem(this.LAST_CLIENT_KEY);
    } catch (e) { /* ignore */ }
  },

  /**
   * After a previous export ending on `to`, next From starts at that To date.
   */
  applyClientDateDefaults(clientId) {
    const lastTo = this.getLastExportTo(clientId);
    this.applyingClientDates = true;
    if (lastTo) {
      $('#export-from').val(lastTo);
      const to = todayISO();
      $('#export-to').val(to < lastTo ? lastTo : to);
    } else {
      $('#export-from').val(monthStartISO());
      $('#export-to').val(todayISO());
    }
    this.applyingClientDates = false;
  },

  bind() {
    if (this.bound) return;
    this.bound = true;

    $('#export-client').on('change', () => {
      const clientId = $('#export-client').val();
      this.setLastClientId(clientId);
      if (clientId) this.applyClientDateDefaults(clientId);
      this.renderPreview();
    });

    $('#export-from, #export-to').on('change input', () => {
      if (this.applyingClientDates) return;
      this.renderPreview();
    });

    $(document).on('click', '#pdf-theme-picker .theme-card', (e) => {
      const id = $(e.currentTarget).data('theme');
      InvoiceExport.setThemeId(id);
      this.renderThemePicker();
      this.syncCustomForm();
      this.renderPreview();
    });

    $('#pdf-accent, #pdf-show-desc, #pdf-tagline').on('change input', () => {
      this.saveCustomFromForm();
      this.renderPreview();
    });

    $('#pdf-accent-reset').on('click', () => {
      InvoiceExport.setCustom({ accentHex: '' });
      this.syncCustomForm();
      this.renderPreview();
    });

    $('#btn-export-pdf').on('click', async () => {
      try {
        const clientId = $('#export-client').val();
        const from = $('#export-from').val();
        const to = $('#export-to').val();
        if (!clientId || !from || !to) {
          showToast('Pick a client and date range', 'warning');
          return;
        }
        if (from > to) {
          showToast('From date must be before To date', 'warning');
          return;
        }
        this.saveCustomFromForm();
        const client = AppStore.getClient(clientId);
        const entries = AppStore.getEntries().filter(e =>
          e.clientId === clientId && e.workDate >= from && e.workDate <= to
        );
        setLoading(true);
        await InvoiceExport.exportPDF({
          profile: AppStore.getProfile() || {},
          client,
          from,
          to,
          entries,
          themeId: InvoiceExport.getThemeId(),
          custom: InvoiceExport.getCustom()
        });
        this.setLastClientId(clientId);
        this.setLastExportTo(clientId, to);
        showToast('PDF downloaded — next From will start at this To date');
      } catch (err) {
        console.error(err);
        showToast(err.message || 'Export failed', 'error');
      } finally {
        setLoading(false);
      }
    });
  },

  renderThemePicker() {
    const selected = InvoiceExport.getThemeId();
    $('#pdf-theme-picker').html(InvoiceExport.themes.map(t => `
      <button type="button" class="theme-card${t.id === selected ? ' active' : ''}" data-theme="${escapeHtml(t.id)}">
        <span class="theme-swatch" style="background:${escapeHtml(t.preview)}"></span>
        <span>
          <strong>${escapeHtml(t.name)}</strong>
          <span>${escapeHtml(t.desc)}</span>
        </span>
      </button>
    `).join(''));
  },

  syncCustomForm() {
    const custom = InvoiceExport.getCustom();
    const theme = InvoiceExport.getTheme();
    const hex = custom.accentHex || rgbToHex(theme.accent);
    $('#pdf-accent').val(hex);
    $('#pdf-show-desc').prop('checked', custom.showDescription !== false);
    $('#pdf-tagline').val(custom.tagline || '');
  },

  saveCustomFromForm() {
    const theme = InvoiceExport.getTheme();
    const picked = ($('#pdf-accent').val() || '').toLowerCase();
    const themeHex = rgbToHex(theme.accent).toLowerCase();
    InvoiceExport.setCustom({
      accentHex: picked && picked !== themeHex ? picked : '',
      showDescription: $('#pdf-show-desc').is(':checked'),
      tagline: ($('#pdf-tagline').val() || '').trim(),
      thankYou: ''
    });
  },

  show() {
    try {
      if (!localStorage.getItem('inv_pdf_theme_migrated_minimal')) {
        InvoiceExport.setThemeId('minimal');
        localStorage.setItem('inv_pdf_theme_migrated_minimal', '1');
      }
    } catch (e) { /* ignore */ }

    const clients = AppStore.getClients();
    const $sel = $('#export-client');
    $sel.html('<option value="">Select client…</option>');
    clients.forEach(c => {
      $sel.append(`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`);
    });

    const lastId = this.getLastClientId();
    const clientId = (lastId && AppStore.getClient(lastId)) ? lastId : '';
    if (clientId) {
      $sel.val(clientId);
      this.applyClientDateDefaults(clientId);
    } else {
      $('#export-from').val(monthStartISO());
      $('#export-to').val(todayISO());
    }
    this.renderThemePicker();
    this.syncCustomForm();
    this.renderPreview();
  },

  renderPreview() {
    const clientId = $('#export-client').val();
    const from = $('#export-from').val();
    const to = $('#export-to').val();
    const $preview = $('#export-preview');
    const $btn = $('#btn-export-pdf');
    const theme = InvoiceExport.getTheme();

    if (!clientId || !from || !to) {
      $preview.html('<p class="text-secondary small mb-0">Select a client and date range to preview.</p>');
      $btn.prop('disabled', true);
      return;
    }

    const entries = AppStore.getEntries()
      .filter(e => e.clientId === clientId && e.workDate >= from && e.workDate <= to)
      .sort((a, b) => (a.workDate || '').localeCompare(b.workDate || ''));
    const { totalHours, totalAmount } = InvoiceExport.summarize(entries);
    $btn.prop('disabled', false);

    const lastTo = this.getLastExportTo(clientId);
    const continuityNote = lastTo
      ? `<p class="small text-secondary mb-2">Last export for this client ended <strong>${escapeHtml(formatDate(lastTo))}</strong>. From was set to that date.</p>`
      : '';

    const themeNote = `
      <p class="small mb-2">
        PDF theme: <strong>${escapeHtml(theme.name)}</strong>
        <span class="theme-swatch d-inline-block align-middle ms-1" style="background:${escapeHtml(theme.preview)};width:0.75rem;height:0.75rem;border-radius:3px;"></span>
      </p>`;

    if (!entries.length) {
      $preview.html(`${continuityNote}${themeNote}<p class="text-secondary small mb-0">No entries in this range.</p>`);
      return;
    }

    $preview.html(`
      ${continuityNote}
      ${themeNote}
      <div class="export-totals mb-3">
        <span><strong>${entries.length}</strong> lines</span>
        <span><strong>${formatHours(totalHours)}</strong> hrs</span>
        <span class="text-brand"><strong>${formatMoney(totalAmount)}</strong></span>
      </div>
      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
          <thead><tr><th>Date</th><th>Desc</th><th class="text-end">Hrs</th><th class="text-end">Amount</th></tr></thead>
          <tbody>
            ${entries.map(e => `
              <tr>
                <td>${escapeHtml(formatDate(e.workDate))}</td>
                <td>${escapeHtml(e.description || '—')}</td>
                <td class="text-end">${escapeHtml(formatHours(e.hours))}</td>
                <td class="text-end">${escapeHtml(formatMoney(entryAmount(e)))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `);
  }
};

const SettingsView = {
  bound: false,

  bind() {
    if (this.bound) return;
    this.bound = true;

    $('#theme-switch').on('change', function () {
      applyTheme(this.checked ? 'dark' : 'light');
      $('.btn-theme i').attr('class', this.checked ? 'bi bi-sun' : 'bi bi-moon');
    });

    $('#profile-form').on('submit', async (e) => {
      e.preventDefault();
      const $btn = $('#profile-form button[type="submit"]');
      $btn.prop('disabled', true);
      try {
        const saved = await saveProfile({
          businessName: $('#profile-name').val(),
          email: $('#profile-email').val(),
          phone: $('#profile-phone').val(),
          address: $('#profile-address').val(),
          invoicePrefix: $('#profile-prefix').val()
        });
        AppStore.setProfile(saved);
        showToast('Profile saved');
      } catch (err) {
        showToast(err.message || 'Save failed', 'error');
      } finally {
        $btn.prop('disabled', false);
      }
    });
  },

  show(user) {
    $('#user-email').text(user?.email || '—');
    $('#theme-switch').prop('checked', getTheme() === 'dark');
    const p = AppStore.getProfile() || {};
    $('#profile-name').val(p.businessName || '');
    $('#profile-email').val(p.email || '');
    $('#profile-phone').val(p.phone || '');
    $('#profile-address').val(p.address || '');
    $('#profile-prefix').val(p.invoicePrefix || 'INV');
  }
};

const App = {
  currentUser: null,
  bound: false,

  async start() {
    applyTheme(getTheme());
    this.bindChrome();
    try {
      this.currentUser = await requireAuth();
    } catch (e) {
      return;
    }

    setLoading(true);
    try {
      await AppStore.ensureAll();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to load data. Run invoice/supabase/schema.sql in Supabase.', 'error');
    } finally {
      setLoading(false);
    }

    window.addEventListener('hashchange', () => this.route());
    this.route();
  },

  bindChrome() {
    if (this.bound) return;
    this.bound = true;

    $(document).on('click', '.btn-logout', () => logout());
    $(document).on('click', '.btn-theme', () => {
      const t = toggleTheme();
      $('.btn-theme i').attr('class', t === 'dark' ? 'bi bi-sun' : 'bi bi-moon');
      $('#theme-switch').prop('checked', t === 'dark');
    });
    $('.btn-theme i').first().attr('class', getTheme() === 'dark' ? 'bi bi-sun' : 'bi bi-moon');

    $(document).on('click', '.btn-refresh', async () => {
      setLoading(true);
      try {
        await AppStore.refresh();
        showToast('Data refreshed');
        this.route();
      } catch (err) {
        showToast(err.message || 'Refresh failed', 'error');
      } finally {
        setLoading(false);
      }
    });

    EntriesView.bind();
    ClientsView.bind();
    ExportView.bind();
    SettingsView.bind();
  },

  parseRoute() {
    let hash = location.hash.replace(/^#/, '') || '/';
    if (!hash.startsWith('/')) hash = '/' + hash;
    if (hash === '/' || hash === '') return { name: 'entries' };
    if (hash === '/clients') return { name: 'clients' };
    if (hash === '/export') return { name: 'export' };
    if (hash === '/settings') return { name: 'settings' };
    return { name: 'entries' };
  },

  show(viewId) {
    $('.app-view').addClass('d-none');
    $(viewId).removeClass('d-none');
    window.scrollTo(0, 0);
  },

  setNav(active) {
    $('#side-nav a').removeClass('active');
    $(`#side-nav a[data-nav="${active}"]`).addClass('active');
  },

  route() {
    const route = this.parseRoute();
    if (route.name === 'entries') {
      document.title = 'Hours — Invoice Manager';
      this.show('#view-entries');
      this.setNav('entries');
      EntriesView.render();
      return;
    }
    if (route.name === 'clients') {
      document.title = 'Clients — Invoice Manager';
      this.show('#view-clients');
      this.setNav('clients');
      ClientsView.render();
      return;
    }
    if (route.name === 'export') {
      document.title = 'Export — Invoice Manager';
      this.show('#view-export');
      this.setNav('export');
      ExportView.show();
      return;
    }
    if (route.name === 'settings') {
      document.title = 'Settings — Invoice Manager';
      this.show('#view-settings');
      this.setNav('settings');
      SettingsView.show(this.currentUser);
    }
  }
};

$(() => App.start());
