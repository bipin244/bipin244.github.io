/**
 * Shared utilities — Invoice Hours Manager
 */

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function monthStartISO(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}-01`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value + (String(value).length === 10 ? 'T12:00:00' : ''));
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(n);
}

function formatHours(h) {
  const n = Number(h) || 0;
  // Keep up to 2 decimals, drop trailing zeros (4.50 → 4.5, 8 → 8)
  return String(parseFloat(n.toFixed(2)));
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeFilename(name) {
  return (name || 'invoice')
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'invoice';
}

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

function confirmAction(message) {
  return Promise.resolve(window.confirm(message));
}

function getTheme() {
  return localStorage.getItem('inv_theme') || 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme);
  localStorage.setItem('inv_theme', theme);
}

function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

applyTheme(getTheme());

const _loadedScripts = new Set();
function loadScript(src) {
  if (_loadedScripts.has(src) || document.querySelector(`script[data-loaded-src="${src}"]`)) {
    _loadedScripts.add(src);
    return Promise.resolve();
  }
  if (document.querySelector(`script[src="${src}"]`)) {
    _loadedScripts.add(src);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.setAttribute('data-loaded-src', src);
    s.onload = () => { _loadedScripts.add(src); resolve(); };
    s.onerror = () => reject(new Error('Failed to load script: ' + src));
    document.head.appendChild(s);
  });
}

async function loadScripts(srcs) {
  for (const src of srcs) await loadScript(src);
}

function entryAmount(entry) {
  return (Number(entry.hours) || 0) * (Number(entry.rateSnapshot) || 0);
}

function rgbToHex(rgb) {
  const [r, g, b] = rgb || [0, 0, 0];
  const h = (n) => Number(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
