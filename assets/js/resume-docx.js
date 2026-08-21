/**
 * Build a Word (.docx) version of the resume from the same DOM the PDF uses,
 * so the two can never drift apart.
 *
 * Deliberately plain: real headings, real bullet lists, no tables, text boxes,
 * columns or images. Those are the constructs applicant tracking systems
 * mis-parse, and a Word download exists mainly because an ATS asked for one.
 */
(function (global) {
  const DOCX_LIB = 'https://cdn.jsdelivr.net/npm/docx@9.7.1/dist/index.iife.js';
  const FILENAME = 'Bipin-Fultariya-Senior-Full-Stack-Developer.docx';

  const FONT = 'Calibri';
  const BLACK = '111111';
  const MUTED = '3A3A3A';
  const FAINT = '5A5A5A';

  // A4 is 11906 twips wide; 0.5in margins leave this much usable width, which
  // is where the right-aligned date tab has to sit.
  const MARGIN = 720;
  const CONTENT_WIDTH = 11906 - MARGIN * 2;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(el);
    });
  }

  async function ensureDocx() {
    if (global.docx?.Packer) return;
    await loadScript(DOCX_LIB);
    if (!global.docx?.Packer) throw new Error('docx library did not load');
  }

  function txt(el, fallback) {
    return (el?.textContent || fallback || '').replace(/\s+/g, ' ').trim();
  }

  /* ------------------------------------------------------- building blocks */

  function run(text, opts = {}) {
    const { Paragraph, TextRun } = global.docx;
    void Paragraph;
    return new TextRun({
      text,
      font: FONT,
      size: opts.size || 20,
      bold: !!opts.bold,
      italics: !!opts.italics,
      color: opts.color || BLACK,
      allCaps: !!opts.allCaps
    });
  }

  function para(children, opts = {}) {
    const { Paragraph } = global.docx;
    return new Paragraph({
      children: Array.isArray(children) ? children : [children],
      spacing: { before: opts.before || 0, after: opts.after == null ? 60 : opts.after },
      alignment: opts.alignment,
      tabStops: opts.tabStops,
      border: opts.border,
      bullet: opts.bullet
    });
  }

  /** Section heading: uppercase, bold, with a rule underneath. */
  function heading(text) {
    const { BorderStyle } = global.docx;
    return para(run(text, { bold: true, size: 22, allCaps: true }), {
      before: 240,
      after: 100,
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 8, color: BLACK, space: 4 }
      }
    });
  }

  /** Title on the left, date pushed to the right margin with a tab stop. */
  function titleWithDate(title, date, subtitle) {
    const { TabStopType } = global.docx;
    const out = [];

    const children = [run(title, { bold: true, size: 22 })];
    if (date) children.push(run('\t' + date, { size: 19, color: FAINT }));

    out.push(para(children, {
      after: subtitle ? 20 : 60,
      tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }]
    }));

    if (subtitle) out.push(para(run(subtitle, { size: 19, color: FAINT, italics: true }), { after: 60 }));
    return out;
  }

  function bullets(items) {
    return items.map((item) => para(run(item, { color: MUTED }), { after: 40, bullet: { level: 0 } }));
  }

  /* ------------------------------------------------------------- sections */

  function buildHeader(header) {
    const { AlignmentType } = global.docx;
    const out = [];

    out.push(para(run(txt(header.querySelector('h1')), { bold: true, size: 44 }), {
      after: 40,
      alignment: AlignmentType.CENTER
    }));

    out.push(para(run(txt(header.querySelector('.role')), { size: 21, color: MUTED }), {
      after: 80,
      alignment: AlignmentType.CENTER
    }));

    // One plain contact line. Parsers pick email and phone out of this
    // reliably; a table of the same values often defeats them.
    const contact = [...header.querySelectorAll('.contact-strip li')].map((li) => {
      const label = txt(li.querySelector('.label'));
      return txt(li).replace(label, '').replace(/^:\s*/, '').trim();
    }).filter(Boolean);

    if (contact.length) {
      out.push(para(run(contact.join('  |  '), { size: 19, color: MUTED }), {
        after: 160,
        alignment: AlignmentType.CENTER
      }));
    }

    return out;
  }

  function buildSkills(block) {
    const out = [];
    block.querySelectorAll('.skill-line').forEach((line) => {
      const label = txt(line.querySelector('.skill-label'));
      const items = [...line.querySelectorAll('.skill-list li')].map((li) => txt(li));
      if (!items.length) return;
      out.push(para([
        run(label + ': ', { bold: true }),
        run(items.join(', '), { color: MUTED })
      ], { after: 60 }));
    });
    return out;
  }

  function buildJob(article) {
    const out = titleWithDate(
      txt(article.querySelector('.job-title h3')),
      txt(article.querySelector('.job-date')),
      txt(article.querySelector('.job-company'))
    );

    const paragraph = article.querySelector(':scope > p');
    if (paragraph) out.push(para(run(txt(paragraph), { color: MUTED }), { after: 60 }));

    out.push(...bullets([...article.querySelectorAll(':scope > ul li')].map((li) => txt(li))));
    out.push(para(run(''), { after: 80 }));
    return out;
  }

  function buildProject(article) {
    const out = titleWithDate(
      txt(article.querySelector('h3')),
      txt(article.querySelector('.project-period'))
    );

    const tags = [...article.querySelectorAll('.tags span')].map((s) => txt(s));
    if (tags.length) {
      out.push(para([
        run('Tech: ', { bold: true, size: 19 }),
        run(tags.join(', '), { size: 19, color: FAINT })
      ], { after: 40 }));
    }

    const description = txt(article.querySelector('p'));
    if (description) out.push(para(run(description, { color: MUTED }), { after: 60 }));

    out.push(para(run(''), { after: 80 }));
    return out;
  }

  function buildEducation(block) {
    const { TabStopType } = global.docx;
    const out = [];

    block.querySelectorAll('.edu-row').forEach((row) => {
      const degree = txt(row.querySelector('.edu-degree'));
      const school = txt(row.querySelector('.edu-school'));
      const meta = txt(row.querySelector('.edu-meta'));
      const year = txt(row.querySelector('.edu-year'));

      const line = [run(degree, { bold: true })];
      if (year) line.push(run('\t' + year, { size: 19, color: FAINT }));
      out.push(para(line, {
        after: 20,
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }]
      }));

      const detail = [school, meta].filter(Boolean).join(' — ');
      if (detail) out.push(para(run(detail, { size: 19, color: FAINT }), { after: 100 }));
    });

    return out;
  }

  function buildChildren(resumeEl) {
    const header = resumeEl.querySelector('.resume-header');
    const body = resumeEl.querySelector('.resume-body');
    const children = [...buildHeader(header)];

    body.querySelectorAll(':scope > .section-block').forEach((block) => {
      const title = txt(block.querySelector(':scope > h2'));
      children.push(heading(title));

      if (title === 'Summary' || title === 'Profile') {
        children.push(para(run(txt(block.querySelector('.profile-text')), { color: MUTED }), { after: 80 }));
        return;
      }
      if (title === 'Core Skills') {
        children.push(...buildSkills(block));
        return;
      }
      if (title === 'Professional Experience') {
        block.querySelectorAll('.job').forEach((job) => children.push(...buildJob(job)));
        return;
      }
      if (title === 'Featured Projects') {
        block.querySelectorAll('.project').forEach((project) => children.push(...buildProject(project)));
        return;
      }
      if (title === 'Education') {
        children.push(...buildEducation(block));
      }
    });

    return children;
  }

  function buildDocument(resumeEl) {
    const { Document } = global.docx;
    return new Document({
      creator: 'Bipin Fultariya',
      title: 'Bipin Fultariya — Senior Full Stack Developer',
      description: 'Resume',
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
          }
        },
        children: buildChildren(resumeEl)
      }]
    });
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadResumeDocx(resumeEl) {
    await ensureDocx();
    const blob = await global.docx.Packer.toBlob(buildDocument(resumeEl));
    saveBlob(blob, FILENAME);
  }

  global.downloadResumeDocx = downloadResumeDocx;
  global.buildResumeDocxDocument = buildDocument;
})(typeof globalThis !== 'undefined' ? globalThis : window);
