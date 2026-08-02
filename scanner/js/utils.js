/**
 * Shared utility functions
 */

/** Today's date as YYYY-MM-DD */
function todayISO() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Format Firestore timestamp or ISO string for display
 */
function formatDate(value) {
  if (!value) return '—';
  let date;
  if (value.toDate) {
    date = value.toDate();
  } else if (typeof value === 'string') {
    date = new Date(value);
  } else if (value.seconds) {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format date + time for "last updated"
 */
function formatDateTime(value) {
  if (!value) return '—';
  let date;
  if (value.toDate) {
    date = value.toDate();
  } else if (value.seconds) {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Escape HTML to prevent XSS when inserting into DOM
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize a string for use as a filename
 */
function safeFilename(name) {
  return (name || 'export')
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'export';
}

/**
 * Show Bootstrap toast notification
 */
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '1100';
    document.body.appendChild(container);
  }

  const bg = type === 'error' ? 'bg-danger' : type === 'warning' ? 'bg-warning text-dark' : 'bg-success';
  const id = 'toast-' + Date.now();
  container.insertAdjacentHTML('beforeend', `
    <div id="${id}" class="toast align-items-center text-white ${bg} border-0" role="alert">
      <div class="d-flex">
        <div class="toast-body">${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>
  `);
  const el = document.getElementById(id);
  const toast = new bootstrap.Toast(el, { delay: 3000 });
  toast.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

/**
 * Show/hide a full-page loading overlay
 */
function setLoading(show) {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = `
      <div class="spinner-border text-light" role="status" style="width:3rem;height:3rem;">
        <span class="visually-hidden">Loading...</span>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle('active', !!show);
}

/**
 * Searchable device-type combo (icons + filter) from AppStore categories.
 */
const DeviceTypeCombo = (() => {
  let bound = false;
  let open = false;

  function categories() {
    if (typeof getDeviceCategories === 'function') return getDeviceCategories();
    if (typeof AppStore !== 'undefined') return AppStore.getCategories();
    return [];
  }

  function displayHtml(type) {
    if (!type) return '<span class="text-secondary">Select type…</span>';
    const icon = typeof deviceTypeIcon === 'function' ? deviceTypeIcon(type) : 'bi-cpu';
    return `<i class="bi ${escapeHtml(icon)}" aria-hidden="true"></i><span>${escapeHtml(type)}</span>`;
  }

  function syncTrigger(type) {
    const $display = $('#device-type-display');
    if (!$display.length) return;
    $display.html(displayHtml(type));
    $('#device-type-trigger').toggleClass('has-value', !!type);
  }

  function renderOptions(filter = '') {
    const q = (filter || '').trim().toLowerCase();
    const cats = categories().slice();
    const selected = $('#device-type').val() || '';
    const $opts = $('#device-type-options');
    const $empty = $('#device-type-empty');
    if (!$opts.length) return;

    // Keep a legacy type (not in DB) visible while editing an existing device
    if (selected && !cats.some(c => c.name === selected)) {
      cats.unshift({
        name: selected,
        icon: typeof deviceTypeIcon === 'function' ? deviceTypeIcon(selected) : 'bi-cpu'
      });
    }

    if (!cats.length) {
      $opts.empty();
      $empty.removeClass('d-none').text('No categories — add in Settings');
      return;
    }

    const filtered = q
      ? cats.filter(c => (c.name || '').toLowerCase().includes(q))
      : cats;

    if (!filtered.length) {
      $opts.empty();
      $empty.removeClass('d-none').text('No matches');
      return;
    }

    $empty.addClass('d-none');
    $opts.html(filtered.map(c => {
      const name = c.name || '';
      const icon = c.icon || 'bi-cpu';
      const active = name === selected ? ' active' : '';
      return `
        <button type="button" class="type-combo-option${active}" role="option"
                data-type="${escapeHtml(name)}" aria-selected="${name === selected ? 'true' : 'false'}">
          <i class="bi ${escapeHtml(icon)}" aria-hidden="true"></i>
          <span>${escapeHtml(name)}</span>
        </button>
      `;
    }).join(''));
  }

  function setOpen(next) {
    open = !!next;
    $('#device-type-menu').toggleClass('d-none', !open);
    $('#device-type-trigger').attr('aria-expanded', open ? 'true' : 'false');
    $('#device-type-combo').toggleClass('is-open', open);
    if (open) {
      renderOptions($('#device-type-search').val());
      setTimeout(() => $('#device-type-search').trigger('focus').trigger('select'), 50);
    } else {
      $('#device-type-search').val('');
    }
  }

  function bind() {
    if (bound) return;
    bound = true;

    $(document).on('click', '#device-type-trigger', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!open);
    });

    $(document).on('input', '#device-type-search', function () {
      renderOptions(this.value);
    });

    $(document).on('keydown', '#device-type-search', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        $('#device-type-trigger').trigger('focus');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const $first = $('#device-type-options .type-combo-option').first();
        if ($first.length) $first.trigger('click');
      }
    });

    $(document).on('click', '#device-type-options .type-combo-option', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setDeviceTypeValue($(this).data('type'));
      setOpen(false);
    });

    $(document).on('click', function (e) {
      if (!open) return;
      if ($(e.target).closest('#device-type-combo').length) return;
      setOpen(false);
    });

    $('#device-modal').on('hidden.bs.modal', () => setOpen(false));
  }

  return {
    bind,
    fill(selected) {
      bind();
      const value = selected || '';
      $('#device-type').val(value);
      syncTrigger(value);
      renderOptions();
      setOpen(false);
    },
    setValue(type) {
      bind();
      const value = type || '';
      $('#device-type').val(value);
      syncTrigger(value);
      renderOptions($('#device-type-search').val());
    },
    close() {
      setOpen(false);
    }
  };
})();

/**
 * Populate device-type combo from AppStore categories (Settings).
 */
function fillDeviceTypeSelect(_containerOrSelect, selected) {
  DeviceTypeCombo.fill(selected || '');
}

function setDeviceTypeValue(type) {
  DeviceTypeCombo.setValue(type || '');
}

/**
 * Dark mode helpers
 */
function getTheme() {
  return localStorage.getItem('theme') || 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme);
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

// Apply saved theme early
applyTheme(getTheme());

/**
 * Get URL query parameter
 */
function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Lazily load a script once
 */
const _loadedScripts = new Set();
function loadScript(src) {
  // Already loaded this URL
  if (_loadedScripts.has(src) || document.querySelector(`script[data-loaded-src="${src}"]`)) {
    _loadedScripts.add(src);
    return Promise.resolve();
  }
  // Also treat existing script[src] as loaded
  if (document.querySelector(`script[src="${src}"]`)) {
    _loadedScripts.add(src);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.setAttribute('data-loaded-src', src);
    s.onload = () => {
      _loadedScripts.add(src);
      resolve();
    };
    s.onerror = () => reject(new Error('Failed to load script: ' + src));
    document.head.appendChild(s);
  });
}

async function loadScripts(srcs) {
  for (const src of srcs) {
    await loadScript(src);
  }
}


/**
 * Confirm dialog returning a Promise<boolean>
 */
function confirmAction(message) {
  return Promise.resolve(window.confirm(message));
}
