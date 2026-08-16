/**
 * Build a text-based PDF that matches the on-screen resume design.
 */
(function (global) {
  const PDFMAKE = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.12/build/pdfmake.min.js';
  const PDFMAKE_FONTS = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.12/build/vfs_fonts.min.js';
  const FILENAME = 'Bipin-Fultariya-Senior-Full-Stack-Developer.pdf';

  const BLACK = '#111111';
  const CONTACT_BG = '#1c1c1c';
  const WASH = '#f4f4f4';
  const MUTED = '#3a3a3a';
  const FAINT = '#5a5a5a';
  const LINE = '#cccccc';
  const WHITE = '#ffffff';

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

  async function ensurePdfMake() {
    if (global.pdfMake?.createPdf) return;
    await loadScript(PDFMAKE);
    await loadScript(PDFMAKE_FONTS);
    if (global.pdfMake?.vfs && global.pdfMake?.fonts) {
      global.pdfMake.fonts = {
        Roboto: {
          normal: 'Roboto-Regular.ttf',
          bold: 'Roboto-Medium.ttf',
          italics: 'Roboto-Italic.ttf',
          bolditalics: 'Roboto-MediumItalic.ttf'
        }
      };
    }
  }

  function txt(el, fallback) {
    return (el?.textContent || fallback || '').replace(/\s+/g, ' ').trim();
  }

  function filledBar(text, fill, color, margin) {
    return {
      table: {
        widths: ['auto'],
        body: [[{
          text: (text || '').toUpperCase(),
          bold: true,
          fontSize: 8.25,
          color,
          fillColor: fill,
          characterSpacing: 1.4,
          margin: [8, 5, 8, 5]
        }]]
      },
      layout: 'noBorders',
      margin: margin || [0, 10, 0, 8]
    };
  }

  function badge(text, dark) {
    if (!text) return { text: '' };
    return {
      table: {
        widths: ['auto'],
        body: [[{
          text,
          bold: true,
          fontSize: 8,
          color: dark ? WHITE : BLACK,
          fillColor: dark ? BLACK : WASH,
          margin: [6, 4, 6, 4]
        }]]
      },
      layout: {
        hLineWidth: () => dark ? 0 : 0.6,
        vLineWidth: () => dark ? 0 : 0.6,
        hLineColor: () => LINE,
        vLineColor: () => LINE
      }
    };
  }

  function chip(text, onDark) {
    return {
      table: {
        widths: ['auto'],
        body: [[{
          text,
          bold: true,
          fontSize: 7.5,
          color: onDark ? WHITE : BLACK,
          fillColor: onDark ? BLACK : WASH,
          margin: [5, 3, 5, 3]
        }]]
      },
      layout: {
        hLineWidth: () => 0.6,
        vLineWidth: () => 0.6,
        hLineColor: () => onDark ? WHITE : LINE,
        vLineColor: () => onDark ? WHITE : LINE
      }
    };
  }

  function chipRow(items, onDark) {
    if (!items.length) return { text: '' };
    return {
      columns: items.map((item) => ({
        width: 'auto',
        ...chip(item, onDark),
        margin: [0, 0, 4, 0]
      }))
    };
  }

  function sectionTitle(text) {
    return filledBar(text, BLACK, WHITE, [0, 12, 0, 8]);
  }

  function skillRows(block) {
    return [...block.querySelectorAll('.skill-line')].map((line) => {
      const label = txt(line.querySelector('.skill-label'));
      const items = [...line.querySelectorAll('.skill-list li')].map((li) => txt(li));
      return {
        columns: [
          { width: 118, text: label.toUpperCase(), bold: true, fontSize: 8, color: BLACK, margin: [0, 4, 0, 0] },
          { width: '*', ...chipRow(items, false) }
        ],
        columnGap: 8,
        margin: [0, 0, 0, 6]
      };
    });
  }

  function accentBlock(inner) {
    return {
      table: {
        widths: [3, '*'],
        body: [[
          { text: '', fillColor: BLACK },
          { stack: inner, margin: [10, 2, 0, 6] }
        ]]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 8]
    };
  }

  function jobBlock(article) {
    const title = txt(article.querySelector('.job-title h3'));
    const company = txt(article.querySelector('.job-company'));
    const date = txt(article.querySelector('.job-date'));
    const paragraph = article.querySelector(':scope > p');
    const listItems = [...article.querySelectorAll(':scope > ul li')].map((li) => txt(li));

    const inner = [
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: title, bold: true, fontSize: 11.5, color: BLACK },
              company ? { text: company, fontSize: 9.25, color: FAINT, margin: [0, 2, 0, 0] } : {}
            ]
          },
          { width: 'auto', ...badge(date) }
        ],
        columnGap: 10,
        margin: [0, 0, 0, 6]
      }
    ];

    if (paragraph) inner.push({ text: txt(paragraph), fontSize: 9.75, color: MUTED, margin: [0, 0, 0, 4] });
    if (listItems.length) {
      inner.push({
        ul: listItems.map((item) => ({ text: item, fontSize: 9.75, color: MUTED })),
        markerColor: BLACK,
        margin: [0, 0, 0, 0]
      });
    }

    return accentBlock(inner);
  }

  function projectBlock(article) {
    const title = txt(article.querySelector('h3'));
    const date = txt(article.querySelector('.project-period'));
    const tags = [...article.querySelectorAll('.tags span')].map((s) => txt(s));
    const paragraph = txt(article.querySelector('p'));

    return accentBlock([
      {
        columns: [
          { width: '*', text: title, bold: true, fontSize: 11.5, color: BLACK },
          { width: 'auto', ...badge(date) }
        ],
        columnGap: 10,
        margin: [0, 0, 0, 4]
      },
      tags.length ? { ...chipRow(tags, false), margin: [0, 0, 0, 4] } : {},
      { text: paragraph, fontSize: 9.75, color: MUTED }
    ]);
  }

  function buildDoc(resumeEl) {
    const header = resumeEl.querySelector('.resume-header');
    const body = resumeEl.querySelector('.resume-body');

    const contact = [...header.querySelectorAll('.contact-strip li')].map((li) => {
      const label = txt(li.querySelector('.label'));
      const value = txt(li).replace(label, '').replace(/^:\s*/, '').trim();
      return { text: [{ text: label + ': ', bold: true, color: WHITE }, { text: value, color: '#e8e8e8' }] };
    });

    const stackItems = [...header.querySelectorAll('.stack-chips li')].map((li) => txt(li));
    const signalEls = [...header.querySelectorAll('.signal-row li')];

    const bodyContent = [];
    body.querySelectorAll(':scope > .section-block').forEach((block) => {
      const heading = txt(block.querySelector(':scope > h2'));
      bodyContent.push(sectionTitle(heading));

      if (heading === 'Summary' || heading === 'Profile') {
        bodyContent.push({ text: txt(block.querySelector('.profile-text')), fontSize: 10, color: MUTED, lineHeight: 1.45 });
        return;
      }

      if (heading === 'Core Skills') {
        bodyContent.push(...skillRows(block));
        return;
      }

      if (heading === 'Professional Experience') {
        block.querySelectorAll('.job').forEach((job) => bodyContent.push(jobBlock(job)));
        return;
      }

      if (heading === 'Featured Projects') {
        block.querySelectorAll('.project').forEach((project) => bodyContent.push(projectBlock(project)));
        return;
      }

      if (heading === 'Education') {
        block.querySelectorAll('.edu-row').forEach((row) => {
          const year = txt(row.querySelector('.edu-year'));
          const meta = txt(row.querySelector('.edu-meta'));
          bodyContent.push({
            columns: [
              {
                width: '*',
                stack: [
                  { text: txt(row.querySelector('.edu-degree')), bold: true, fontSize: 10.5, color: BLACK },
                  { text: txt(row.querySelector('.edu-school')), fontSize: 9.5, color: FAINT, margin: [0, 2, 0, 0] },
                  meta ? { text: meta, bold: true, fontSize: 9.25, color: BLACK, margin: [0, 3, 0, 0] } : {}
                ]
              },
              year ? { width: 'auto', ...badge(year) } : { width: 'auto', text: '' }
            ],
            columnGap: 10,
            margin: [0, 0, 0, 8]
          });
        });
      }
    });

    return {
      pageSize: 'A4',
      pageMargins: [0, 0, 0, 28],
      defaultStyle: { font: 'Roboto', fontSize: 9.5, color: BLACK, lineHeight: 1.35 },
      content: [
        {
          table: {
            widths: ['*'],
            body: [[{
              columns: [
                {
                  width: '*',
                  stack: [
                    { text: txt(header.querySelector('h1')), fontSize: 24, bold: true, color: WHITE },
                    { text: txt(header.querySelector('.role')), fontSize: 9, bold: true, color: WHITE, characterSpacing: 0.6, margin: [0, 6, 0, 0] }
                  ]
                },
                { width: 'auto', ...chipRow(stackItems, true), margin: [0, 8, 0, 0] }
              ],
              fillColor: BLACK,
              margin: [28, 20, 28, 16]
            }]]
          },
          layout: 'noBorders'
        },
        {
          table: {
            widths: contact.map(() => '*'),
            body: [contact.map((item) => ({
              ...item,
              fontSize: 8.75,
              fillColor: CONTACT_BG,
              margin: [8, 8, 8, 8]
            }))]
          },
          layout: 'noBorders'
        },
        {
          table: {
            widths: Array(signalEls.length).fill('*'),
            body: [signalEls.map((li) => {
              const strong = txt(li.querySelector('b'));
              const rest = txt(li).replace(strong, '').trim();
              return {
                stack: [
                  { text: strong, bold: true, fontSize: 10.5, color: BLACK },
                  { text: rest, fontSize: 8, color: FAINT, margin: [0, 2, 0, 0] }
                ],
                fillColor: WASH,
                margin: [12, 10, 8, 10],
                border: [true, false, false, false],
                borderColor: [BLACK, BLACK, BLACK, BLACK]
              };
            })]
          },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: (i) => (i === 0 ? 0 : 2),
            vLineColor: () => BLACK,
            paddingLeft: () => 0,
            paddingRight: () => 0,
            paddingTop: () => 0,
            paddingBottom: () => 0
          },
          margin: [0, 0, 0, 6]
        },
        {
          stack: bodyContent,
          margin: [28, 14, 28, 0]
        }
      ]
    };
  }

  async function downloadResumePdf(resumeEl) {
    await ensurePdfMake();
    const doc = buildDoc(resumeEl);
    global.pdfMake.createPdf(doc).download(FILENAME);
  }

  global.downloadResumePdf = downloadResumePdf;
})();
