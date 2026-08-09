const PdfGenerator = {
  async generateAndDownload(facturaId) {
    const factura = await Storage.get(STORES.facturas, facturaId);
    if (!factura) {
      UI.showToast('Factura no encontrada', 'error');
      return;
    }

    this.generate(factura);
  },

  generate(factura) {
    const { jsPDF } = window.jspdf;
    const config = Config.data;
    const paperSize = config.paperSize || '58mm';
    const formatWidth = paperSize === '80mm' ? 80 : 58;

    const doc = new jsPDF({ unit: 'mm', format: [formatWidth, 297] });

    const cliente = factura.cliente || { tipo: 'detal', nombre: 'Cliente Detal' };
    const margin = 5;
    const width = formatWidth - 10;
    let y = 8;

    const printText = (text, x, yPos, options = {}) => {
      const fontSize = options.fontSize || 8;
      const fontStyle = options.fontStyle || 'normal';
      const align = options.align || 'left';
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      doc.text(text, x, yPos, { align, maxWidth: width - 10 });
      return yPos + (options.lineHeight || (fontSize * 0.45));
    };

    const centerText = (text, yPos, options = {}) => {
      return printText(text, formatWidth / 2, yPos, { ...options, align: 'center' });
    };

    doc.setDrawColor(0);

    y = centerText(config.nombreComercial || 'MI NEGOCIO', y, { fontSize: 12, fontStyle: 'bold' });
    y = centerText(`RIF: ${config.rif || 'N/A'}`, y + 1, { fontSize: 7 });
    y = centerText(`Tel: ${config.telefono || ''}`, y + 1, { fontSize: 7 });
    y = centerText(config.direccion || '', y + 1, { fontSize: 7 });

    y += 3;
    doc.line(margin, y, formatWidth - margin, y);
    y += 4;

    y = centerText('FACTURA', y, { fontSize: 10, fontStyle: 'bold' });
    y += 1;

    y = printText(`Nro: ${factura.numero}`, margin, y, { fontSize: 7 });
    y = printText(`Fecha: ${Utils.formatDateTime(factura.createdAt)}`, margin, y, { fontSize: 7 });

    const clienteNombre = cliente.tipo === 'personalizado' ?
      (cliente.nombreComercial || `${cliente.nombre} ${cliente.apellido}`) : 'CLIENTE DETAL';
    y = printText(`Cliente: ${clienteNombre}`, margin, y + 1, { fontSize: 7 });

    if (cliente.rif) y = printText(`RIF: ${cliente.rif}`, margin, y, { fontSize: 7 });
    if (cliente.cedula) y = printText(`C.I.: ${cliente.cedula}`, margin, y, { fontSize: 7 });
    if (cliente.direccion) y = printText(`Dir: ${cliente.direccion}`, margin, y, { fontSize: 7 });

    y += 2;
    doc.line(margin, y, formatWidth - margin, y);
    y += 3;

    const colWidths = paperSize === '80mm' ? [30, 14, 10, 10, 16] : [22, 11, 8, 8, 11];
    const headers = ['DESC', 'PREC', 'DTO', 'CANT', 'TOTAL'];
    let x = margin;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    headers.forEach((h, i) => {
      doc.text(h, x + 1, y);
      x += colWidths[i];
    });
    y += 3;
    doc.line(margin, y, formatWidth - margin, y);
    y += 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);

    if (factura.items) {
      factura.items.forEach(item => {
        if (y > 250) {
          doc.addPage();
          y = 10;
        }

        const maxDesc = paperSize === '80mm' ? 20 : 14;
        const desc = item.descripcion.length > maxDesc ? item.descripcion.substring(0, maxDesc) + '.' : item.descripcion;
        x = margin;
        doc.text(desc, x + 1, y);
        x += colWidths[0];
        doc.text(Utils.formatCurrency(item.precio), x + 1, y);
        x += colWidths[1];
        doc.text(`${item.descuento}%`, x + 1, y);
        x += colWidths[2];
        doc.text(String(item.cantidad), x + 1, y);
        x += colWidths[3];
        doc.text(Utils.formatCurrency(item.totalPorRubro), x + 1, y);
        y += 3;
      });
    }

    y += 1;
    doc.line(margin, y, formatWidth - margin, y);
    y += 4;

    const summaryRight = formatWidth - margin - 2;

    const printSummaryLine = (label, value, options = {}) => {
      doc.setFontSize(options.fontSize || 7);
      doc.setFont('helvetica', options.fontStyle || 'normal');
      doc.text(label, margin + 2, y);
      doc.text(value, summaryRight, y, { align: 'right' });
      y += options.lineHeight || 3.5;
    };

    printSummaryLine('Subtotal:', Utils.formatCurrency(factura.subtotal));

    if (factura.descuento > 0) {
      const descMonto = factura.subtotal * factura.descuento / 100;
      printSummaryLine(`Descuento (${factura.descuento}%):`, `-${Utils.formatCurrency(descMonto)}`);
    }

    printSummaryLine('Base Imponible:', Utils.formatCurrency(factura.baseImponible));

    if (factura.iva16 > 0) printSummaryLine('IVA 16%:', Utils.formatCurrency(factura.iva16));
    if (factura.iva10 > 0) printSummaryLine('IVA 10%:', Utils.formatCurrency(factura.iva10));
    if (factura.iva16 > 0 || factura.iva10 > 0) {
      printSummaryLine('Total IVA:', Utils.formatCurrency(factura.totalIva));
    }

    y += 1;
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 3, formatWidth - 2 * margin, 7, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', margin + 2, y + 1);
    doc.text(Utils.formatCurrency(factura.total), summaryRight, y + 1, { align: 'right' });
    y += 6;

    if (factura.tasaDolar > 0) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tasa: ${Utils.formatCurrency(factura.tasaDolar)}`, margin + 2, y);
      doc.text(Utils.formatCurrencyBs(factura.total, factura.tasaDolar), summaryRight, y, { align: 'right' });
      y += 4;
    }

    if (factura.pagos && factura.pagos.length > 0) {
      y += 1;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      y = printText('Formas de Pago:', margin, y, { fontSize: 7, fontStyle: 'bold' });
      doc.setFont('helvetica', 'normal');

      const fpLabels = {
        transferencia: 'Transf.',
        pagomovil: 'Pago Móvil',
        puntodeventa: 'Punto Vta',
        efectivo: 'Efectivo',
        binance: 'Binance',
        paypal: 'PayPal',
        airtm: 'Airtm'
      };

      factura.pagos.forEach(p => {
        const label = fpLabels[p.formaPago] || p.formaPago;
        doc.text(`${label}: ${Utils.formatCurrency(p.monto)}`, margin + 2, y);
        if (p.banco) doc.text(`Bco: ${p.banco}`, margin + 2, y + 3);
        if (p.referencia) doc.text(`Ref: ${p.referencia}`, margin + 2, y + 6);
        y += (p.banco || p.referencia ? 9 : 4);
      });
    }

    y += 2;
    doc.line(margin, y, formatWidth - margin, y);
    y += 3;

    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    y = centerText('¡Gracias por su compra!', y, { fontSize: 7 });
    y = centerText(`${config.nombreComercial || ''}`, y + 1, { fontSize: 6 });
    y = centerText(`RIF: ${config.rif || ''}`, y + 1, { fontSize: 6 });
    y = centerText(Utils.formatDateTime(factura.createdAt), y + 1, { fontSize: 6 });

    this.saveWithDialog(doc, factura);
  },

  async saveWithDialog(doc, factura) {
    const cliente = factura.cliente || { tipo: 'detal', nombre: 'Cliente Detal' };
    const clienteNombre = cliente.tipo === 'personalizado' ?
      (cliente.nombreComercial || `${cliente.nombre} ${cliente.apellido}`) : 'Detal';
    const fecha = (factura.createdAt || Utils.getNow()).substring(0, 10);
    const month = fecha.substring(0, 7);
    const safeName = clienteNombre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const suggestedName = `${fecha}_${safeName}_${factura.numero}.pdf`;
    const suggestedPath = `Recibos Emitidos/${month}/${suggestedName}`;

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: suggestedName,
          types: [{
            description: 'PDF',
            accept: { 'application/pdf': ['.pdf'] }
          }]
        });
        const blob = doc.output('blob');
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        UI.showToast(`PDF guardado: ${handle.name}`, 'success');
      } catch (e) {
        if (e.name !== 'AbortError') {
          UI.showToast('Error al guardar: ' + e.message, 'error');
        }
      }
    } else {
      const fileName = suggestedName;
      doc.save(fileName);
      UI.showToast(`PDF "${fileName}" descargado. Guárdalo en: ${suggestedPath}`, 'info');
    }
  },

  async printReceipt(facturaId) {
    const factura = await Storage.get(STORES.facturas, facturaId);
    if (!factura) {
      UI.showToast('Factura no encontrada', 'error');
      return;
    }

    const config = Config.data;
    const paperSize = config.paperSize || '58mm';
    const copies = config.printCopies || 1;
    const width = paperSize === '80mm' ? '80mm' : '58mm';

    const cliente = factura.cliente || { tipo: 'detal', nombre: 'Cliente Detal' };
    const clienteNombre = cliente.tipo === 'personalizado' ?
      (cliente.nombreComercial || `${cliente.nombre} ${cliente.apellido}`) : 'CLIENTE DETAL';

    const fpLabels = {
      transferencia: 'Transf.',
      pagomovil: 'Pago Móvil',
      puntodeventa: 'Punto Vta',
      efectivo: 'Efectivo',
      binance: 'Binance',
      paypal: 'PayPal',
      airtm: 'Airtm'
    };

    let itemsHtml = '';
    if (factura.items) {
      factura.items.forEach(item => {
        itemsHtml += `<tr><td>${Utils.escapeHtml(item.descripcion)}</td><td class="right">${Utils.formatCurrency(item.totalPorRubro)}</td></tr>`;
      });
    }

    let pagosHtml = '';
    if (factura.pagos && factura.pagos.length > 0) {
      pagosHtml = '<div class="line"></div><div class="bold">Formas de Pago:</div>';
      factura.pagos.forEach(p => {
        const label = fpLabels[p.formaPago] || p.formaPago;
        pagosHtml += `<div>${label}: ${Utils.formatCurrency(p.monto)}</div>`;
        if (p.banco) pagosHtml += `<div class="small">Bco: ${p.banco}</div>`;
        if (p.referencia) pagosHtml += `<div class="small">Ref: ${p.referencia}</div>`;
      });
    }

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Factura ${factura.numero}</title>
        <style>
          @page { size: ${width} auto; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: ${width};
            padding: 3mm;
            color: #000;
            background: #fff;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .small { font-size: 10px; }
          .line { border-top: 1px dashed #000; margin: 3mm 0; }
          .right { text-align: right; }
          .total-box { background: #f0f0f0; padding: 2mm; margin: 2mm 0; font-size: 14px; font-weight: bold; text-align: right; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 1px 0; font-size: 11px; }
          .summary td { padding: 1px 0; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size:16px">${Utils.escapeHtml(config.nombreComercial || 'MI NEGOCIO')}</div>
        <div class="center small">RIF: ${Utils.escapeHtml(config.rif || 'N/A')}</div>
        <div class="center small">Tel: ${Utils.escapeHtml(config.telefono || '')}</div>
        <div class="center small">${Utils.escapeHtml(config.direccion || '')}</div>
        <div class="line"></div>
        <div class="center bold" style="font-size:14px">FACTURA</div>
        <div class="small">Nro: ${factura.numero}</div>
        <div class="small">Fecha: ${Utils.formatDateTime(factura.createdAt)}</div>
        <div class="small">Cliente: ${Utils.escapeHtml(clienteNombre)}</div>
        ${cliente.rif ? `<div class="small">RIF: ${Utils.escapeHtml(cliente.rif)}</div>` : ''}
        ${cliente.cedula ? `<div class="small">C.I.: ${Utils.escapeHtml(cliente.cedula)}</div>` : ''}
        <div class="line"></div>
        <table>${itemsHtml}</table>
        <div class="line"></div>
        <table class="summary">
          <tr><td>Subtotal:</td><td class="right">${Utils.formatCurrency(factura.subtotal)}</td></tr>
          ${factura.descuento > 0 ? `<tr><td>Descuento (${factura.descuento}%):</td><td class="right">-${Utils.formatCurrency(factura.subtotal * factura.descuento / 100)}</td></tr>` : ''}
          <tr><td>Base Imponible:</td><td class="right">${Utils.formatCurrency(factura.baseImponible)}</td></tr>
          ${factura.iva16 > 0 ? `<tr><td>IVA 16%:</td><td class="right">${Utils.formatCurrency(factura.iva16)}</td></tr>` : ''}
          ${factura.iva10 > 0 ? `<tr><td>IVA 10%:</td><td class="right">${Utils.formatCurrency(factura.iva10)}</td></tr>` : ''}
        </table>
        <div class="total-box">TOTAL: ${Utils.formatCurrency(factura.total)}</div>
        ${factura.tasaDolar > 0 ? `<div class="small right">Tasa: ${Utils.formatCurrency(factura.tasaDolar)} | ${Utils.formatCurrencyBs(factura.total, factura.tasaDolar)}</div>` : ''}
        ${pagosHtml}
        <div class="line"></div>
        <div class="center small">¡Gracias por su compra!</div>
        <div class="center small">${Utils.escapeHtml(config.nombreComercial || '')}</div>
        <div class="center small">RIF: ${Utils.escapeHtml(config.rif || '')}</div>
        <script>
          window.onload = function() {
            let count = 0;
            const maxCopies = ${copies};
            function printNext() {
              if (count < maxCopies) {
                count++;
                if (count < maxCopies) {
                  window.print();
                  setTimeout(printNext, 500);
                } else {
                  window.print();
                  setTimeout(function() { window.close(); }, 1000);
                }
              }
            }
            printNext();
          };
        <\/script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', `width=300,height=600`);
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      UI.showToast(`Imprimiendo ${copies} copia(s)...`, 'info');
    } else {
      UI.showToast('Bloqueado por el navegador. Permite popups para imprimir.', 'warning');
    }
  }
};
