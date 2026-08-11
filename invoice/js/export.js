/**
 * PDF invoice export — 5 themes + light customization (USD)
 */

const InvoiceExport = {
  THEME_KEY: 'inv_pdf_theme',
  CUSTOM_KEY: 'inv_pdf_custom',

  themes: [
    {
      id: 'minimal',
      name: 'Minimal Mono',
      desc: 'Black & white, thin rules',
      accent: [30, 30, 30],
      preview: '#1e1e1e'
    },
    {
      id: 'classic',
      name: 'Classic Teal',
      desc: 'Clean dual header, teal table',
      accent: [15, 118, 110],
      preview: '#0f766e'
    },
    {
      id: 'modern',
      name: 'Modern Bold',
      desc: 'Full-width banner, strong totals',
      accent: [37, 99, 235],
      preview: '#2563eb'
    },
    {
      id: 'corporate',
      name: 'Corporate Navy',
      desc: 'Formal navy with gold accent',
      accent: [30, 58, 95],
      preview: '#1e3a5f'
    },
    {
      id: 'accent',
      name: 'Creative Stripe',
      desc: 'Side stripe + accent totals',
      accent: [192, 57, 43],
      preview: '#c0392b'
    }
  ],

  defaultCustom() {
    return {
      accentHex: '',
      showDescription: true,
      thankYou: '',
      tagline: ''
    };
  },

  getThemeId() {
    try {
      return localStorage.getItem(this.THEME_KEY) || 'minimal';
    } catch (e) {
      return 'minimal';
    }
  },

  setThemeId(id) {
    try {
      localStorage.setItem(this.THEME_KEY, id);
    } catch (e) { /* ignore */ }
  },

  getTheme(id) {
    return this.themes.find(t => t.id === (id || this.getThemeId())) || this.themes[0];
  },

  getCustom() {
    try {
      return { ...this.defaultCustom(), ...(JSON.parse(localStorage.getItem(this.CUSTOM_KEY) || '{}') || {}) };
    } catch (e) {
      return this.defaultCustom();
    }
  },

  setCustom(partial) {
    try {
      const next = { ...this.getCustom(), ...partial };
      localStorage.setItem(this.CUSTOM_KEY, JSON.stringify(next));
      return next;
    } catch (e) {
      return this.getCustom();
    }
  },

  hexToRgb(hex) {
    const h = String(hex || '').replace('#', '').trim();
    if (h.length !== 6) return null;
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },

  resolveAccent(theme, custom) {
    const fromHex = this.hexToRgb(custom?.accentHex);
    return fromHex || theme.accent;
  },

  async ensureLibs() {
    await loadScripts([
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
      'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js'
    ]);
  },

  buildInvoiceNumber(profile, from, to) {
    const prefix = (profile?.invoicePrefix || 'INV').replace(/\s+/g, '');
    const end = (to || from || todayISO()).replace(/-/g, '');
    return `${prefix}-${end}`;
  },

  summarize(entries) {
    const totalHours = entries.reduce((s, e) => s + (Number(e.hours) || 0), 0);
    const totalAmount = entries.reduce((s, e) => s + entryAmount(e), 0);
    return { totalHours, totalAmount };
  },

  tableBody(entries, showDescription) {
    const body = entries.map(e => {
      const row = [
        formatDate(e.workDate),
        formatHours(e.hours),
        formatMoney(e.rateSnapshot),
        formatMoney(entryAmount(e))
      ];
      if (showDescription) row.splice(1, 0, e.description || '—');
      return row;
    });
    if (!body.length) {
      body.push(showDescription
        ? ['—', 'No entries in this range', '—', '—', '—']
        : ['—', '—', '—', '—']);
    }
    return body;
  },

  tableHead(showDescription) {
    return showDescription
      ? [['Date', 'Description', 'Hours', 'Rate (USD)', 'Amount']]
      : [['Date', 'Hours', 'Rate (USD)', 'Amount']];
  },

  columnStyles(showDescription) {
    if (showDescription) {
      return {
        0: { cellWidth: 28 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 22, halign: 'right' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' }
      };
    }
    return {
      0: { cellWidth: 36 },
      1: { cellWidth: 30, halign: 'right' },
      2: { cellWidth: 36, halign: 'right' },
      3: { cellWidth: 'auto', halign: 'right' }
    };
  },

  drawProfileBlock(doc, profile, x, y, maxW, opts = {}) {
    const { boldSize = 12, muted = [60, 60, 60] } = opts;
    doc.setFontSize(boldSize);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    doc.text(profile.businessName || 'Your Name', x, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...muted);
    [profile.email, profile.phone, profile.address].filter(Boolean).forEach(line => {
      const lines = doc.splitTextToSize(String(line), maxW);
      doc.text(lines, x, y);
      y += lines.length * 4.2;
    });
    doc.setTextColor(0);
    return y;
  },

  drawBillTo(doc, client, x, y, maxW) {
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.setFont(undefined, 'bold');
    doc.text('BILL TO', x, y);
    y += 5;
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(client.name || 'Client', x, y);
    y += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60);
    [client.email, client.address].filter(Boolean).forEach(line => {
      const lines = doc.splitTextToSize(String(line), maxW);
      doc.text(lines, x, y);
      y += lines.length * 4.2;
    });
    doc.setTextColor(0);
    return y;
  },

  /* ——— Theme: Classic Teal ——— */
  renderClassic(doc, ctx) {
    const { profile, client, from, to, invoiceNo, accent, custom, margin, pageW } = ctx;
    let y = margin;

    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...accent);
    doc.text('INVOICE', pageW - margin, y, { align: 'right' });
    doc.setTextColor(0);
    y += 7;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(80);
    doc.text(`Invoice #: ${invoiceNo}`, pageW - margin, y, { align: 'right' });
    y += 5;
    doc.text(`Period: ${formatDate(from)} – ${formatDate(to)}`, pageW - margin, y, { align: 'right' });
    doc.setTextColor(0);

    let leftY = this.drawProfileBlock(doc, profile, margin, margin, 80);
    if (custom.tagline) {
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(custom.tagline, margin, leftY + 1);
      leftY += 5;
    }
    y = Math.max(y, leftY) + 8;
    y = this.drawBillTo(doc, client, margin, y, 90) + 6;
    return y;
  },

  /* ——— Theme: Modern Bold ——— */
  renderModern(doc, ctx) {
    const { profile, client, from, to, invoiceNo, accent, custom, margin, pageW } = ctx;
    doc.setFillColor(...accent);
    doc.rect(0, 0, pageW, 42, 'F');
    doc.setTextColor(255);
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text('INVOICE', margin, 18);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(invoiceNo, margin, 26);
    doc.text(`${formatDate(from)} – ${formatDate(to)}`, pageW - margin, 18, { align: 'right' });
    if (custom.tagline) {
      doc.setFontSize(8);
      doc.text(custom.tagline, pageW - margin, 26, { align: 'right' });
    }

    doc.setTextColor(0);
    let y = 52;
    const leftY = this.drawProfileBlock(doc, profile, margin, y, 85);
    const rightY = this.drawBillTo(doc, client, pageW / 2, y, 85);
    return Math.max(leftY, rightY) + 8;
  },

  /* ——— Theme: Minimal Mono ——— */
  renderMinimal(doc, ctx) {
    const { profile, client, from, to, invoiceNo, accent, custom, margin, pageW } = ctx;
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.6);
    doc.line(margin, 18, pageW - margin, 18);

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...accent);
    doc.text('Invoice', margin, 28);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(80);
    doc.text(invoiceNo, pageW - margin, 24, { align: 'right' });
    doc.text(`${formatDate(from)} – ${formatDate(to)}`, pageW - margin, 30, { align: 'right' });

    let y = 40;
    y = this.drawProfileBlock(doc, profile, margin, y, 90, { boldSize: 11 }) + 2;
    if (custom.tagline) {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(custom.tagline, margin, y);
      y += 6;
    }
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageW - margin, y);
    y += 8;
    y = this.drawBillTo(doc, client, margin, y, 100) + 6;
    return y;
  },

  /* ——— Theme: Corporate Navy ——— */
  renderCorporate(doc, ctx) {
    const { profile, client, from, to, invoiceNo, accent, custom, margin, pageW } = ctx;
    const gold = [184, 148, 58];

    doc.setFillColor(...accent);
    doc.rect(0, 0, pageW, 8, 'F');
    doc.setFillColor(...gold);
    doc.rect(0, 8, pageW, 1.2, 'F');

    let y = 22;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...accent);
    doc.text((profile.businessName || 'Your Name').toUpperCase(), margin, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(90);
    const meta = [profile.email, profile.phone].filter(Boolean).join('  ·  ');
    if (meta) { doc.text(meta, margin, y); y += 4; }
    if (profile.address) {
      const lines = doc.splitTextToSize(profile.address, 100);
      doc.text(lines, margin, y);
      y += lines.length * 3.8;
    }
    if (custom.tagline) {
      doc.setTextColor(...gold);
      doc.text(custom.tagline, margin, y + 1);
      y += 5;
    }

    doc.setTextColor(...accent);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('INVOICE', pageW - margin, 24, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(80);
    doc.text(`No. ${invoiceNo}`, pageW - margin, 31, { align: 'right' });
    doc.text(`Period ${formatDate(from)} – ${formatDate(to)}`, pageW - margin, 37, { align: 'right' });

    y = Math.max(y, 42) + 6;
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(margin, y, pageW - margin * 2, 28, 2, 2, 'F');
    const billY = this.drawBillTo(doc, client, margin + 4, y + 6, pageW - margin * 2 - 10);
    return Math.max(billY, y + 28) + 8;
  },

  /* ——— Theme: Creative Stripe ——— */
  renderAccent(doc, ctx) {
    const { profile, client, from, to, invoiceNo, accent, custom, margin, pageW } = ctx;
    doc.setFillColor(...accent);
    doc.rect(0, 0, 8, doc.internal.pageSize.getHeight(), 'F');

    const left = margin + 4;
    let y = 20;
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...accent);
    doc.text('Invoice', left, y);
    doc.setTextColor(0);
    y += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(80);
    doc.text(invoiceNo, left, y);
    doc.text(`${formatDate(from)} – ${formatDate(to)}`, pageW - margin, 20, { align: 'right' });
    y += 10;

    const pY = this.drawProfileBlock(doc, profile, left, y, 85);
    if (custom.tagline) {
      doc.setFontSize(8);
      doc.setTextColor(...accent);
      doc.text(custom.tagline, left, pY + 1);
    }
    const bY = this.drawBillTo(doc, client, pageW / 2, y, 85);
    return Math.max(pY + (custom.tagline ? 6 : 0), bY) + 10;
  },

  renderTotals(doc, themeId, ctx, y) {
    const { totalHours, totalAmount, accent, margin, pageW } = ctx;
    doc.setTextColor(0);

    if (themeId === 'modern') {
      doc.setFillColor(...accent);
      doc.roundedRect(pageW - margin - 70, y - 2, 70, 22, 2, 2, 'F');
      doc.setTextColor(255);
      doc.setFontSize(8);
      doc.text('TOTAL DUE', pageW - margin - 65, y + 5);
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.text(formatMoney(totalAmount), pageW - margin - 5, y + 14, { align: 'right' });
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Total hours: ${formatHours(totalHours)}`, margin, y + 10);
      return y + 28;
    }

    if (themeId === 'corporate') {
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.4);
      doc.line(pageW - margin - 75, y, pageW - margin, y);
      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text(`Hours ${formatHours(totalHours)}`, pageW - margin, y + 6, { align: 'right' });
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...accent);
      doc.text(`Amount Due  ${formatMoney(totalAmount)}`, pageW - margin, y + 14, { align: 'right' });
      doc.setTextColor(0);
      return y + 22;
    }

    if (themeId === 'accent') {
      doc.setFillColor(...accent);
      doc.circle(margin + 6, y + 8, 3, 'F');
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0);
      doc.text(`Total hours: ${formatHours(totalHours)}`, margin + 14, y + 10);
      doc.setTextColor(...accent);
      doc.text(`Total due: ${formatMoney(totalAmount)}`, pageW - margin, y + 10, { align: 'right' });
      doc.setTextColor(0);
      return y + 20;
    }

    if (themeId === 'minimal') {
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Hours  ${formatHours(totalHours)}`, margin, y);
      doc.setFont(undefined, 'bold');
      doc.text(`Due  ${formatMoney(totalAmount)}`, pageW - margin, y, { align: 'right' });
      return y + 10;
    }

    // classic
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`Total hours: ${formatHours(totalHours)}`, margin, y);
    doc.setTextColor(...accent);
    doc.text(`Total due: ${formatMoney(totalAmount)}`, pageW - margin, y, { align: 'right' });
    doc.setTextColor(0);
    return y + 10;
  },

  /**
   * @param {{ profile, client, from, to, entries, themeId?, custom? }} opts
   */
  async exportPDF(opts) {
    await this.ensureLibs();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 16;
    const pageW = doc.internal.pageSize.getWidth();

    const theme = this.getTheme(opts.themeId || this.getThemeId());
    const custom = { ...this.getCustom(), ...(opts.custom || {}) };
    const accent = this.resolveAccent(theme, custom);
    const showDescription = custom.showDescription !== false;

    const profile = opts.profile || {};
    const client = opts.client || {};
    const entries = [...(opts.entries || [])].sort((a, b) =>
      (a.workDate || '').localeCompare(b.workDate || '')
    );
    const { totalHours, totalAmount } = this.summarize(entries);
    const invoiceNo = this.buildInvoiceNumber(profile, opts.from, opts.to);

    const ctx = {
      profile, client, from: opts.from, to: opts.to,
      entries, invoiceNo, accent, custom, margin, pageW,
      totalHours, totalAmount
    };

    const starters = {
      classic: () => this.renderClassic(doc, ctx),
      modern: () => this.renderModern(doc, ctx),
      minimal: () => this.renderMinimal(doc, ctx),
      corporate: () => this.renderCorporate(doc, ctx),
      accent: () => this.renderAccent(doc, ctx)
    };
    let y = (starters[theme.id] || starters.classic)();

    const headStyles = theme.id === 'minimal'
      ? { fillColor: [255, 255, 255], textColor: 20, lineWidth: 0.2, lineColor: [180, 180, 180] }
      : theme.id === 'corporate'
        ? { fillColor: accent, textColor: 255 }
        : { fillColor: accent, textColor: 255 };

    const alt = theme.id === 'minimal'
      ? { fillColor: [255, 255, 255] }
      : theme.id === 'corporate'
        ? { fillColor: [245, 247, 250] }
        : { fillColor: [243, 245, 244] };

    doc.autoTable({
      startY: y,
      head: this.tableHead(showDescription),
      body: this.tableBody(entries, showDescription),
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        lineColor: theme.id === 'minimal' ? [200, 200, 200] : [230, 230, 230],
        lineWidth: theme.id === 'minimal' ? 0.2 : 0.1
      },
      headStyles,
      alternateRowStyles: alt,
      margin: {
        left: theme.id === 'accent' ? margin + 4 : margin,
        right: margin
      },
      columnStyles: this.columnStyles(showDescription)
    });

    y = doc.lastAutoTable.finalY + 10;
    this.renderTotals(doc, theme.id, ctx, y);

    const name = safeFilename(`${invoiceNo}_${client.name || 'client'}`);
    doc.save(name + '.pdf');
  }
};
