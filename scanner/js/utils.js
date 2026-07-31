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
 * Populate device-type icon picker (grid) + hidden value field
 */
function fillDeviceTypeSelect(containerOrSelect, selected) {
  const wrap = document.getElementById('device-type-picker');
  const hidden = document.getElementById('device-type');

  if (wrap && hidden) {
    wrap.innerHTML = DEVICE_TYPES.map(type => {
      const active = selected === type ? ' active' : '';
      return `
        <button type="button" class="type-pick${active}" data-type="${escapeHtml(type)}"
                aria-pressed="${selected === type ? 'true' : 'false'}">
          <i class="bi ${deviceTypeIcon(type)}" aria-hidden="true"></i>
          <span>${escapeHtml(type)}</span>
        </button>
      `;
    }).join('');
    hidden.value = selected || '';
    return;
  }

  // Fallback: plain <select>
  const selectEl = containerOrSelect;
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">Select type...</option>';
  DEVICE_TYPES.forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    if (selected === type) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

function setDeviceTypeValue(type) {
  const hidden = document.getElementById('device-type');
  if (hidden) hidden.value = type || '';
  $('#device-type-picker .type-pick').each(function () {
    const on = $(this).data('type') === type;
    $(this).toggleClass('active', on).attr('aria-pressed', on ? 'true' : 'false');
  });
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
