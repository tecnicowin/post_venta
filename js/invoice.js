const Invoice = {
  currentInvoice: null,
  allFacturas: [],

  async load() {
    this.allFacturas = await Storage.getAll(STORES.facturas);
    this.allFacturas.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    this.filteredFacturas = [...this.allFacturas];
  },

  createNew() {
    this.currentInvoice = {
      id: Utils.generateId(),
      numero: '',
      clienteId: '',
      cliente: null,
      items: [],
      subtotal: 0,
      descuento: 0,
      baseImponible: 0,
      iva16: 0,
      iva10: 0,
      iva0: 0,
      totalIva: 0,
      total: 0,
      tasaDolar: Config.get('tasaDolar') || 0,
      totalDolares: 0,
      pagos: [],
      estado: 'borrador',
      operadorId: '',
      cajaId: CashRegister.currentCaja ? CashRegister.currentCaja.id : '',
      createdAt: Utils.getNow(),
      updatedAt: Utils.getNow()
    };
  },

  async addCliente(clienteData) {
    if (!this.currentInvoice) this.createNew();

    if (clienteData.tipo === 'personalizado') {
      const cliente = {
        id: Utils.generateId(),
        tipo: 'personalizado',
        nombre: clienteData.nombre || '',
        apellido: clienteData.apellido || '',
        nombreComercial: clienteData.nombreComercial || '',
        cedula: clienteData.cedula || '',
        rif: clienteData.rif || '',
        direccion: clienteData.direccion || '',
        zona: clienteData.zona || '',
        telefono: clienteData.telefono || '',
        email: clienteData.email || '',
        activo: true,
        createdAt: Utils.getNow()
      };
      await Storage.add(STORES.clientes, cliente);
      this.currentInvoice.clienteId = cliente.id;
      this.currentInvoice.cliente = cliente;
    } else {
      this.currentInvoice.clienteId = '';
      this.currentInvoice.cliente = { tipo: 'detal', nombre: 'Cliente Detal' };
    }
  },

  addItem(product) {
    if (!this.currentInvoice) this.createNew();

    const existingIdx = this.currentInvoice.items.findIndex(i => i.productoId === product.id);
    if (existingIdx >= 0) {
      this.currentInvoice.items[existingIdx].cantidad += 1;
    } else {
      const margen = product.margenGanancia || Config.get('margenGeneral') || 25;
      const costo = product.costoCompra || 0;
      this.currentInvoice.items.push({
        productoId: product.id,
        descripcion: product.descripcion,
        precio: product.precioDetal,
        precioTipo: 'detal',
        descuento: 0,
        cantidad: 1,
        subtotal: product.precioDetal,
        iva: product.iva || '16',
        totalPorRubro: product.precioDetal,
        costoCompra: costo,
        margenGanancia: margen
      });
    }
    this.recalculate();
  },

  updateItem(index, field, value) {
    if (!this.currentInvoice || !this.currentInvoice.items[index]) return;

    const item = this.currentInvoice.items[index];

    if (field === 'precioTipo') {
      const product = Inventory.getById(item.productoId);
      if (product) {
        item.precio = value === 'mayor' ? product.precioMayor : product.precioDetal;
        item.precioTipo = value;
        if (item.costoCompra > 0) {
          item.margenGanancia = item.precio > 0 ? Math.round(((item.precio - item.costoCompra) / item.costoCompra) * 100) : 0;
        }
      }
    } else if (field === 'cantidad') {
      item.cantidad = parseFloat(value) || 1;
    } else if (field === 'descuento') {
      item.descuento = parseFloat(value) || 0;
    } else if (field === 'precio') {
      item.precio = parseFloat(value) || 0;
      if (item.costoCompra > 0) {
        item.margenGanancia = item.precio > 0 ? Math.round(((item.precio - item.costoCompra) / item.costoCompra) * 100) : 0;
      }
    } else if (field === 'margenGanancia') {
      const margen = Math.min(100, Math.max(0, parseFloat(value) || 0));
      item.margenGanancia = margen;
      if (item.costoCompra > 0) {
        item.precio = parseFloat((item.costoCompra * (1 + margen / 100)).toFixed(2));
      }
    }

    item.subtotal = item.precio * item.cantidad;
    const descLinea = item.subtotal * (item.descuento / 100);
    item.totalPorRubro = item.subtotal - descLinea;
    this.recalculate();
  },

  removeItem(index) {
    if (!this.currentInvoice) return;
    this.currentInvoice.items.splice(index, 1);
    this.recalculate();
  },

  setDescuentoGlobal(pct) {
    if (!this.currentInvoice) return;
    this.currentInvoice.descuento = parseFloat(pct) || 0;
    this.recalculate();
  },

  recalculate() {
    if (!this.currentInvoice) return;
    const inv = this.currentInvoice;

    const iva16Rate = Config.get('iva16') || 0.16;
    const iva10Rate = Config.get('iva10') || 0.10;

    let subtotal = 0;
    let totalIva16 = 0;
    let totalIva10 = 0;
    let totalIva0 = 0;

    inv.items.forEach(item => {
      subtotal += item.totalPorRubro;
      const baseIva = item.totalPorRubro;
      if (item.iva === '16') totalIva16 += baseIva * iva16Rate;
      else if (item.iva === '10') totalIva10 += baseIva * iva10Rate;
    });

    inv.subtotal = subtotal;
    const descuentoMonto = subtotal * (inv.descuento / 100);
    inv.baseImponible = subtotal - descuentoMonto;
    inv.iva16 = totalIva16;
    inv.iva10 = totalIva10;
    inv.iva0 = totalIva0;
    inv.totalIva = totalIva16 + totalIva10 + totalIva0;
    inv.total = inv.baseImponible + inv.totalIva;
    inv.totalDolares = inv.total;
  },

  async save(status = 'borrador') {
    if (!this.currentInvoice) throw new Error('No hay factura activa');
    if (!this.currentInvoice.numero) {
      this.currentInvoice.numero = await Storage.getNextInvoiceNumber();
    }
    this.currentInvoice.estado = status;
    this.currentInvoice.updatedAt = Utils.getNow();
    this.recalculate();

    if (status === 'pagada') {
      const stockCheck = [];
      for (const item of this.currentInvoice.items) {
        const product = Inventory.getById(item.productoId);
        if (!product) {
          stockCheck.push({ ok: false, desc: item.descripcion, msg: 'Producto no encontrado' });
        } else if (product.cantidadExistencia < item.cantidad) {
          stockCheck.push({ ok: false, desc: item.descripcion, msg: `Stock insuficiente (${product.cantidadExistencia})` });
        } else {
          stockCheck.push({ ok: true, product, item });
        }
      }

      const errors = stockCheck.filter(s => !s.ok);
      if (errors.length > 0) {
        throw new Error(`Stock insuficiente: ${errors.map(e => `${e.desc}: ${e.msg}`).join('; ')}`);
      }

      const deducted = [];
      try {
        for (const entry of stockCheck) {
          await Inventory.addExit(entry.item.productoId, entry.item.cantidad);
          deducted.push(entry);
        }
      } catch (e) {
        for (const entry of deducted.reverse()) {
          try {
            const product = await Storage.get(STORES.productos, entry.item.productoId);
            if (product) {
              await Inventory.update(entry.item.productoId, {
                cantidadExistencia: product.cantidadExistencia + entry.item.cantidad,
                salidas: Math.max(0, (product.salidas || 0) - entry.item.cantidad)
              });
            }
          } catch (revErr) {
            console.warn('Error revirtiendo stock:', entry.item.descripcion, revErr);
          }
        }
        throw new Error(`Error al descontar stock: ${e.message}`);
      }
    }

    await Storage.update(STORES.facturas, this.currentInvoice);
    await Storage.log('factura_guardar', `Factura #${this.currentInvoice.numero} - ${status} - Total: ${Utils.formatCurrency(this.currentInvoice.total)}`);
    const saved = { ...this.currentInvoice };
    await this.load();
    return saved;
  },

  async loadForEdit(id) {
    this.currentInvoice = await Storage.get(STORES.facturas, id);
    return this.currentInvoice;
  },

  async renderFacturaPage() {
    await this.load();
    const container = document.getElementById('invoiceContent');
    if (!container) return;

    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <div class="flex gap-2">
          <button class="btn btn-primary" onclick="Invoice.showNewInvoice()">+ Nueva Factura</button>
        </div>
        <div class="flex gap-2 items-center">
          <input type="text" class="form-control" placeholder="Buscar por cliente..." id="invoiceSearch" style="width:200px">
          <select class="form-control" id="invoiceStatusFilter" style="width:auto">
            <option value="">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="pagada">Pagada</option>
            <option value="anulada">Anulada</option>
          </select>
          <input type="date" class="form-control" id="invoiceDateFrom" style="width:auto" title="Desde">
          <input type="date" class="form-control" id="invoiceDateTo" style="width:auto" title="Hasta">
        </div>
      </div>
      <div id="invoiceActive" class="hidden"></div>
      <div id="invoiceList"></div>
    `;

    document.getElementById('invoiceSearch').addEventListener('input', () => this.applyFilters());
    document.getElementById('invoiceStatusFilter').addEventListener('change', () => this.applyFilters());
    document.getElementById('invoiceDateFrom').addEventListener('change', () => this.applyFilters());
    document.getElementById('invoiceDateTo').addEventListener('change', () => this.applyFilters());

    this.renderFacturaList();
  },

  applyFilters() {
    const search = (document.getElementById('invoiceSearch')?.value || '').toLowerCase();
    const status = document.getElementById('invoiceStatusFilter')?.value || '';
    const dateFrom = document.getElementById('invoiceDateFrom')?.value || '';
    const dateTo = document.getElementById('invoiceDateTo')?.value || '';

    this.filteredFacturas = this.allFacturas.filter(f => {
      if (status && f.estado !== status) return false;
      if (dateFrom && f.createdAt && f.createdAt.substring(0, 10) < dateFrom) return false;
      if (dateTo && f.createdAt && f.createdAt.substring(0, 10) > dateTo) return false;
      if (search) {
        const clienteName = f.cliente ? (f.cliente.nombre || '').toLowerCase() : '';
        const clienteCom = f.cliente ? (f.cliente.nombreComercial || '').toLowerCase() : '';
        if (!clienteName.includes(search) && !clienteCom.includes(search) && !(f.numero || '').toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
    this.renderFacturaList();
  },

  renderFacturaList() {
    const listContainer = document.getElementById('invoiceList');
    if (!listContainer) return;

    const data = this.filteredFacturas || this.allFacturas;
    const recentes = data.slice(0, 100);

    UI.renderTable('invoiceList', [
      { label: '#', key: 'numero', width: '80px' },
      { label: 'Cliente', render: (row) => row.cliente ? UI.escapeHtml(row.cliente.nombre || 'Detal') : 'Detal' },
      { label: 'Items', render: (row) => row.items ? row.items.length : 0, align: 'center' },
      { label: 'Total', key: 'total', align: 'right', render: (row) => Utils.formatCurrency(row.total) },
      { label: 'Estado', align: 'center', render: (row) => {
        const colors = { borrador: 'secondary', confirmada: 'warning', pagada: 'success', anulada: 'danger' };
        return `<span class="badge badge-${colors[row.estado] || 'secondary'}">${row.estado}</span>`;
      }},
      { label: 'Fecha', render: (row) => Utils.formatDateTime(row.createdAt) },
      { label: '', align: 'center', width: '180px', render: (row) => `
        <div class="flex gap-1 justify-center">
          ${row.estado === 'borrador' ? `
            <button class="btn btn-ghost btn-sm" onclick="Invoice.editFactura('${row.id}')" title="Editar">✏️</button>
          ` : ''}
          <button class="btn btn-ghost btn-sm" onclick="Invoice.viewFactura('${row.id}')" title="Ver">👁️</button>
          ${row.estado === 'pagada' ? `
            <button class="btn btn-ghost btn-sm" onclick="PdfGenerator.printReceipt('${row.id}')" title="Imprimir">🖨️</button>
            <button class="btn btn-ghost btn-sm" onclick="PdfGenerator.generateAndDownload('${row.id}')" title="PDF">📄</button>
            <button class="btn btn-ghost btn-sm" onclick="WhatsAppShare.share('${row.id}')" title="WhatsApp">📱</button>
            <button class="btn btn-ghost btn-sm" onclick="Invoice.annul('${row.id}')" title="Anular" style="color:var(--danger)">🚫</button>
          ` : ''}
          ${row.estado !== 'anulada' && Operadores.isAdmin() ? `
            <button class="btn btn-ghost btn-sm" onclick="Invoice.confirmDelete('${row.id}')" title="Eliminar">🗑️</button>
          ` : ''}
       </div>`
    }], recentes, {
      emptyText: 'No hay facturas registradas',
      emptyAction: "Invoice.showNewInvoice()",
      emptyActionText: '+ Nueva Factura'
    });
  },

  showNewInvoice() {
    if (!CashRegister.isOpen()) {
      UI.showToast('Debes abrir la caja antes de facturar', 'warning');
      return;
    }
    this.createNew();
    this.renderFacturaEditor();
  },

  async editFactura(id) {
    await this.loadForEdit(id);
    if (this.currentInvoice.estado !== 'borrador') {
      UI.showToast('Solo se pueden editar facturas en borrador', 'warning');
      return;
    }
    this.renderFacturaEditor();
  },

  async viewFactura(id) {
    const factura = await Storage.get(STORES.facturas, id);
    if (!factura) return;

    const content = Invoice.renderFacturaPreview(factura);

    UI.showModal(`Factura #${factura.numero}`, content, {
      size: 'lg',
      footer: `
        <button class="btn btn-outline" onclick="UI.closeModal()">Cerrar</button>
        ${factura.estado === 'pagada' ? `
          <button class="btn btn-primary" onclick="UI.closeModal(); PdfGenerator.printReceipt('${factura.id}')">🖨️ Imprimir</button>
          <button class="btn btn-info" onclick="UI.closeModal(); PdfGenerator.generateAndDownload('${factura.id}')">📄 PDF</button>
          <button class="btn btn-success" onclick="UI.closeModal(); WhatsAppShare.share('${factura.id}')">📱 WhatsApp</button>
        ` : ''}
      `
    });
  },

  renderFacturaPreview(factura) {
    const config = Config.data;
    const cliente = factura.cliente || { tipo: 'detal', nombre: 'Cliente Detal' };
    const clienteNombre = cliente.tipo === 'personalizado' ?
      (cliente.nombreComercial || `${cliente.nombre} ${cliente.apellido}`) :
      'Cliente Detal';
    const clienteId = cliente.rif || cliente.cedula || 'N/A';

    let itemsHtml = '';
    if (factura.items) {
      factura.items.forEach(item => {
        itemsHtml += `
          <tr>
            <td>${UI.escapeHtml(item.descripcion)}</td>
            <td class="text-right">${Utils.formatCurrency(item.precio)}</td>
            <td class="text-center">${item.descuento}%</td>
            <td class="text-center">${item.cantidad}</td>
            <td class="text-right font-bold">${Utils.formatCurrency(item.totalPorRubro)}</td>
          </tr>`;
      });
    }

    return `
      <div style="font-size:13px">
        <div class="text-center mb-4">
          <h2 style="margin:0">${UI.escapeHtml(config.nombreComercial || 'Mi Negocio')}</h2>
          <div class="text-muted">RIF: ${UI.escapeHtml(config.rif || 'N/A')}</div>
          <div class="text-muted">Tel: ${UI.escapeHtml(config.telefono || '')}</div>
          <div class="text-muted">${UI.escapeHtml(config.direccion || '')}</div>
        </div>

        <div class="flex justify-between mb-3" style="padding:10px;background:#f1f5f9;border-radius:6px">
          <div>
            <div class="font-bold">Factura #${factura.numero}</div>
            <div class="text-muted">Fecha: ${Utils.formatDateTime(factura.createdAt)}</div>
          </div>
          <div class="text-right">
            <div>Cliente: <strong>${UI.escapeHtml(clienteNombre)}</strong></div>
            <div class="text-muted">${UI.escapeHtml(clienteId)}</div>
          </div>
        </div>

        <table class="table" style="margin-bottom:16px">
          <thead>
            <tr>
              <th>Descripción</th>
              <th class="text-right">Precio</th>
              <th class="text-center">Dto.</th>
              <th class="text-center">Cant.</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div class="invoice-summary">
          <div class="row subtotal"><span>Subtotal:</span><span>${Utils.formatCurrency(factura.subtotal)}</span></div>
          ${factura.descuento > 0 ? `<div class="row subtotal"><span>Descuento (${factura.descuento}%):</span><span class="text-danger">-${Utils.formatCurrency(factura.subtotal * factura.descuento / 100)}</span></div>` : ''}
          <div class="row subtotal"><span>Base Imponible:</span><span>${Utils.formatCurrency(factura.baseImponible)}</span></div>
          ${factura.iva16 > 0 ? `<div class="row subtotal"><span>IVA 16%:</span><span>${Utils.formatCurrency(factura.iva16)}</span></div>` : ''}
          ${factura.iva10 > 0 ? `<div class="row subtotal"><span>IVA 10%:</span><span>${Utils.formatCurrency(factura.iva10)}</span></div>` : ''}
          <div class="row subtotal"><span>Total IVA:</span><span>${Utils.formatCurrency(factura.totalIva)}</span></div>
          <div class="row total"><span>TOTAL:</span><span>${Utils.formatCurrency(factura.total)}</span></div>
          ${factura.tasaDolar > 0 ? `<div class="row subtotal"><span>Tasa $:</span><span>${Utils.formatCurrencyBs(factura.total, factura.tasaDolar)}</span></div>` : ''}
        </div>
      </div>
    `;
  },

  renderFacturaEditor() {
    const container = document.getElementById('invoiceActive');
    if (!container) return;
    container.classList.remove('hidden');

    const listContainer = document.getElementById('invoiceList');
    if (listContainer) listContainer.classList.add('hidden');

    const inv = this.currentInvoice;
    const cliente = inv.cliente || null;

    let clienteInfo = '<span class="text-muted">Sin cliente seleccionado</span>';
    if (cliente) {
      const nombre = cliente.tipo === 'personalizado' ?
        (cliente.nombreComercial || `${cliente.nombre} ${cliente.apellido}`) : 'Cliente Detal';
      clienteInfo = `
        <div>
          <strong>${UI.escapeHtml(nombre)}</strong>
          ${cliente.rif ? `<div class="text-muted" style="font-size:12px">RIF: ${UI.escapeHtml(cliente.rif)}</div>` : ''}
          ${cliente.cedula ? `<div class="text-muted" style="font-size:12px">Cédula: ${UI.escapeHtml(cliente.cedula)}</div>` : ''}
        </div>`;
    }

    let itemsHtml = '';
    inv.items.forEach((item, idx) => {
      const product = Inventory.getById(item.productoId);
      const codigo = product ? product.codigoBarras : '';
      itemsHtml += `
        <tr>
          <td class="input-cell">
            <span style="font-family:monospace;font-weight:600;color:var(--primary)">${codigo ? UI.escapeHtml(codigo) : '-'}</span>
          </td>
          <td class="input-cell">
            <input type="text" value="${UI.escapeHtml(item.descripcion)}" readonly style="background:#f1f5f9">
          </td>
          <td class="input-cell">
            <select onchange="Invoice.updateItem(${idx}, 'precioTipo', this.value); Invoice.renderFacturaEditor()">
              <option value="detal" ${item.precioTipo === 'detal' ? 'selected' : ''}>Detal</option>
              <option value="mayor" ${item.precioTipo === 'mayor' ? 'selected' : ''}>Mayor</option>
            </select>
          </td>
          <td class="input-cell">
            <input type="number" value="${item.precio}" step="0.01" min="0"
              onchange="Invoice.updateItem(${idx}, 'precio', this.value); Invoice.renderFacturaEditor()">
          </td>
          <td class="input-cell">
            <div class="flex items-center gap-1">
              <input type="number" value="${item.margenGanancia || 0}" step="1" min="0" max="100"
                style="width:55px"
                onchange="Invoice.updateItem(${idx}, 'margenGanancia', this.value); Invoice.renderFacturaEditor()">
              <span style="font-size:11px;color:#94a3b8">%</span>
            </div>
            ${item.costoCompra > 0 ? `<div style="font-size:10px;color:#64748b">Costo: ${Utils.formatCurrency(item.costoCompra)}</div>` : ''}
          </td>
          <td class="input-cell">
            <input type="number" value="${item.descuento}" step="0.1" min="0" max="100"
              onchange="Invoice.updateItem(${idx}, 'descuento', this.value); Invoice.renderFacturaEditor()">
          </td>
          <td class="input-cell">
            <input type="number" value="${item.cantidad}" min="1"
              onchange="Invoice.updateItem(${idx}, 'cantidad', this.value); Invoice.renderFacturaEditor()">
          </td>
          <td class="text-right font-bold" style="padding:10px 12px">${Utils.formatCurrency(item.totalPorRubro)}</td>
          <td class="actions-cell">
            <button onclick="Invoice.removeItem(${idx}); Invoice.renderFacturaEditor()">✕</button>
          </td>
        </tr>`;
    });

    if (inv.items.length === 0) {
      itemsHtml = `<tr><td colspan="9" class="text-center text-muted" style="padding:32px">
        Agrega productos usando el botón de abajo
      </td></tr>`;
    }

    container.innerHTML = `
      <div class="card mb-4">
        <div class="card-header">
          <h3>Factura #${inv.numero || 'Nueva'}</h3>
          <button class="btn btn-outline btn-sm" onclick="Invoice.cancelEdit()">← Volver a lista</button>
        </div>
        <div class="card-body">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <strong>Cliente:</strong> ${clienteInfo}
            </div>
            <button class="btn btn-outline btn-sm" onclick="Invoice.showClienteModal()">👤 Seleccionar Cliente</button>
          </div>

          <div class="table-wrapper">
            <table class="invoice-detail-table">
              <thead>
                <tr>
                  <th style="width:100px">Código</th>
                  <th>Descripción</th>
                  <th style="width:100px">Tipo Precio</th>
                  <th style="width:100px">Precio</th>
                  <th style="width:90px">Ganancia %</th>
                  <th style="width:80px">Descuento %</th>
                  <th style="width:80px">Cantidad</th>
                  <th class="text-right" style="width:100px">Total</th>
                  <th style="width:40px"></th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
          </div>

          <div class="flex gap-2 mt-3">
            <button class="btn btn-outline btn-sm" onclick="Invoice.showProductPicker()">+ Agregar Producto</button>
          </div>

          <div class="grid grid-2 mt-4">
            <div></div>
            <div class="invoice-summary">
              <div class="row subtotal"><span>Subtotal:</span><span>${Utils.formatCurrency(inv.subtotal)}</span></div>
              <div class="row subtotal flex items-center justify-between">
                <span>Descuento Global: </span>
                <span class="flex items-center gap-2">
                  <input type="number" value="${inv.descuento}" min="0" max="100" step="0.1"
                    style="width:60px;padding:4px 8px;border:1px solid var(--border);border-radius:4px;text-align:right"
                    onchange="Invoice.setDescuentoGlobal(this.value); Invoice.renderFacturaEditor()"> %
                </span>
              </div>
              <div class="row subtotal"><span>Base Imponible:</span><span>${Utils.formatCurrency(inv.baseImponible)}</span></div>
              ${inv.iva16 > 0 ? `<div class="row subtotal"><span>IVA 16%:</span><span>${Utils.formatCurrency(inv.iva16)}</span></div>` : ''}
              ${inv.iva10 > 0 ? `<div class="row subtotal"><span>IVA 10%:</span><span>${Utils.formatCurrency(inv.iva10)}</span></div>` : ''}
              <div class="row subtotal"><span>Total IVA:</span><span>${Utils.formatCurrency(inv.totalIva)}</span></div>
              <div class="row total"><span>TOTAL:</span><span>${Utils.formatCurrency(inv.total)}</span></div>
              ${inv.tasaDolar > 0 ? `<div class="row subtotal"><span>Tasa $:</span><span>${Utils.formatCurrencyBs(inv.total, inv.tasaDolar)}</span></div>` : ''}
            </div>
          </div>
        </div>
        <div class="card-footer">
          <button class="btn btn-outline" onclick="Invoice.cancelEdit()">Cancelar</button>
          <button class="btn btn-secondary" onclick="Invoice.saveAndContinue()">💾 Guardar Borrador</button>
          <button class="btn btn-warning" onclick="Invoice.confirmFactura()">✓ Confirmar Factura</button>
        </div>
      </div>
    `;
  },

  cancelEdit() {
    this.currentInvoice = null;
    const container = document.getElementById('invoiceActive');
    const listContainer = document.getElementById('invoiceList');
    if (container) container.classList.add('hidden');
    if (listContainer) listContainer.classList.remove('hidden');
    this.renderFacturaList();
  },

  showClienteModal() {
    const content = `
      <div class="tabs mb-4">
        <div class="tab-item active" onclick="Invoice.switchClienteTab('detal', this)">Cliente Detal</div>
        <div class="tab-item" onclick="Invoice.switchClienteTab('personalizado', this)">Cliente Personalizado</div>
      </div>
      <div id="clienteDetalTab">
        <div class="alert alert-info">
          <span>ℹ️</span> Se registrará como venta al contado sin datos de cliente específicos.
        </div>
      </div>
      <div id="clientePersonalizadoTab" class="hidden">
        <form id="clienteForm">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nombre Comercial (Empresa)</label>
              <input type="text" class="form-control" name="nombreComercial">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nombre <span class="required">*</span></label>
              <input type="text" class="form-control" name="nombre">
            </div>
            <div class="form-group">
              <label class="form-label">Apellido</label>
              <input type="text" class="form-control" name="apellido">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Cédula</label>
              <input type="text" class="form-control" name="cedula" placeholder="V-12345678">
            </div>
            <div class="form-group">
              <label class="form-label">RIF (Empresa)</label>
              <input type="text" class="form-control" name="rif" placeholder="J-12345678-9">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Dirección / Zona</label>
              <input type="text" class="form-control" name="direccion">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <select class="form-control" name="telefonoPrefijo">
                <option value="">Prefijo...</option>
                <option value="0212">0212</option>
                <option value="0412">0412</option>
                <option value="0416">0416</option>
                <option value="0422">0422</option>
                <option value="0424">0424</option>
                <option value="0414">0414</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Número</label>
              <input type="text" class="form-control" name="telefonoNum" placeholder="1234567">
            </div>
          </div>
        </form>
      </div>
    `;

    UI.showModal('Seleccionar Cliente', content, {
      confirmText: 'Guardar Cliente',
      onConfirm: async () => {
        const activeTab = document.querySelector('.tabs .tab-item.active');
        const isPersonalizado = activeTab && activeTab.textContent.includes('Personalizado');

        if (isPersonalizado) {
          const data = UI.getFormData('clienteForm');
          if (!data.nombre) {
            UI.showToast('El nombre es requerido', 'error');
            return;
          }
          data.tipo = 'personalizado';
          data.telefono = (data.telefonoPrefijo || '') + (data.telefonoNum || '');
          delete data.telefonoPrefijo;
          delete data.telefonoNum;
          await Invoice.addCliente(data);
          UI.showToast('Cliente registrado', 'success');
        } else {
          await Invoice.addCliente({ tipo: 'detal' });
          UI.showToast('Cliente Detal seleccionado', 'success');
        }
        UI.closeModal();
        setTimeout(() => Invoice.renderFacturaEditor(), 100);
      }
    });
  },

  switchClienteTab(tab, el) {
    const tabs = el.closest('.tabs');
    if (tabs) {
      tabs.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    }
    el.classList.add('active');
    document.getElementById('clienteDetalTab').classList.toggle('hidden', tab !== 'detal');
    document.getElementById('clientePersonalizadoTab').classList.toggle('hidden', tab !== 'personalizado');
  },

  showProductPicker() {
    const content = `
      <div class="mb-3">
        <label class="form-label" style="font-weight:600;font-size:14px">📝 Ingresa el código del producto</label>
        <div class="flex gap-2">
          <input type="text" class="form-control" id="invoiceCodeInput" placeholder="Escribe el código y presiona Enter..."
            style="font-family:monospace;font-size:16px;letter-spacing:2px;padding:12px" autofocus
            onkeydown="if(event.key==='Enter'){Invoice.searchAndAdd(event.target.value);event.preventDefault();}">
          <button class="btn btn-primary" onclick="Invoice.searchAndAdd(document.getElementById('invoiceCodeInput').value)">Buscar</button>
        </div>
        <div id="invoiceCodeMsg" style="min-height:24px;margin-top:8px"></div>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px">
        <div class="flex items-center justify-between mb-2">
          <span class="text-muted" style="font-size:13px">O busca por nombre:</span>
        </div>
        <div class="search-box mb-2" style="max-width:100%">
          <span class="icon">🔍</span>
          <input type="text" class="form-control" placeholder="Buscar por nombre..." id="productSearchInput"
            style="padding-left:36px">
        </div>
        <div id="productPickerList" style="max-height:300px;overflow-y:auto"></div>
      </div>
    `;

    UI.showModal('Agregar Producto', content, { footer: false, size: 'lg' });

    setTimeout(() => {
      const codeInput = document.getElementById('invoiceCodeInput');
      if (codeInput) codeInput.focus();
    }, 100);

    const searchInput = document.getElementById('productSearchInput');
    if (searchInput) {
      const debouncedFilter = Utils.debounce((val) => Invoice.filterProducts(val), 250);
      searchInput.addEventListener('input', (e) => debouncedFilter(e.target.value));
    }

    const pickerList = document.getElementById('productPickerList');
    if (pickerList) {
      pickerList.addEventListener('click', (e) => {
        const item = e.target.closest('.product-picker-item');
        if (item) {
          Invoice.pickProduct(item.dataset.productId);
          return;
        }
        const createBtn = e.target.closest('.create-product-btn');
        if (createBtn) {
          Invoice.createProductFromPicker(createBtn.dataset.query);
        }
      });
    }
  },

  async searchAndAdd(code) {
    if (!code || !code.trim()) {
      UI.showToast('Ingresa un código', 'warning');
      return;
    }
    const codeTrimmed = code.trim().toLowerCase();
    const msgEl = document.getElementById('invoiceCodeMsg');

    const found = Inventory.items.find(p =>
      p.activo && (
        (p.codigoBarras && p.codigoBarras.toLowerCase() === codeTrimmed) ||
        (p.descripcion && p.descripcion.toLowerCase() === codeTrimmed) ||
        (p.tipo && p.tipo.toLowerCase() === codeTrimmed)
      )
    );

    if (found) {
      if (found.cantidadExistencia <= 0) {
        if (msgEl) msgEl.innerHTML = `<div class="alert alert-danger" style="margin:0"><span>⚠️</span><div>Sin stock: ${UI.escapeHtml(found.descripcion)}</div></div>`;
        return;
      }
      this.pickProduct(found.id);
    } else {
      if (msgEl) msgEl.innerHTML = `<div class="alert alert-warning" style="margin:0"><span>⚠️</span><div>Producto no encontrado. <button class="btn btn-ghost btn-sm" onclick="Invoice.createNewFromCode('${Utils.escapeHtml(code.trim())}')" style="padding:2px 8px;text-decoration:underline">Crear nuevo con código "${Utils.escapeHtml(code.trim())}"</button></div></div>`;
    }
  },

  createNewFromCode(code) {
    UI.closeModal();
    this.showNewProductForm(code);
  },

  showNewProductForm(defaultCode = '') {
    const content = `
      <form id="newProductInvoiceForm">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Código <span class="required">*</span></label>
            <input type="text" class="form-control" name="codigoBarras" value="${defaultCode}" placeholder="Código del producto" style="font-family:monospace">
          </div>
          <div class="form-group">
            <label class="form-label">Descripción <span class="required">*</span></label>
            <input type="text" class="form-control" name="descripcion" placeholder="Nombre del producto" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Categoría</label>
            <select class="form-control" name="categoriaId" id="newProdCategory">
              <option value="">Sin categoría</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">IVA</label>
            <select class="form-control" name="iva">
              <option value="16">16%</option>
              <option value="10">10%</option>
              <option value="0">0% (Exento)</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Costo de Compra ($)</label>
            <input type="number" class="form-control" name="costoCompra" step="0.01" min="0" placeholder="0.00">
          </div>
          <div class="form-group">
            <label class="form-label">Margen de Ganancia (%)</label>
            <input type="number" class="form-control" name="margenGanancia" value="${Config.get('margenGeneral') || 30}" step="1" min="0" max="500">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Precio Detal ($)</label>
            <input type="number" class="form-control" name="precioDetal" step="0.01" min="0" placeholder="0.00">
          </div>
          <div class="form-group">
            <label class="form-label">Precio Mayor ($)</label>
            <input type="number" class="form-control" name="precioMayor" step="0.01" min="0" placeholder="0.00">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Cantidad</label>
            <input type="number" class="form-control" name="cantidad" value="1" min="1">
          </div>
          <div class="form-group">
            <label class="form-label">Stock Mínimo</label>
            <input type="number" class="form-control" name="stockMinimo" value="0" min="0">
          </div>
        </div>
      </form>
    `;

    UI.showModal('Nuevo Producto', content, {
      size: 'lg',
      confirmText: 'Guardar y Agregar',
      onConfirm: async () => {
        const data = UI.getFormData('newProductInvoiceForm');
        if (!data.descripcion) {
          UI.showToast('La descripción es requerida', 'error');
          return;
        }
        try {
          const newProduct = await Inventory.add({
            descripcion: data.descripcion,
            codigoBarras: data.codigoBarras || '',
            categoriaId: data.categoriaId || '',
            iva: data.iva || '16',
            costoCompra: parseFloat(data.costoCompra) || 0,
            margenGanancia: parseFloat(data.margenGanancia) || 0,
            precioDetal: parseFloat(data.precioDetal) || 0,
            precioMayor: parseFloat(data.precioMayor) || 0,
            cantidadExistencia: parseFloat(data.cantidad) || 0,
            stockMinimo: parseFloat(data.stockMinimo) || 0,
            entradas: parseFloat(data.cantidad) || 0,
            salidas: 0
          });
          this.pickProduct(newProduct.id);
          UI.showToast('Producto creado y agregado a la factura', 'success');
        } catch (e) {
          UI.showToast(e.message, 'error');
        }
      }
    });

    setTimeout(() => Categories.renderSelectOptions('newProdCategory', ''), 100);
  },

  filterProducts(query) {
    const products = Inventory.items.filter(p => {
      if (!p.activo || p.cantidadExistencia <= 0) return false;
      const q = query.toLowerCase();
      const cat = Categories.items.find(c => c.id === p.categoriaId);
      const catName = cat ? cat.nombre.toLowerCase() : '';
      return p.descripcion.toLowerCase().includes(q) ||
        (p.tipo && p.tipo.toLowerCase().includes(q)) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(q)) ||
        catName.includes(q);
    });

    let html = '';
    products.forEach(p => {
      const cat = Categories.items.find(c => c.id === p.categoriaId);
      html += `
        <div class="flex items-center justify-between product-picker-item" style="padding:10px;border-bottom:1px solid var(--border);cursor:pointer"
          data-product-id="${p.id}">
          <div>
            ${p.codigoBarras ? `<div style="font-size:11px;color:var(--primary);font-family:monospace;font-weight:600">📋 ${UI.escapeHtml(p.codigoBarras)}</div>` : ''}
            <div class="font-bold">${UI.escapeHtml(p.descripcion)}</div>
            <div class="text-muted" style="font-size:11px">
              ${cat ? UI.escapeHtml(cat.nombre) + ' | ' : ''}Stock: ${p.cantidadExistencia} | IVA: ${p.iva}%
            </div>
          </div>
          <div class="text-right">
            <div class="font-bold text-success">${Utils.formatCurrency(p.precioDetal)}</div>
          </div>
        </div>`;
    });

    if (products.length === 0) {
      const escapedQuery = Utils.escapeHtml(query);
      html = `
        <div class="text-center" style="padding:20px">
          <p class="text-muted mb-2">No se encontraron productos para "${escapedQuery}"</p>
          <button class="btn btn-primary btn-sm create-product-btn" data-query="${escapedQuery}">+ Crear producto "${escapedQuery}"</button>
        </div>`;
    }

    document.getElementById('productPickerList').innerHTML = html;
  },

  createProductFromPicker(nombre) {
    UI.closeModal();
    Inventory.showForm();
    setTimeout(() => {
      const descInput = document.querySelector('[name="descripcion"]');
      if (descInput) descInput.value = nombre;
    }, 200);
  },

  pickProduct(productId) {
    const product = Inventory.getById(productId);
    if (!product) return;
    this.addItem(product);
    UI.closeModal();
    UI.showToast(`${product.descripcion} agregado`, 'success');
    this.renderFacturaEditor();
  },

  async saveAndContinue() {
    if (!this.currentInvoice) return;
    if (this.currentInvoice.items.length === 0) {
      UI.showToast('Agrega al menos un producto', 'error');
      return;
    }
    try {
      await this.save('borrador');
      UI.showToast('Factura guardada como borrador', 'success');
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  },

  confirmFactura() {
    if (!this.currentInvoice) return;
    if (this.currentInvoice.items.length === 0) {
      UI.showToast('Agrega al menos un producto', 'error');
      return;
    }
    Payment.showPaymentModal(this.currentInvoice);
  },

  confirmDelete(id) {
    const factura = this.allFacturas.find(f => f.id === id);
    if (!factura) return;

    Operadores.showAdminPinModal(async () => {
      try {
        await this.remove(id);
        UI.showToast('Factura eliminada', 'success');
        await this.load();
        this.renderFacturaList();
      } catch (e) {
        UI.showToast('Error: ' + e.message, 'error');
      }
    });
  },

  async remove(id) {
    const factura = await Storage.get(STORES.facturas, id);
    if (!factura) throw new Error('Factura no encontrada');

    if (factura.estado === 'pagada' && factura.items) {
      for (const item of factura.items) {
        try {
          if (item.productoId) {
            const product = await Storage.get(STORES.productos, item.productoId);
            if (product) {
              await Inventory.update(item.productoId, {
                cantidadExistencia: product.cantidadExistencia + item.cantidad,
                salidas: Math.max(0, (product.salidas || 0) - item.cantidad)
              });
            }
          } else {
            const existentes = await Storage.searchProducts(item.descripcion);
            if (existentes.length > 0) {
              const product = existentes[0];
              await Inventory.update(product.id, {
                cantidadExistencia: product.cantidadExistencia + item.cantidad,
                salidas: Math.max(0, (product.salidas || 0) - item.cantidad)
              });
            }
          }
        } catch (e) {
          console.warn('Error revirtiendo stock:', item.descripcion, e);
        }
      }
    }

    await Storage.delete(STORES.facturas, id);
    await Storage.log('factura_eliminar', `Factura #${factura.numero} eliminada`);
  },

  annul(id) {
    const factura = this.allFacturas.find(f => f.id === id);
    if (!factura) return;
    if (factura.estado === 'anulada') {
      UI.showToast('La factura ya está anulada', 'warning');
      return;
    }

    Operadores.showAdminPinModal(async () => {
      try {
        const fac = await Storage.get(STORES.facturas, id);
        if (!fac) throw new Error('Factura no encontrada');

        if (fac.estado === 'pagada' && fac.items) {
          for (const item of fac.items) {
            try {
              if (item.productoId) {
                const product = await Storage.get(STORES.productos, item.productoId);
                if (product) {
                  await Inventory.update(item.productoId, {
                    cantidadExistencia: product.cantidadExistencia + item.cantidad,
                    salidas: Math.max(0, (product.salidas || 0) - item.cantidad)
                  });
                }
              } else {
                const existentes = await Storage.searchProducts(item.descripcion);
                if (existentes.length > 0) {
                  const product = existentes[0];
                  await Inventory.update(product.id, {
                    cantidadExistencia: product.cantidadExistencia + item.cantidad,
                    salidas: Math.max(0, (product.salidas || 0) - item.cantidad)
                  });
                }
              }
            } catch (e) {
              console.warn('Error revirtiendo stock:', item.descripcion, e);
            }
          }
        }

        fac.estado = 'anulada';
        fac.updatedAt = Utils.getNow();
        await Storage.update(STORES.facturas, fac);
        await Storage.log('factura_anular', `Factura #${fac.numero} anulada - Total: ${Utils.formatCurrency(fac.total)}`);
        await this.load();
        UI.showToast('Factura anulada', 'success');
        this.renderFacturaList();
      } catch (e) {
        UI.showToast('Error: ' + e.message, 'error');
      }
    });
  }
};
