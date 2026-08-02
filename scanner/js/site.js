/**
 * Site detail view — devices loaded per site from Supabase
 */
const SiteView = {
  bound: false,
  siteId: null,
  sortField: 'deviceType',
  sortAsc: true,
  lastScanAt: 0,

  bind() {
    if (this.bound) return;
    this.bound = true;

    fillDeviceTypeSelect();

    $('#btn-add-device').on('click', () => this.openDeviceModal());
    $('#btn-scan').on('click', () => this.openScanner());

    const runExcel = async () => {
      try {
        await this.ensureExportLibs();
        ExportService.exportExcel(AppStore.getSite(this.siteId), this.getFilteredDevices());
        showToast('Excel downloaded');
      } catch (err) {
        console.error(err);
        showToast(err.message || 'Failed to export Excel', 'error');
      }
    };
    const runPdf = async () => {
      try {
        await this.ensureExportLibs();
        ExportService.exportPDF(AppStore.getSite(this.siteId), this.getFilteredDevices());
        showToast('PDF downloaded');
      } catch (err) {
        console.error(err);
        showToast(err.message || 'Failed to export PDF', 'error');
      }
    };
    const runPrint = () => {
      ExportService.print(AppStore.getSite(this.siteId), this.getFilteredDevices());
    };

    $('#btn-export-excel, .btn-export-excel-alt').on('click', runExcel);
    $('#btn-export-pdf, .btn-export-pdf-alt').on('click', runPdf);
    $('#btn-print, .btn-print-alt').on('click', runPrint);

    $('#device-form').on('submit', (e) => this.saveDevice(e));
    $('#device-search').on('input', () => this.renderDevices());
    $('#device-sort').on('change', function () {
      const val = $(this).val();
      if (val === SiteView.sortField) SiteView.sortAsc = !SiteView.sortAsc;
      else {
        SiteView.sortField = val;
        SiteView.sortAsc = val !== 'installationDate';
      }
      SiteView.renderDevices();
    });

    $('#devices-list').on('click', '[data-action="edit"]', (e) => {
      const id = $(e.currentTarget).closest('[data-device-id]').data('device-id');
      const device = AppStore.getSiteDevices(this.siteId).find(d => d.id === id);
      if (device) this.openDeviceModal(device);
    });

    $('#devices-list').on('click', '[data-action="delete"]', async (e) => {
      const id = $(e.currentTarget).closest('[data-device-id]').data('device-id');
      await this.deleteDevice(id);
    });

    $('#scanner-modal').on('hidden.bs.modal', async () => {
      await Scanner.stop();
    });

    $('#btn-use-scan').on('click', () => {
      const serial = $('#scanned-serial').val().trim();
      if (!serial) {
        showToast('No serial scanned yet', 'warning');
        return;
      }
      bootstrap.Modal.getInstance(document.getElementById('scanner-modal')).hide();
      this.openDeviceModal(null, serial);
    });
  },

  /**
   * After a successful scan: stop camera, hide preview, keep serial for confirm
   */
  async onScanSuccess(text, source) {
    const now = Date.now();
    if (now - this.lastScanAt < 1200 && $('#scanned-serial').val() === text) return;
    this.lastScanAt = now;

    $('#scanned-serial').val(text);
    if (navigator.vibrate) navigator.vibrate(100);

    try {
      await Scanner.stop();
    } catch (e) { /* ignore */ }

    $('#scanner-preview').addClass('d-none');
    $('#scan-done-panel').removeClass('d-none');
    $('#scan-done-serial').text(text);
    $('#scan-status').html(
      source === 'photo'
        ? '<span class="text-success"><i class="bi bi-check-circle"></i> Scanned from photo</span>'
        : '<span class="text-success"><i class="bi bi-check-circle"></i> Scanned — camera closed</span>'
    );
    showToast('Scanned — camera closed');
  },

  async show(siteId) {
    this.siteId = siteId;
    setLoading(true);
    try {
      await AppStore.ensureSites();
      let site = AppStore.getSite(siteId);
      if (!site) {
        site = await getSite(siteId);
        if (site) AppStore.upsertSite(site);
      }
      if (!site) {
        showToast('Site not found', 'error');
        App.go('/');
        return;
      }
      await AppStore.ensureDevices(siteId, true);
      this.paintHeader(AppStore.getSite(siteId));
      this.renderDevices();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to load site', 'error');
    } finally {
      setLoading(false);
    }
  },

  async refresh() {
    if (!this.siteId) return;
    try {
      await AppStore.ensureDevices(this.siteId, true);
      const site = await getSite(this.siteId);
      if (site) AppStore.upsertSite(site);
      this.paintHeader(AppStore.getSite(this.siteId));
      this.renderDevices();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Refresh failed', 'error');
    }
  },

  paintHeader(site) {
    if (!site) return;
    $('#site-title').text(site.name);
    $('#site-customer-label').text(site.customer || '');
    $('#site-address-row').toggleClass('d-none', !site.address);
    $('#site-address-label').text(site.address || '');
    $('#site-contact-row').toggleClass('d-none', !site.contactPerson && !site.phone);
    $('#site-contact-label').text(
      [site.contactPerson, site.phone].filter(Boolean).join(' · ')
    );
    $('#site-notes-row').toggleClass('d-none', !site.notes);
    $('#site-notes-label').text(site.notes || '');
  },

  getDevices() {
    return AppStore.getSiteDevices(this.siteId);
  },

  getFilteredDevices() {
    const q = ($('#device-search').val() || '').toLowerCase().trim();
    let list = [...this.getDevices()];
    if (q) {
      list = list.filter(d =>
        (d.serialNumber || '').toLowerCase().includes(q) ||
        (d.model || '').toLowerCase().includes(q) ||
        (d.deviceType || '').toLowerCase().includes(q) ||
        (d.remarks || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const av = (a[this.sortField] || '').toString().toLowerCase();
      const bv = (b[this.sortField] || '').toString().toLowerCase();
      if (av < bv) return this.sortAsc ? -1 : 1;
      if (av > bv) return this.sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  },

  renderDevices() {
    const list = this.getFilteredDevices();
    $('#device-count').text(`${list.length}`);

    const $list = $('#devices-list');
    const $empty = $('#devices-empty');

    if (!list.length) {
      $list.empty();
      $empty.removeClass('d-none');
      return;
    }

    $empty.addClass('d-none');
    $list.html(list.map(d => `
      <article class="device-card" data-device-id="${escapeHtml(d.id)}">
        <div class="device-card-head">
          <span class="type-badge">${deviceTypeBadgeHtml(d.deviceType)}</span>
          <span class="device-date">${escapeHtml(d.installationDate || '—')}</span>
        </div>
        <p class="device-serial">${escapeHtml(d.serialNumber)}</p>
        <p class="device-model">${escapeHtml(d.model || 'No model')}</p>
        <div class="device-card-actions">
          <button class="btn btn-outline-secondary" data-action="edit" type="button">
            <i class="bi bi-pencil"></i> Edit
          </button>
          <button class="btn btn-outline-danger" data-action="delete" type="button">
            <i class="bi bi-trash"></i> Delete
          </button>
        </div>
      </article>
    `).join(''));
  },

  openDeviceModal(device, prefillSerial) {
    $('#device-modal-title').text(device ? 'Edit Device' : 'Add Device');
    $('#device-id').val(device?.id || '');
    fillDeviceTypeSelect(null, device?.deviceType || '');
    $('#device-model').val(device?.model || '');
    $('#device-serial').val(device?.serialNumber || prefillSerial || '');
    $('#device-date').val(device?.installationDate || todayISO());
    $('#device-remarks').val(device?.remarks || '');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('device-modal')).show();
    if (prefillSerial) setTimeout(() => $('#device-model').trigger('focus'), 300);
  },

  async saveDevice(e) {
    e.preventDefault();
    const id = $('#device-id').val();
    const data = {
      siteId: this.siteId,
      deviceType: $('#device-type').val(),
      model: $('#device-model').val(),
      serialNumber: $('#device-serial').val(),
      installationDate: $('#device-date').val(),
      remarks: $('#device-remarks').val()
    };

    if (!data.deviceType || !data.serialNumber.trim()) {
      showToast('Device type and serial number are required', 'warning');
      return;
    }

    const $btn = $('#device-form button[type="submit"]');
    $btn.prop('disabled', true);

    try {
      let devices = [...this.getDevices()];
      if (id) {
        const updated = await updateDevice(id, data);
        devices = devices.map(d => d.id === id ? updated : d);
        showToast('Device updated');
      } else {
        const created = await addDevice(data);
        devices.unshift(created);
        showToast('Device added');
      }
      AppStore.setSiteDevices(this.siteId, devices);
      bootstrap.Modal.getInstance(document.getElementById('device-modal')).hide();
      this.paintHeader(AppStore.getSite(this.siteId));
      this.renderDevices();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to save device', 'error');
    } finally {
      $btn.prop('disabled', false);
    }
  },

  async deleteDevice(id) {
    const device = this.getDevices().find(d => d.id === id);
    const ok = await confirmAction(`Delete device ${device?.serialNumber || ''}?`);
    if (!ok) return;

    try {
      await deleteDevice(id);
      const devices = this.getDevices().filter(d => d.id !== id);
      AppStore.setSiteDevices(this.siteId, devices);
      this.renderDevices();
      showToast('Device deleted');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to delete device', 'error');
    }
  },

  async ensureExportLibs() {
    await loadScripts([
      'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
      'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js'
    ]);
  },

  async openScanner() {
    $('#scanned-serial').val('');
    $('#scanner-preview').removeClass('d-none');
    $('#scan-done-panel').addClass('d-none');
    $('#scan-done-serial').text('');
    $('#scan-status').text('Starting camera...');
    const modalEl = document.getElementById('scanner-modal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    await new Promise(resolve => {
      const done = () => {
        modalEl.removeEventListener('shown.bs.modal', done);
        resolve();
      };
      if (modalEl.classList.contains('show')) resolve();
      else modalEl.addEventListener('shown.bs.modal', done);
      setTimeout(resolve, 600);
    });

    try {
      $('#scan-status').text('Loading scanner...');
      if (typeof Scanner.ensureLibrary === 'function') {
        await Scanner.ensureLibrary();
      }
      $('#scan-status').text('Put barcode in the green box');
      await Scanner.start(document.getElementById('scanner-video'), (text) => {
        this.onScanSuccess(text, 'camera');
      });
      if (!$('#scanner-preview').hasClass('d-none')) {
        $('#scan-status').text('Hold steady — fill the green box');
      }
    } catch (err) {
      console.error('Camera error:', err);
      const friendly = (typeof Scanner.explainError === 'function')
        ? Scanner.explainError(err)
        : (err.message || 'Permission denied');
      $('#scan-status').html(`<span class="text-danger">${escapeHtml(friendly)}</span>`);
      showToast(friendly, 'error');
    }
  }
};
