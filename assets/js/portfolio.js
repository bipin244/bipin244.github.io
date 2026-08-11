(function () {
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

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
    const opt = {
      margin: [8, 8, 8, 8],
      filename: 'Bipin-Fultariya-Senior-Web-Developer.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
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
    setTimeout(downloadPdf, 500);
  }
})();
