/**
 * Export helpers — Excel (SheetJS) and PDF (jsPDF + autoTable)
 */

const ExportService = {
  /**
   * Export site + devices to Excel (.xlsx)
   */
  exportExcel(site, devices) {
    const wb = XLSX.utils.book_new();

    // Site info sheet
    const siteRows = [
      ['CCTV Installation Report'],
      [],
      ['Site Name', site.name || ''],
      ['Customer', site.customer || ''],
      ['Address', site.address || ''],
      ['Contact Person', site.contactPerson || ''],
      ['Phone', site.phone || ''],
      ['Notes', site.notes || ''],
      ['Total Devices', devices.length],
      ['Export Date', new Date().toLocaleString()]
    ];
    const siteSheet = XLSX.utils.aoa_to_sheet(siteRows);
    siteSheet['!cols'] = [{ wch: 18 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, siteSheet, 'Site Info');

    // Devices sheet
    const deviceHeader = ['#', 'Device Type', 'Model', 'Serial Number', 'Installation Date', 'Remarks'];
    const deviceRows = devices.map((d, i) => [
      i + 1,
      d.deviceType || '',
      d.model || '',
      d.serialNumber || '',
      d.installationDate || '',
      d.remarks || ''
    ]);
    const deviceSheet = XLSX.utils.aoa_to_sheet([deviceHeader, ...deviceRows]);
    deviceSheet['!cols'] = [
      { wch: 4 },
      { wch: 14 },
      { wch: 20 },
      { wch: 24 },
      { wch: 16 },
      { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(wb, deviceSheet, 'Devices');

    const filename = safeFilename(site.name) + '.xlsx';
    XLSX.writeFile(wb, filename);
  },

  /**
   * Export site + devices to PDF
   */
  exportPDF(site, devices) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 14;
    let y = 18;

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('CCTV Installation Report', margin, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(site.name || 'Untitled Site', margin, y);
    y += 7;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    const info = [
      ['Customer', site.customer],
      ['Address', site.address],
      ['Contact', site.contactPerson],
      ['Phone', site.phone],
      ['Notes', site.notes]
    ];
    info.forEach(([label, value]) => {
      if (value) {
        doc.setFont(undefined, 'bold');
        doc.text(label + ':', margin, y);
        doc.setFont(undefined, 'normal');
        const lines = doc.splitTextToSize(String(value), 140);
        doc.text(lines, margin + 28, y);
        y += Math.max(6, lines.length * 5);
      }
    });

    y += 2;
    doc.setFont(undefined, 'bold');
    doc.text(`Total Devices: ${devices.length}`, margin, y);
    doc.setFont(undefined, 'normal');
    doc.text(`Exported: ${new Date().toLocaleString()}`, margin + 60, y);
    y += 6;

    const tableBody = devices.map((d, i) => [
      String(i + 1),
      d.deviceType || '',
      d.model || '',
      d.serialNumber || '',
      d.installationDate || '',
      d.remarks || ''
    ]);

    doc.autoTable({
      startY: y,
      head: [['#', 'Type', 'Model', 'Serial Number', 'Date', 'Remarks']],
      body: tableBody,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [33, 37, 41], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 22 },
        2: { cellWidth: 30 },
        3: { cellWidth: 40 },
        4: { cellWidth: 24 },
        5: { cellWidth: 'auto' }
      }
    });

    // Footer page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    }

    doc.save(safeFilename(site.name) + '.pdf');
  },

  /**
   * Open browser print dialog with a clean print layout
   */
  print(site, devices) {
    const rows = devices.map((d, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(d.deviceType)}</td>
        <td>${escapeHtml(d.model)}</td>
        <td>${escapeHtml(d.serialNumber)}</td>
        <td>${escapeHtml(d.installationDate)}</td>
        <td>${escapeHtml(d.remarks)}</td>
      </tr>
    `).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(site.name)} — Installation Report</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 16px; margin: 0 0 16px; font-weight: 600; }
    .meta { margin-bottom: 20px; font-size: 13px; line-height: 1.6; }
    .meta strong { display: inline-block; min-width: 110px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #f0f0f0; }
    .footer { margin-top: 16px; font-size: 12px; color: #555; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>CCTV Installation Report</h1>
  <h2>${escapeHtml(site.name)}</h2>
  <div class="meta">
    <div><strong>Customer:</strong> ${escapeHtml(site.customer)}</div>
    ${site.address ? `<div><strong>Address:</strong> ${escapeHtml(site.address)}</div>` : ''}
    ${site.contactPerson ? `<div><strong>Contact:</strong> ${escapeHtml(site.contactPerson)}</div>` : ''}
    ${site.phone ? `<div><strong>Phone:</strong> ${escapeHtml(site.phone)}</div>` : ''}
    ${site.notes ? `<div><strong>Notes:</strong> ${escapeHtml(site.notes)}</div>` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Device Type</th><th>Model</th>
        <th>Serial Number</th><th>Installation Date</th><th>Remarks</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="6">No devices</td></tr>'}</tbody>
  </table>
  <div class="footer">
    Total Devices: ${devices.length} &nbsp;|&nbsp; Printed: ${new Date().toLocaleString()}
  </div>
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (!w) {
      showToast('Please allow pop-ups to print', 'warning');
      return;
    }
    w.document.write(html);
    w.document.close();
  }
};
