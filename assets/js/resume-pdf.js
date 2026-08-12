/**
 * Build a text-based ATS-friendly PDF from #resume using pdfMake.
 */
(function (global) {
  const PDFMAKE = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.12/build/pdfmake.min.js';
  const PDFMAKE_FONTS = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.12/build/vfs_fonts.min.js';
  const FILENAME = 'Bipin-Fultariya-Senior-Web-Developer.pdf';

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

  function sectionTitle(text) {
    return {
      text: text.toUpperCase(),
      style: 'sectionTitle',
      margin: [0, 10, 0, 4]
    };
  }

  function skillSection(block) {
    const title = block.querySelector('h2');
    const items = [...block.querySelectorAll('.skill-list li')].map((li) => txt(li));
    if (!items.length) return null;
    return {
      stack: [
        sectionTitle(txt(title)),
        { ul: items, style: 'list', margin: [0, 0, 0, 2] }
      ]
    };
  }

  function jobBlock(article) {
    const title = txt(article.querySelector('.job-title h3'));
    const company = txt(article.querySelector('.job-company'));
    const date = txt(article.querySelector('.job-date'));
    const paragraph = article.querySelector(':scope > p');
    const listItems = [...article.querySelectorAll(':scope > ul li')].map((li) => txt(li));

    const stack = [
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: title, style: 'jobTitle' },
              company ? { text: company, style: 'subtle' } : {}
            ]
          },
          { width: 'auto', text: date, style: 'date', alignment: 'right' }
        ],
        columnGap: 8,
        margin: [0, 0, 0, 3]
      }
    ];

    if (paragraph) stack.push({ text: txt(paragraph), style: 'body', margin: [0, 0, 0, 4] });
    if (listItems.length) stack.push({ ul: listItems, style: 'list' });

    return { stack, margin: [0, 0, 0, 8], unbreakable: false };
  }

  function projectBlock(article) {
    const title = txt(article.querySelector('h3'));
    const date = txt(article.querySelector('.project-period'));
    const tags = [...article.querySelectorAll('.tags span')].map((s) => txt(s)).join('  ·  ');
    const paragraph = txt(article.querySelector('p'));

    return {
      stack: [
        {
          columns: [
            { width: '*', text: title, style: 'jobTitle' },
            { width: 'auto', text: date, style: 'date', alignment: 'right' }
          ],
          columnGap: 8,
          margin: [0, 0, 0, 2]
        },
        tags ? { text: tags, style: 'tags', margin: [0, 0, 0, 3] } : {},
        { text: paragraph, style: 'body' }
      ],
      margin: [0, 0, 0, 8]
    };
  }

  function buildDoc(resumeEl) {
    const header = resumeEl.querySelector('.resume-header');
    const sidebar = resumeEl.querySelector('.sidebar');
    const content = resumeEl.querySelector('.content');
    const projectsSection = resumeEl.querySelector('.section-full');

    const contact = [...header.querySelectorAll('.contact-strip li')].map((li) => {
      const label = txt(li.querySelector('.label'));
      const value = txt(li).replace(label, '').replace(/^:\s*/, '').trim();
      return label + ': ' + value;
    });

    const sidebarStack = [];
    sidebar.querySelectorAll('.skill-group').forEach((block) => {
      const part = skillSection(block);
      if (part) sidebarStack.push(part);
    });

    const eduBlock = sidebar.querySelector('.section-block:not(.skill-group)');
    if (eduBlock) {
      sidebarStack.push({
        stack: [
          sectionTitle(txt(eduBlock.querySelector('h2'))),
          { text: txt(eduBlock.querySelector('.edu-degree')), style: 'boldLine', margin: [0, 0, 0, 2] },
          { text: txt(eduBlock.querySelector('.edu-school')), style: 'subtle' },
          { text: txt(eduBlock.querySelector('.edu-year')), style: 'subtle' }
        ]
      });
    }

    const mainStack = [];
    content.querySelectorAll('.section-block').forEach((block) => {
      const heading = txt(block.querySelector(':scope > h2'));
      if (heading === 'Profile') {
        mainStack.push(sectionTitle(heading));
        mainStack.push({ text: txt(block.querySelector('.profile-text')), style: 'body', margin: [0, 0, 0, 4] });
        return;
      }
      if (heading === 'Professional Experience') {
        mainStack.push(sectionTitle(heading));
        block.querySelectorAll('.job').forEach((job) => mainStack.push(jobBlock(job)));
      }
    });

    const projectsStack = [];
    if (projectsSection) {
      projectsStack.push(sectionTitle(txt(projectsSection.querySelector('h2'))));
      projectsSection.querySelectorAll('.project').forEach((project) => {
        projectsStack.push(projectBlock(project));
      });
    }

    const bodyContent = [
      {
        columns: [
          { width: 165, stack: sidebarStack },
          { width: '*', stack: mainStack, margin: [14, 0, 0, 0] }
        ],
        columnGap: 12
      }
    ];

    if (projectsStack.length) {
      bodyContent.push({
        stack: projectsStack,
        margin: [0, 12, 0, 0]
      });
    }

    return {
      pageSize: 'A4',
      pageMargins: [42, 42, 42, 42],
      defaultStyle: { font: 'Roboto', fontSize: 9.5, color: '#222222', lineHeight: 1.35 },
      content: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 511, y2: 0, lineWidth: 2, lineColor: '#000000' }], margin: [0, 0, 0, 10] },
        { text: txt(header.querySelector('h1')), style: 'name', alignment: 'center' },
        { text: txt(header.querySelector('.role')).toUpperCase(), style: 'role', alignment: 'center', margin: [0, 2, 0, 0] },
        { text: txt(header.querySelector('.stack')), style: 'stack', alignment: 'center', margin: [0, 4, 0, 8] },
        { text: contact.join('    |    '), style: 'contact', alignment: 'center', margin: [0, 0, 0, 10] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 511, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 0, 0, 8] },
        ...bodyContent
      ],
      styles: {
        name: { fontSize: 22, bold: true, color: '#000000' },
        role: { fontSize: 10, bold: true, color: '#000000', characterSpacing: 0.8 },
        stack: { fontSize: 9.5, color: '#444444' },
        contact: { fontSize: 9, color: '#444444' },
        sectionTitle: { fontSize: 8.5, bold: true, color: '#000000', characterSpacing: 0.6 },
        jobTitle: { fontSize: 10.5, bold: true, color: '#000000' },
        date: { fontSize: 9, color: '#000000' },
        body: { fontSize: 9.5, color: '#333333' },
        subtle: { fontSize: 9, color: '#555555' },
        boldLine: { fontSize: 9.5, bold: true, color: '#000000' },
        list: { fontSize: 9, color: '#333333', margin: [0, 2, 0, 4] },
        tags: { fontSize: 8, color: '#000000', characterSpacing: 0.3 }
      }
    };
  }

  async function downloadResumePdf(resumeEl) {
    await ensurePdfMake();
    const doc = buildDoc(resumeEl);
    global.pdfMake.createPdf(doc).download(FILENAME);
  }

  global.downloadResumePdf = downloadResumePdf;
})();
