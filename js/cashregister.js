const CashRegister = {
  currentCaja: null,

  async load() {
    this.currentCaja = await Storage.getOpenCaja();
    UI.renderCashStatus(this.currentCaja);
  },

  async open(data) {
    if (this.currentCaja) {
      throw new Error('Ya hay una caja abierta. Ciérrala primero.');
    }

    const caja = {
      id: Utils.generateId(),
      fecha: Utils.getToday(),
      montoApertura: parseFloat(data.montoApertura) || 0,
      montoCierre: 0,
      montoEsperado: 0,
      diferencia: 0,
      estado: 'abierta',
      operador: data.operador || 'Admin',
      aperturaEn: Utils.getNow(),
      cierreEn: '',
      observaciones: data.observaciones || ''
    };

    await Storage.add(STORES.caja, caja);
    this.currentCaja = caja;
    UI.renderCashStatus(caja);
    return caja;
  },

  async close(montoCierre, observaciones) {
    if (!this.currentCaja) {
      throw new Error('No hay caja abierta');
    }

    const facturas = await Storage.getFacturasByDate(Utils.getToday());
    const pagosHoy = [];
    for (const f of facturas) {
      if (f.pagos) {
        f.pagos.forEach(p => pagosHoy.push(p));
      }
    }

    const efectivoEntradas = pagosHoy
      .filter(p => p.formaPago === 'efectivo')
      .reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);

    const montoEsperado = this.currentCaja.montoApertura + efectivoEntradas;

    this.currentCaja.montoCierre = parseFloat(montoCierre) || 0;
    this.currentCaja.montoEsperado = montoEsperado;
    this.currentCaja.diferencia = this.currentCaja.montoCierre - montoEsperado;
    this.currentCaja.estado = 'cerrada';
    this.currentCaja.cierreEn = Utils.getNow();
    this.currentCaja.observaciones = observaciones || '';

    await Storage.update(STORES.caja, this.currentCaja);
    const closed = { ...this.currentCaja };
    this.currentCaja = null;
    UI.renderCashStatus(null);
    return closed;
  },

  isOpen() {
    return this.currentCaja !== null && this.currentCaja.estado === 'abierta';
  },

  checkBusinessHours() {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);

    const diasLaborables = Config.get('diasLaborables') || [1, 2, 3, 4, 5, 6];
    const horaApertura = Config.get('horaApertura') || '08:00';
    const horaCierre = Config.get('horaCierre') || '18:00';

    if (!diasLaborables.includes(currentDay)) {
      return { open: false, reason: 'day' };
    }

    if (currentTime < horaApertura || currentTime > horaCierre) {
      return { open: false, reason: 'hours' };
    }

    return { open: true, reason: null };
  },

  showOpenModal() {
    if (this.currentCaja) {
      UI.showToast('Ya hay una caja abierta. Ciérrala primero.', 'warning');
      return;
    }

    const hoursCheck = this.checkBusinessHours();
    if (!hoursCheck.open) {
      const diasLaborables = Config.get('diasLaborables') || [1, 2, 3, 4, 5, 6];
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const openDays = diasLaborables.map(d => dayNames[d]).join(', ');

      if (hoursCheck.reason === 'day') {
        UI.showToast(`Hoy no es día laborable. Días: ${openDays}`, 'error');
      } else {
        const horaApertura = Config.get('horaApertura') || '08:00';
        const horaCierre = Config.get('horaCierre') || '18:00';
        UI.showToast(`Fuera de horario. Horario: ${horaApertura} - ${horaCierre}`, 'error');
      }
      return;
    }
    const content = `
      <form id="openCashForm">
        <div class="alert alert-info">
          <span>ℹ️</span> Ingresa el monto inicial de la caja y la tasa del dólar del día.
        </div>
        <div class="form-group">
          <label class="form-label">Monto de Apertura ($) <span class="required">*</span></label>
          <input type="number" class="form-control" name="montoApertura" step="0.01" min="0" required autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Tasa del Dólar del Día ($)</label>
          <input type="number" class="form-control" id="cashTasaDolar" step="0.01" min="0" value="${Config.get('tasaDolar') || ''}">
          <div class="form-hint">Se actualizará en la configuración</div>
        </div>
        <div class="form-group">
          <label class="form-label">Operador</label>
          <input type="text" class="form-control" name="operador" value="Admin">
        </div>
        <div class="form-group">
          <label class="form-label">Observaciones</label>
          <textarea class="form-control" name="observaciones" rows="2"></textarea>
        </div>
      </form>
    `;

    UI.showModal('Abrir Caja', content, {
      confirmText: 'Abrir Caja',
      onConfirm: async () => {
        const data = UI.getFormData('openCashForm');
        if (!data.montoApertura && data.montoApertura !== 0) {
          UI.showToast('Ingresa el monto de apertura', 'error');
          return;
        }
        const tasa = parseFloat(document.getElementById('cashTasaDolar').value) || 0;
        if (tasa > 0) {
          await Config.save({ tasaDolar: tasa });
        }
        try {
          await CashRegister.open(data);
          UI.showToast('Caja abierta exitosamente', 'success');
          UI.closeModal();
        } catch (e) {
          UI.showToast(e.message, 'error');
        }
      }
    });
  },

  async showCloseModal() {
    if (!this.currentCaja) {
      UI.showToast('No hay caja abierta', 'warning');
      return;
    }

    const facturas = await Storage.getFacturasByDate(Utils.getToday());
    let totalVentas = 0;
    let totalEfectivo = 0;
    let totalOtros = 0;
    let countVentas = facturas.filter(f => f.estado === 'pagada').length;

    facturas.filter(f => f.estado === 'pagada').forEach(f => {
      totalVentas += f.total || 0;
      if (f.pagos) {
        f.pagos.forEach(p => {
          if (p.formaPago === 'efectivo') totalEfectivo += parseFloat(p.monto) || 0;
          else totalOtros += parseFloat(p.monto) || 0;
        });
      }
    });

    const montoEsperado = this.currentCaja.montoApertura + totalEfectivo;

    const content = `
      <div class="invoice-summary mb-4">
        <h4 class="mb-3">Resumen del Día</h4>
        <div class="row subtotal"><span>Monto de Apertura:</span><span>${Utils.formatCurrency(this.currentCaja.montoApertura)}</span></div>
        <div class="row subtotal"><span>Ventas Totales (${countVentas} facturas):</span><span>${Utils.formatCurrency(totalVentas)}</span></div>
        <div class="row subtotal"><span>Pagos en Efectivo:</span><span>${Utils.formatCurrency(totalEfectivo)}</span></div>
        <div class="row subtotal"><span>Otras Formas de Pago:</span><span>${Utils.formatCurrency(totalOtros)}</span></div>
        <div class="row"><span>Monto Esperado en Caja:</span><span class="font-bold">${Utils.formatCurrency(montoEsperado)}</span></div>
      </div>
      <form id="closeCashForm">
        <div class="form-group">
          <label class="form-label">Monto a Contar en Caja ($) <span class="required">*</span></label>
          <input type="number" class="form-control" name="montoCierre" step="0.01" min="0" required autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Observaciones</label>
          <textarea class="form-control" name="observaciones" rows="2"></textarea>
        </div>
      </form>
    `;

    UI.showModal('Cerrar Caja', content, {
      confirmText: 'Cerrar Caja',
      onConfirm: async () => {
        const data = UI.getFormData('closeCashForm');
        if (!data.montoCierre && data.montoCierre !== 0) {
          UI.showToast('Ingresa el monto contado', 'error');
          return;
        }
        try {
          const closed = await CashRegister.close(data.montoCierre, data.observaciones);
          const diffText = closed.diferencia === 0 ? 'Cuadra perfecto' :
            (closed.diferencia > 0 ? `Sobrante: ${Utils.formatCurrency(closed.diferencia)}` :
            `Faltante: ${Utils.formatCurrency(Math.abs(closed.diferencia))}`);
          UI.showToast(`Caja cerrada. ${diffText}`, closed.diferencia === 0 ? 'success' : 'warning');
          UI.closeModal();
        } catch (e) {
          UI.showToast(e.message, 'error');
        }
      }
    });
  },

  async renderPage() {
    await this.load();
    const container = document.getElementById('cashregisterContent');
    if (!container) return;

    const isOpen = this.isOpen();
    const today = Utils.getToday();
    const facturas = await Storage.getFacturasByDate(today);
    const pagosHoy = [];
    facturas.filter(f => f.estado === 'pagada').forEach(f => {
      if (f.pagos) f.pagos.forEach(p => pagosHoy.push({ ...p, facturaNumero: f.numero }));
    });

    let resumenPagos = {};
    pagosHoy.forEach(p => {
      if (!resumenPagos[p.formaPago]) resumenPagos[p.formaPago] = 0;
      resumenPagos[p.formaPago] += parseFloat(p.monto) || 0;
    });

    const formaPagoLabels = {
      transferencia: 'Transferencia',
      pagomovil: 'Pago Móvil',
      puntodeventa: 'Punto de Venta',
      efectivo: 'Efectivo $',
      binance: 'Binance',
      paypal: 'PayPal',
      airtm: 'Airtm'
    };

    container.innerHTML = `
      <div class="grid grid-4 mb-4" id="cashStats">
        <div class="stat-card">
          <div class="stat-icon ${isOpen ? 'green' : 'red'}">●</div>
          <div class="stat-info">
            <h3>${isOpen ? 'Abierta' : 'Cerrada'}</h3>
            <p>Estado de Caja</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue">💰</div>
          <div class="stat-info">
            <h3>${isOpen ? Utils.formatCurrency(this.currentCaja.montoApertura) : '$0.00'}</h3>
            <p>Monto Apertura</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">📋</div>
          <div class="stat-info">
            <h3>${facturas.filter(f => f.estado === 'pagada').length}</h3>
            <p>Ventas del Día</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon yellow">💵</div>
          <div class="stat-info">
            <h3>${Utils.formatCurrency(facturas.filter(f => f.estado === 'pagada').reduce((s, f) => s + (f.total || 0), 0))}</h3>
            <p>Total Ventas</p>
          </div>
        </div>
      </div>

      <div class="flex gap-2 mb-4">
        ${isOpen ?
          `<button class="btn btn-danger" onclick="CashRegister.showCloseModal()">🔒 Cerrar Caja</button>` :
          (() => {
            const hoursCheck = this.checkBusinessHours();
            if (!hoursCheck.open) {
              const diasLaborables = Config.get('diasLaborables') || [1, 2, 3, 4, 5, 6];
              const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
              const openDays = diasLaborables.map(d => dayNames[d]).join(', ');
              const horaApertura = Config.get('horaApertura') || '08:00';
              const horaCierre = Config.get('horaCierre') || '18:00';

              if (hoursCheck.reason === 'day') {
                return `<div class="alert alert-warning flex items-center gap-2"><span>⚠️</span><div><strong>Caja cerrada</strong> — Hoy no es día laborable. Días: ${openDays}</div></div>`;
              } else {
                return `<div class="alert alert-warning flex items-center gap-2"><span>⏰</span><div><strong>Caja cerrada</strong> — Fuera de horario. Horario: ${horaApertura} - ${horaCierre}</div></div>`;
              }
            }
            return `<button class="btn btn-success" onclick="CashRegister.showOpenModal()">🔓 Abrir Caja</button>`;
          })()
        }
      </div>

      ${Object.keys(resumenPagos).length > 0 ? `
        <div class="card">
          <div class="card-header"><h3>Resumen de Pagos por Forma</h3></div>
          <div class="card-body">
            <div class="table-wrapper">
              <table class="table">
                <thead><tr><th>Forma de Pago</th><th class="text-right">Monto</th></tr></thead>
                <tbody>
                  ${Object.entries(resumenPagos).map(([key, val]) => `
                    <tr>
                      <td>${formaPagoLabels[key] || key}</td>
                      <td class="text-right font-bold">${Utils.formatCurrency(val)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ` : ''}

      ${facturas.length > 0 ? `
        <div class="card mt-4">
          <div class="card-header"><h3>Facturas de Hoy</h3></div>
          <div class="card-body">
            <div class="table-wrapper">
              <table class="table">
                <thead><tr><th>#</th><th>Cliente</th><th class="text-right">Total</th><th>Estado</th><th>Hora</th></tr></thead>
                <tbody>
                  ${facturas.map(f => `
                    <tr>
                      <td class="font-bold">${f.numero}</td>
                      <td>${f.cliente ? UI.escapeHtml(f.cliente.nombre || 'Cliente Detal') : 'Cliente Detal'}</td>
                      <td class="text-right font-bold">${Utils.formatCurrency(f.total)}</td>
                      <td><span class="badge badge-${f.estado === 'pagada' ? 'success' : f.estado === 'confirmada' ? 'warning' : 'secondary'}">${f.estado}</span></td>
                      <td>${Utils.formatTime(f.createdAt)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }
};
