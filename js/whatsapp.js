const WhatsAppShare = {
  async share(facturaId) {
    const factura = await Storage.get(STORES.facturas, facturaId);
    if (!factura) {
      UI.showToast('Factura no encontrada', 'error');
      return;
    }

    const config = Config.data;
    const cliente = factura.cliente || { tipo: 'detal', nombre: 'Cliente Detal' };
    const clienteNombre = cliente.tipo === 'personalizado' ?
      (cliente.nombreComercial || `${cliente.nombre} ${cliente.apellido}`) : 'Cliente Detal';

    let message = `📄 *Factura #${factura.numero}*\n`;
    message += `📅 ${Utils.formatDateTime(factura.createdAt)}\n`;
    message += `👤 ${clienteNombre}\n`;
    message += `\n--- DETALLE ---\n`;

    if (factura.items) {
      factura.items.forEach(item => {
        message += `• ${item.descripcion} x${item.cantidad} = ${Utils.formatCurrency(item.totalPorRubro)}\n`;
      });
    }

    message += `\n--- RESUMEN ---\n`;
    message += `Subtotal: ${Utils.formatCurrency(factura.subtotal)}\n`;

    if (factura.descuento > 0) {
      message += `Descuento (${factura.descuento}%): -${Utils.formatCurrency(factura.subtotal * factura.descuento / 100)}\n`;
    }

    message += `Base Imponible: ${Utils.formatCurrency(factura.baseImponible)}\n`;

    if (factura.iva16 > 0) message += `IVA 16%: ${Utils.formatCurrency(factura.iva16)}\n`;
    if (factura.iva10 > 0) message += `IVA 10%: ${Utils.formatCurrency(factura.iva10)}\n`;

    message += `\n💰 *TOTAL: ${Utils.formatCurrency(factura.total)}*\n`;

    if (factura.tasaDolar > 0) {
      message += `Bs: ${Utils.formatCurrencyBs(factura.total, factura.tasaDolar)}\n`;
    }

    if (factura.pagos && factura.pagos.length > 0) {
      message += `\n--- PAGOS ---\n`;
      const fpLabels = {
        transferencia: 'Transferencia',
        pagomovil: 'Pago Móvil',
        puntodeventa: 'Punto de Venta',
        efectivo: 'Efectivo',
        binance: 'Binance',
        paypal: 'PayPal',
        airtm: 'Airtm'
      };
      factura.pagos.forEach(p => {
        message += `• ${fpLabels[p.formaPago] || p.formaPago}: ${Utils.formatCurrency(p.monto)}`;
        if (p.referencia) message += ` (Ref: ${p.referencia})`;
        message += '\n';
      });
    }

    message += `\n_${config.nombreComercial || 'Punto de Venta'}_`;

    const encodedMessage = encodeURIComponent(message);

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: [80, 297] });

      const margin = 5;
      const width = 70;
      let y = 8;

      const centerText = (text, yPos, options = {}) => {
        const fontSize = options.fontSize || 8;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', options.fontStyle || 'normal');
        doc.text(text, 40, yPos, { align: 'center', maxWidth: width - 10 });
        return yPos + (fontSize * 0.45);
      };

      const printText = (text, xPos, yPos, options = {}) => {
        doc.setFontSize(options.fontSize || 7);
        doc.setFont('helvetica', options.fontStyle || 'normal');
        doc.text(text, xPos, yPos, { maxWidth: width - 10 });
        return yPos + (options.lineHeight || 3.5);
      };

      y = centerText(config.nombreComercial || 'MI NEGOCIO', y, { fontSize: 12, fontStyle: 'bold' });
      y = centerText(`RIF: ${config.rif || 'N/A'}`, y + 1, { fontSize: 7 });
      y = centerText(`Tel: ${config.telefono || ''}`, y + 1, { fontSize: 7 });

      y += 3;
      doc.line(margin, y, width - margin, y);
      y += 4;

      y = centerText(`FACTURA #${factura.numero}`, y, { fontSize: 10, fontStyle: 'bold' });
      y = printText(`Fecha: ${Utils.formatDateTime(factura.createdAt)}`, margin, y + 1);
      y = printText(`Cliente: ${clienteNombre}`, margin, y + 1);

      y += 1;
      doc.line(margin, y, width - margin, y);
      y += 3;

      if (factura.items) {
        factura.items.forEach(item => {
          const desc = item.descripcion.length > 20 ? item.descripcion.substring(0, 20) + '.' : item.descripcion;
          y = printText(`${desc} x${item.cantidad}`, margin, y, { fontSize: 6 });
          y = printText(`  ${Utils.formatCurrency(item.totalPorRubro)}`, margin, y, { fontSize: 6 });
        });
      }

      y += 1;
      doc.line(margin, y, width - margin, y);
      y += 3;

      y = printText(`Subtotal: ${Utils.formatCurrency(factura.subtotal)}`, margin, y);
      if (factura.descuento > 0) {
        y = printText(`Descuento: -${Utils.formatCurrency(factura.subtotal * factura.descuento / 100)}`, margin, y);
      }
      y = printText(`Base Imp: ${Utils.formatCurrency(factura.baseImponible)}`, margin, y);
      if (factura.iva16 > 0) y = printText(`IVA 16%: ${Utils.formatCurrency(factura.iva16)}`, margin, y);
      if (factura.iva10 > 0) y = printText(`IVA 10%: ${Utils.formatCurrency(factura.iva10)}`, margin, y);

      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 2, width - 2 * margin, 6, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL:', margin + 2, y + 2);
      doc.text(Utils.formatCurrency(factura.total), width - margin - 2, y + 2, { align: 'right' });
      y += 5;

      y += 2;
      doc.line(margin, y, width - margin, y);
      y += 3;

      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      y = centerText('¡Gracias por su compra!', y, { fontSize: 7 });
      y = centerText(config.nombreComercial || '', y + 1, { fontSize: 6 });

      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], `Factura_${factura.numero}.pdf`, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: `Factura #${factura.numero}`,
          text: message,
          files: [pdfFile]
        });
        UI.showToast('Compartido exitosamente', 'success');
      } else if (navigator.userAgent.includes('WhatsApp') || /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        const blobUrl = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `Factura_${factura.numero}.pdf`;
        a.click();
        URL.revokeObjectURL(blobUrl);

        const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
        UI.showToast('PDF descargado. Adjúntalo en WhatsApp.', 'info');
      } else {
        const blobUrl = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `Factura_${factura.numero}.pdf`;
        a.click();
        URL.revokeObjectURL(blobUrl);

        const whatsappUrl = `https://web.whatsapp.com/send?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
        UI.showToast('PDF descargado. Adjúntalo en WhatsApp Web.', 'info');
      }
    } catch (e) {
      console.error('Error sharing:', e);
      UI.showToast('Error al compartir: ' + e.message, 'error');
    }
  }
};
