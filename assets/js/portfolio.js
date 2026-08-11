(function () {
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const THEMES = [
    { id: 'classic', name: 'Classic Center', desc: 'Centered serif, simple rules', swatch: '#fff', pdfBg: '#ffffff' },
    { id: 'left', name: 'Clean Left', desc: 'Sans, name left / contact right', swatch: '#fff', pdfBg: '#ffffff' },
    { id: 'split', name: 'Two Column', desc: 'Light sidebar + content', swatch: 'linear-gradient(90deg,#f5f5f5 35%,#fff 35%)', pdfBg: '#ffffff' },
    { id: 'compact', name: 'Compact', desc: 'Tighter type and spacing', swatch: '#fff', pdfBg: '#ffffff' },
    { id: 'serif', name: 'Editorial Serif', desc: 'Large serif, italic role', swatch: '#fff', pdfBg: '#ffffff' },
    { id: 'lined', name: 'Double Rule', desc: 'Section lines, double header', swatch: '#fff', pdfBg: '#ffffff' },
    { id: 'mono', name: 'Mono', desc: 'Monospace, dashed rule', swatch: '#fff', pdfBg: '#ffffff' },
    { id: 'banner', name: 'Name Banner', desc: 'Black header bar, white body', swatch: 'linear-gradient(#111 40%,#fff 40%)', pdfBg: '#ffffff' },
    { id: 'airy', name: 'Airy', desc: 'Wide margins, light type', swatch: '#fff', pdfBg: '#ffffff' },
    { id: 'grid', name: 'Boxed', desc: 'Boxed header, black labels', swatch: '#fff', pdfBg: '#ffffff' }
  ];

  const KEY = 'resume_theme';
  const sheet = document.getElementById('resume');

  function getThemeId() {
    const fromUrl = new URLSearchParams(location.search).get('theme');
    if (fromUrl && THEMES.some(t => t.id === fromUrl)) return fromUrl;
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && THEMES.some(t => t.id === saved)) return saved;
    } catch (e) { /* ignore */ }
    return 'classic';
  }

  function themeMeta(id) {
    return THEMES.find(t => t.id === id) || THEMES[0];
  }

  function applyTheme(id) {
    if (!sheet) return;
    THEMES.forEach(t => sheet.classList.remove('theme-' + t.id));
    sheet.classList.add('theme-' + id);
    sheet.dataset.theme = id;
    try { localStorage.setItem(KEY, id); } catch (e) { /* ignore */ }
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === id);
    });
  }

  function renderPicker() {
    const list = document.getElementById('theme-list');
    if (!list) return;
    const selected = getThemeId();
    list.innerHTML = THEMES.map(t => `
      <button type="button" class="theme-btn${t.id === selected ? ' active' : ''}" data-theme="${t.id}">
        <span class="swatch" style="background:${t.swatch}"></span>
        <span>
          <strong>${t.name}</strong>
          <span>${t.desc}</span>
        </span>
      </button>
    `).join('');
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('.theme-btn');
      if (!btn) return;
      applyTheme(btn.dataset.theme);
    });
    applyTheme(selected);
  }

  const menu = document.getElementById('download-menu');
  const toggle = document.getElementById('download-toggle');
  if (menu && toggle) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', () => {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  function downloadPdf() {
    const source = document.getElementById('resume');
    if (!source) {
      window.location.href = 'resume.html?download=pdf';
      return;
    }
    if (typeof html2pdf === 'undefined') {
      window.print();
      return;
    }
    const id = source.dataset.theme || getThemeId();
    const meta = themeMeta(id);
    const opt = {
      margin: [8, 8, 8, 8],
      filename: 'Bipin-Fultariya-Senior-Web-Developer.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: meta.pdfBg },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(source).save();
  }

  function printResume() {
    if (document.getElementById('resume')) {
      window.print();
      return;
    }
    window.open('resume.html', '_blank');
  }

  function downloadVcard() {
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Fultariya;Bipin;;;',
      'FN:Bipin Fultariya',
      'TITLE:Senior Web Developer',
      'TEL;TYPE=CELL:+918511880657',
      'EMAIL;TYPE=INTERNET:bpnptl24@gmail.com',
      'URL:https://bipin244.github.io',
      'ADR;TYPE=HOME:;;Rajkot;Gujarat;360004;India;',
      'NOTE:Laravel React.js Full-Stack Development',
      'END:VCARD'
    ].join('\r\n');
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Bipin-Fultariya.vcf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  renderPicker();

  document.getElementById('btn-download-pdf')?.addEventListener('click', downloadPdf);
  document.getElementById('btn-print')?.addEventListener('click', printResume);
  document.getElementById('btn-vcard')?.addEventListener('click', downloadVcard);

  if (document.getElementById('resume') && /download=pdf/.test(location.search)) {
    setTimeout(downloadPdf, 500);
  }
})();
