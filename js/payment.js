const Payment = {
  selectedMethods: [],

  showPaymentModal(invoice) {
    this.selectedMethods = [];
    this.invoice = invoice;

    const formaPagoLabels = {
      transferencia: 'Transferencia',
      pagomovil: 'Pago Móvil',
      puntodeventa: 'Punto de Venta',
      efectivo: 'Efectivo $',
      binance: 'Binance',
      paypal: 'PayPal',
      airtm: 'Airtm'
    };

    const formaPagoIcons = {
      transferencia: '🏦',
      pagomovil: '📱',
      puntodeventa: '💳',
      efectivo: '💵',
      binance: '₿',
      paypal: '🅿️',
      airtm: '🌐'
    };

    let methodsHtml = '';
    Object.entries(formaPagoLabels).forEach(([key, label]) => {
      methodsHtml += `
        <div class="payment-method-card" onclick="Payment.toggleMethod('${key}')" id="pm-${key}">
          <div class="icon">${formaPagoIcons[key]}</div>
          <div class="name">${label}</div>
        </div>`;
    });

    const content = `
      <div class="invoice-summary mb-4">
        <div class="row total"><span>Total a Pagar:</span><span>${Utils.formatCurrency(invoice.total)}</span></div>
        ${invoice.tasaDolar > 0 ? `<div class="row subtotal"><span>En Bs:</span><span>${Utils.formatCurrencyBs(invoice.total, invoice.tasaDolar)}</span></div>` : ''}
      </div>

      <h4 class="mb-3">Selecciona la(s) forma(s) de pago:</h4>
      <div class="payment-methods mb-4">${methodsHtml}</div>

      <div id="paymentForms"></div>

      <div class="invoice-summary mt-4" id="paymentSummary" style="display:none">
        <h4 class="mb-2">Resumen de Pagos</h4>
        <div id="paymentSummaryContent"></div>
      </div>
    `;

    UI.showModal('Procesar Pago', content, {
      size: 'lg',
      confirmText: '✓ Confirmar Pago',
      onConfirm: () => this.processPayment()
    });
  },

  toggleMethod(method) {
    const card = document.getElementById(`pm-${method}`);
    if (!card) return;

    const idx = this.selectedMethods.indexOf(method);
    if (idx >= 0) {
      this.selectedMethods.splice(idx, 1);
      card.classList.remove('selected');
    } else {
      this.selectedMethods.push(method);
      card.classList.add('selected');
    }
    this.renderPaymentForms();
  },

  renderPaymentForms() {
    const container = document.getElementById('paymentForms');
    if (!container) return;

    const remaining = this.invoice.total - this.selectedMethods.reduce((sum, m) => {
      const input = document.getElementById(`pay-monto-${m}`);
      return sum + (input ? parseFloat(input.value) || 0 : 0);
    }, 0);

    let html = '';
    this.selectedMethods.forEach((method, idx) => {
      const isLast = idx === this.selectedMethods.length - 1;
      const monto = isLast ? Math.max(0, remaining) : 0;

      html += this.getPaymentForm(method, monto);
    });

    container.innerHTML = html;
    this.updateSummary();
  },

  getPaymentForm(method, defaultMonto) {
    const labels = {
      transferencia: 'Transferencia Bancaria',
      pagomovil: 'Pago Móvil',
      puntodeventa: 'Punto de Venta',
      efectivo: 'Efectivo',
      binance: 'Binance',
      paypal: 'PayPal',
      airtm: 'Airtm'
    };

    let specificFields = '';

    if (method !== 'efectivo') {
      specificFields = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Banco</label>
            <select class="form-control" id="pay-banco-${method}">
              <option value="">Seleccionar banco...</option>
              <option value="0102">Banco de Venezuela</option>
              <option value="0104">Banco Venezolano de Crédito</option>
              <option value="0105">Banco Mercantil</option>
              <option value="0108">Banco Provincial</option>
              <option value="0114">Bancaribe</option>
              <option value="0116">Banco Plaza</option>
              <option value="0128">Banco Bonanza</option>
              <option value="0134">Banco Nacional de Crédito</option>
              <option value="0151">BFC Banco Fondo Común</option>
              <option value="0156">100% Banco</option>
              <option value="0157">Banco Exterior</option>
              <option value="0163">Banco del Tesoro</option>
              <option value="0166">Banco Agrícola</option>
              <option value="0168">Banco Bancrecer</option>
              <option value="0169">Mi Banco</option>
              <option value="0171">Banco Digital de los Trabajadores</option>
              <option value="0172">Bancamiga</option>
              <option value="0173">Banco Internacional</option>
              <option value="0174">Banco del Sur</option>
              <option value="0175">Banco Bicentenario</option>
              <option value="0177">Banco Fanb</option>
              <option value="0178">N58 Banco Digital</option>
              <option value="0191">Banco Nacional de Crédito</option>
              <option value="crypto">Crypto (Binance/PayPal/Airtm)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Referencia / Nro. Operación</label>
            <input type="text" class="form-control" id="pay-ref-${method}" placeholder="Número de referencia">
          </div>
        </div>
      `;
    }

    return `
      <div class="card mb-3" style="border-left:3px solid var(--primary)">
        <div class="card-body">
          <h4 class="mb-3">${labels[method]}</h4>
          ${specificFields}
          <div class="form-group">
            <label class="form-label">Monto ($)</label>
            <input type="number" class="form-control" id="pay-monto-${method}" step="0.01" min="0"
              value="${defaultMonto > 0 ? defaultMonto.toFixed(2) : ''}"
              onchange="Payment.updateSummary()" oninput="Payment.updateSummary()">
          </div>
        </div>
      </div>
    `;
  },

  updateSummary() {
    const container = document.getElementById('paymentSummary');
    const content = document.getElementById('paymentSummaryContent');
    if (!container || !content) return;

    if (this.selectedMethods.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    let totalPaid = 0;
    let html = '';

    const labels = {
      transferencia: 'Transferencia',
      pagomovil: 'Pago Móvil',
      puntodeventa: 'Punto de Venta',
      efectivo: 'Efectivo $',
      binance: 'Binance',
      paypal: 'PayPal',
      airtm: 'Airtm'
    };

    this.selectedMethods.forEach(method => {
      const monto = parseFloat(document.getElementById(`pay-monto-${method}`)?.value) || 0;
      totalPaid += monto;
      html += `
        <div class="row subtotal">
          <span>${labels[method]}</span>
          <span>${Utils.formatCurrency(monto)}</span>
        </div>`;
    });

    const diff = totalPaid - this.invoice.total;
    html += `<div class="row total"><span>Total Pagado:</span><span>${Utils.formatCurrency(totalPaid)}</span></div>`;
    html += `<div class="row ${diff >= 0 ? '' : 'text-danger'}">
      <span>${diff >= 0 ? 'Cambio:' : 'Falta:'}</span>
      <span>${Utils.formatCurrency(Math.abs(diff))}</span>
    </div>`;

    content.innerHTML = html;
  },

  async processPayment() {
    if (this.selectedMethods.length === 0) {
      UI.showToast('Selecciona al menos una forma de pago', 'error');
      return;
    }

    const pagos = [];
    let totalPaid = 0;

    for (const method of this.selectedMethods) {
      const monto = parseFloat(document.getElementById(`pay-monto-${method}`)?.value) || 0;
      if (monto <= 0) {
        UI.showToast(`Ingresa un monto válido para ${method}`, 'error');
        return;
      }

      const banco = document.getElementById(`pay-banco-${method}`)?.value || '';
      const referencia = document.getElementById(`pay-ref-${method}`)?.value || '';

      if (method !== 'efectivo' && !banco) {
        UI.showToast(`Selecciona el banco para ${method}`, 'error');
        return;
      }

      pagos.push({
        id: Utils.generateId(),
        formaPago: method,
        banco,
        referencia,
        monto,
        montoDolares: monto,
        fecha: Utils.getNow()
      });

      totalPaid += monto;
    }

    if (totalPaid < this.invoice.total) {
      UI.showToast('El monto total es menor que el total de la factura', 'error');
      return;
    }

    this.invoice.pagos = pagos;
    this.invoice.totalPagado = totalPaid;
    this.invoice.cambio = totalPaid - this.invoice.total;

    try {
      await Invoice.save('pagada');
      UI.closeModal();

      const cambio = this.invoice.cambio;
      if (cambio > 0) {
        UI.showToast(`Pago confirmado. Cambio: ${Utils.formatCurrency(cambio)}`, 'success');
      } else {
        UI.showToast('Pago confirmado y factura guardada', 'success');
      }

      // Auto-print if enabled
      if (Config.get('autoPrint')) {
        setTimeout(() => {
          PdfGenerator.printReceipt(this.invoice.id);
        }, 500);
      }

      Invoice.renderFacturaEditor();
      setTimeout(() => Invoice.cancelEdit(), 1500);
    } catch (e) {
      UI.showToast('Error al guardar: ' + e.message, 'error');
    }
  }
};
