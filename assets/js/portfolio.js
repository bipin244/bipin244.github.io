/* Bipin Fultariya — portfolio interactions.
   Shared by index.html and resume.html; resume.html only uses the
   PDF/print handlers, so every lookup below is null-safe. */

(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------- Footer */

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* ------------------------------------------------------- Resume dropdown */

  const dropdown = $('#download-menu');
  const dropdownToggle = $('#download-toggle');

  if (dropdown && dropdownToggle) {
    const setOpen = (open) => {
      dropdown.classList.toggle('open', open);
      dropdownToggle.setAttribute('aria-expanded', String(open));
    };

    dropdownToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!dropdown.classList.contains('open'));
    });

    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target.closest('a, [role="menuitem"]')) setOpen(false);
    });

    document.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !dropdown.classList.contains('open')) return;
      setOpen(false);
      dropdownToggle.focus();
    });
  }

  /* ------------------------------------------------------------ Mobile nav */

  const menuToggle = $('#menu-toggle');
  const navLinks = $('#nav-links');

  if (menuToggle && navLinks) {
    const icon = $('use', menuToggle);

    const setNav = (open) => {
      document.body.classList.toggle('nav-open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (icon) icon.setAttribute('href', open ? '#i-close' : '#i-menu');
    };

    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setNav(!document.body.classList.contains('nav-open'));
    });

    $$('a', navLinks).forEach((link) => link.addEventListener('click', () => setNav(false)));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setNav(false);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) setNav(false);
    });
  }

  /* ------------------------------------------ Sticky nav state + progress */

  const nav = $('#nav');
  const progress = $('#nav-progress');

  if (nav) {
    let ticking = false;

    const onScroll = () => {
      nav.classList.toggle('is-stuck', window.scrollY > 8);

      if (progress) {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
        progress.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
      }

      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(onScroll);
    }, { passive: true });

    onScroll();
  }

  /* -------------------------------------------------------------- Scrollspy */

  const spyLinks = $$('#nav-links a[href^="#"]');

  if (spyLinks.length && 'IntersectionObserver' in window) {
    const targets = spyLinks
      .map((link) => ({ link, section: document.getElementById(link.hash.slice(1)) }))
      .filter((entry) => entry.section);

    const setCurrent = (link) => {
      targets.forEach((entry) => {
        const active = entry.link === link;
        if (active) entry.link.setAttribute('aria-current', 'true');
        else entry.link.removeAttribute('aria-current');
      });
    };

    const visible = new Set();

    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });

      const first = targets.find((entry) => visible.has(entry.section));
      if (first) setCurrent(first.link);
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    targets.forEach((entry) => spy.observe(entry.section));
  }

  /* ----------------------------------------------------------- Scroll reveal */

  const revealables = $$('.reveal, [data-stagger]');

  if (revealables.length) {
    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      revealables.forEach((el) => el.classList.add('is-visible'));
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });

      revealables.forEach((el) => {
        // Anything already on screen at load should not wait for a scroll.
        if (el.getBoundingClientRect().top < window.innerHeight * 0.95) {
          el.classList.add('is-visible');
        }
        io.observe(el);
      });
    }
  }

  document.body.classList.add('is-ready');

  /* ----------------------------------------------------------- Resume export */

  async function downloadPdf() {
    const source = document.getElementById('resume');

    if (!source) {
      window.location.href = 'resume.html?download=pdf';
      return;
    }

    const btn = document.getElementById('btn-download-pdf');
    const previous = btn ? btn.innerHTML : null;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Generating…';
    }

    try {
      if (typeof window.downloadResumePdf === 'function') {
        await window.downloadResumePdf(source);
      } else {
        window.print();
      }
    } catch (err) {
      console.error('PDF export failed:', err);
      window.print();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = previous;
      }
    }
  }

  function printResume() {
    if (document.getElementById('resume')) {
      window.print();
      return;
    }
    window.open('resume.html', '_blank', 'noopener');
  }

  function downloadVcard() {
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Fultariya;Bipin;;;',
      'FN:Bipin Fultariya',
      'TITLE:Senior Full-Stack Developer',
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

  const pdfBtn = $('#btn-download-pdf');
  const printBtn = $('#btn-print');
  const vcardBtn = $('#btn-vcard');

  if (pdfBtn) pdfBtn.addEventListener('click', downloadPdf);
  if (printBtn) printBtn.addEventListener('click', printResume);
  if (vcardBtn) vcardBtn.addEventListener('click', downloadVcard);

  if (document.getElementById('resume') && /download=pdf/.test(location.search)) {
    setTimeout(downloadPdf, 1200);
  }
})();
