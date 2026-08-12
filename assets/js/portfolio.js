(function () {
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const menu = document.getElementById('download-menu');
  const toggle = document.getElementById('download-toggle');
  if (menu && toggle) {
    const closeMenu = () => {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = !menu.classList.contains('open');
      menu.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    menu.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = e.target.closest('a, button');
      if (item && item !== toggle) closeMenu();
    });

    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
  }

  const menuToggle = document.getElementById('menu-toggle');
  const navLinks = document.getElementById('nav-links');
  if (menuToggle && navLinks) {
    const setNavOpen = (open) => {
      document.body.classList.toggle('nav-open', open);
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
      const icon = menuToggle.querySelector('i');
      if (icon) icon.className = open ? 'bi bi-x-lg' : 'bi bi-list';
    };
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setNavOpen(!document.body.classList.contains('nav-open'));
    });
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setNavOpen(false));
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 880) setNavOpen(false);
    });
  }

  async function downloadPdf() {
    const source = document.getElementById('resume');
    if (!source) {
      window.location.href = 'resume.html?download=pdf';
      return;
    }

    const btn = document.getElementById('btn-download-pdf');
    const prevLabel = btn?.innerHTML;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Generating…';
    }

    try {
      if (typeof downloadResumePdf === 'function') {
        await downloadResumePdf(source);
      } else {
        window.print();
      }
    } catch (err) {
      console.error('PDF export failed:', err);
      window.print();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = prevLabel;
      }
    }
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
      'NOTE:Laravel React.js Node.js Full-Stack Development',
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

  document.getElementById('btn-download-pdf')?.addEventListener('click', downloadPdf);
  document.getElementById('btn-print')?.addEventListener('click', printResume);
  document.getElementById('btn-vcard')?.addEventListener('click', downloadVcard);

  if (document.getElementById('resume') && /download=pdf/.test(location.search)) {
    setTimeout(() => { downloadPdf(); }, 1200);
  }

  function initReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!items.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      items.forEach(el => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92) el.classList.add('is-visible');
      io.observe(el);
    });
  }

  initReveal();
  requestAnimationFrame(() => document.body.classList.add('is-ready'));
})();
