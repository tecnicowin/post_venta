const Purchases = {
  items: [],
  _selectedSupplier: null,

  async load() {
    this.items = await Storage.getAll(STORES.compras);
    this.items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  async add(data) {
    const compra = {
      id: Utils.generateId(),
      fecha: data.fecha || Utils.getToday(),
      proveedorId: data.proveedorId || '',
      proveedor: data.proveedor || '',
      rif: data.rif || '',
      direccion: data.direccion || '',
      telefono: data.telefono || '',
      facturaNro: data.facturaNro || '',
      control: data.control || '',
      items: data.items || [],
      subtotal: 0,
      descuento: parseFloat(data.descuentoGlobal) || 0,
      baseImponible: 0,
      iva16: 0,
      iva10: 0,
      iva0: 0,
      totalIva: 0,
      total: 0,
      formaPago: data.formaPago || 'efectivo',
      banco: data.banco || '',
      referencia: data.referencia || '',
      observaciones: data.observaciones || '',
      estado: 'confirmada',
      createdAt: Utils.getNow()
    };

    this.calcTotals(compra);

    await Storage.add(STORES.compras, compra);
    await this.updateInventory(compra);
    if (compra.proveedorId) {
      await Suppliers.incrementPurchaseStats(compra.proveedorId, compra.total);
    }
    await this.load();
    return compra;
  },

  calcTotals(compra) {
    let subtotal = 0;
    let iva16 = 0;
    let iva10 = 0;

    compra.items.forEach(item => {
      const lineTotal = item.precio * item.cantidad;
      const descLinea = lineTotal * ((item.descuento || 0) / 100);
      item.totalLinea = lineTotal - descLinea;
      subtotal += item.totalLinea;

      if (item.iva === '16') iva16 += item.totalLinea * 0.16;
      else if (item.iva === '10') iva10 += item.totalLinea * 0.10;
    });

    compra.subtotal = subtotal;
    const descMonto = subtotal * (compra.descuento / 100);
    compra.baseImponible = subtotal - descMonto;
    compra.iva16 = iva16;
    compra.iva10 = iva10;
    compra.totalIva = iva16 + iva10;
    compra.total = compra.baseImponible + compra.totalIva;
  },

  async updateInventory(compra) {
    for (const item of compra.items) {
      const costoCompra = item.precio;
      const margen = parseFloat(item.margenGanancia) || 0;
      const precioDetalCalculado = margen > 0 ? costoCompra * (1 + margen / 100) : (item.precioDetal || costoCompra);

      if (item.productoId) {
        try {
          const product = Inventory.getById(item.productoId);
          if (product) {
            await Inventory.update(item.productoId, {
              cantidadExistencia: product.cantidadExistencia + item.cantidad,
              entradas: (product.entradas || 0) + item.cantidad,
              costoCompra: costoCompra,
              margenGanancia: margen,
              precioDetal: precioDetalCalculado,
              precioMayor: item.precioMayor || costoCompra
            });
          } else {
            await Inventory.addEntry(item.productoId, item.cantidad);
          }
        } catch (e) {
          console.warn('No se pudo actualizar inventario:', item.descripcion, e);
        }
      } else {
        const existentes = await Storage.searchProducts(item.descripcion);
        if (existentes.length > 0) {
          const product = existentes[0];
          await Inventory.update(product.id, {
            cantidadExistencia: product.cantidadExistencia + item.cantidad,
            entradas: (product.entradas || 0) + item.cantidad,
            costoCompra: costoCompra,
            margenGanancia: margen,
            precioDetal: precioDetalCalculado
          });
        } else {
          await Inventory.add({
            descripcion: item.descripcion,
            tipo: item.tipo || '',
            categoriaId: item.categoriaId || '',
            cantidadExistencia: item.cantidad,
            stockMinimo: 0,
            entradas: item.cantidad,
            salidas: 0,
            costoCompra: costoCompra,
            margenGanancia: margen,
            precioMayor: item.precioMayor || costoCompra,
            precioDetal: precioDetalCalculado,
            iva: item.iva || '16'
          });
        }
      }
    }
  },

  async remove(id) {
    await Storage.delete(STORES.compras, id);
    await this.load();
  },

  renderPage() {
    this.renderList();
  },

  renderList() {
    this.renderStats();

    UI.renderTable('purchasesTable', [
      { label: 'Fecha', render: (row) => Utils.formatDate(row.fecha) },
      { label: 'Proveedor', render: (row) => UI.escapeHtml(row.proveedor || '-') },
      { label: 'RIF', render: (row) => UI.escapeHtml(row.rif || '-') },
      { label: 'Factura #', render: (row) => UI.escapeHtml(row.facturaNro || '-') },
      { label: 'Control', render: (row) => UI.escapeHtml(row.control || '-') },
      { label: 'Items', render: (row) => row.items ? row.items.length : 0, align: 'center' },
      { label: 'Total', render: (row) => Utils.formatCurrency(row.total), align: 'right' },
      { label: 'Estado', align: 'center', render: (row) => `<span class="badge badge-success">${row.estado}</span>` },
      { label: '', align: 'center', width: '120px', render: (row) => `
        <div class="flex gap-1 justify-center">
          <button class="btn btn-ghost btn-sm" onclick="Purchases.showForm('${row.id}')" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="Purchases.viewFactura('${row.id}')" title="Ver">👁️</button>
          <button class="btn btn-ghost btn-sm" onclick="Purchases.printFactura('${row.id}')" title="Imprimir">📄</button>
          <button class="btn btn-ghost btn-sm" onclick="Purchases.confirmDelete('${row.id}')" title="Eliminar">🗑️</button>
        </div>`
    }], this.items, {
      emptyText: 'No hay compras registradas',
      emptyAction: "Purchases.showForm()",
      emptyActionText: '+ Nueva Compra'
    });
  },

  renderStats() {
    const total = this.items.length;
    const totalMonto = this.items.reduce((sum, c) => sum + (c.total || 0), 0);
    const mesActual = Utils.getToday().substring(0, 7);
    const esteMes = this.items.filter(c => c.fecha && c.fecha.startsWith(mesActual));
    const totalMes = esteMes.reduce((sum, c) => sum + (c.total || 0), 0);

    const el = document.getElementById('purchasesStats');
    if (el) {
      el.innerHTML = `
        <div class="stat-card"><div class="stat-icon blue">🛒</div><div class="stat-info"><h3>${total}</h3><p>Total Compras</p></div></div>
        <div class="stat-card"><div class="stat-icon green">💰</div><div class="stat-info"><h3>${Utils.formatCurrency(totalMonto)}</h3><p>Monto Total</p></div></div>
        <div class="stat-card"><div class="stat-icon yellow">📅</div><div class="stat-info"><h3>${esteMes.length}</h3><p>Compras del Mes</p></div></div>
        <div class="stat-card"><div class="stat-icon red">💵</div><div class="stat-info"><h3>${Utils.formatCurrency(totalMes)}</h3><p>Gasto Mensual</p></div></div>
      `;
    }
  },

  showForm(editId = null) {
    const compra = editId ? this.items.find(c => c.id === editId) : null;
    const title = compra ? 'Editar Compra' : 'Nueva Compra de Inventario';
    const hoy = Utils.getToday();

    if (compra && compra.proveedorId) {
      this._selectedSupplier = Suppliers.getById(compra.proveedorId) || null;
    } else {
      this._selectedSupplier = null;
    }

    const content = `
      <form id="purchaseForm">
        <div class="card mb-4">
          <div class="card-header"><h3>Datos de la Compra</h3></div>
          <div class="card-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Fecha <span class="required">*</span></label>
                <input type="date" class="form-control" name="fecha" value="${compra ? compra.fecha : hoy}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Factura Nro</label>
                <input type="text" class="form-control" name="facturaNro" value="${compra ? UI.escapeHtml(compra.facturaNro || '') : ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Control</label>
                <input type="text" class="form-control" name="control" value="${compra ? UI.escapeHtml(compra.control || '') : ''}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Proveedor</label>
              <div class="flex gap-2 items-center">
                <input type="hidden" name="proveedorId" id="proveedorId" value="${compra ? compra.proveedorId || '' : ''}">
                <input type="text" class="form-control" id="proveedorDisplay" readonly value="${compra ? UI.escapeHtml(compra.proveedor || '') : ''}" placeholder="Seleccionar proveedor...">
                <button type="button" class="btn btn-outline btn-sm" onclick="Purchases.pickSupplier()">🔍 Seleccionar</button>
                <button type="button" class="btn btn-outline btn-sm" onclick="Purchases.clearSupplier()">✕</button>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">RIF</label>
                <input type="text" class="form-control" name="rif" id="proveedorRif" value="${compra ? UI.escapeHtml(compra.rif || '') : ''}" placeholder="J-12345678-9">
              </div>
              <div class="form-group">
                <label class="form-label">Dirección / Zona</label>
                <input type="text" class="form-control" name="direccion" id="proveedorDir" value="${compra ? UI.escapeHtml(compra.direccion || '') : ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Teléfono</label>
                <input type="text" class="form-control" name="telefono" id="proveedorTel" value="${compra ? UI.escapeHtml(compra.telefono || '') : ''}">
              </div>
            </div>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-header">
            <h3>Detalle de Productos</h3>
            <button type="button" class="btn btn-primary btn-sm" onclick="Purchases.addItemRow()">+ Agregar</button>
          </div>
          <div class="card-body" style="padding:0">
            <div class="table-wrapper">
              <table class="invoice-detail-table" id="purchaseDetailTable">
                <thead>
                  <tr>
                    <th style="min-width:160px">Descripción</th>
                    <th style="width:90px">Tipo</th>
                    <th style="width:60px">Cant.</th>
                    <th style="width:90px">P. Compra</th>
                    <th style="width:90px">Ganancia %</th>
                    <th style="width:90px">P. Venta</th>
                    <th style="width:60px">Dto %</th>
                    <th style="width:60px">IVA</th>
                    <th style="width:90px">Total</th>
                    <th style="width:40px"></th>
                  </tr>
                </thead>
                <tbody id="purchaseDetailBody">
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="8"></td>
                    <td class="text-right font-bold" id="purchaseSubtotal">$0.00</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-header"><h3>Resumen y Pago</h3></div>
          <div class="card-body">
            <div class="grid grid-2">
              <div>
                <div class="form-group">
                  <label class="form-label">Descuento Global %</label>
                  <input type="number" class="form-control" name="descuentoGlobal" value="${compra ? compra.descuento : 0}" min="0" max="100" step="0.1" onchange="Purchases.recalcAll()">
                </div>
                <div class="form-group">
                  <label class="form-label">Forma de Pago</label>
                  <select class="form-control" name="formaPago">
                    <option value="efectivo" ${compra && compra.formaPago === 'efectivo' ? 'selected' : ''}>Efectivo $</option>
                    <option value="transferencia" ${compra && compra.formaPago === 'transferencia' ? 'selected' : ''}>Transferencia</option>
                    <option value="pagomovil" ${compra && compra.formaPago === 'pagomovil' ? 'selected' : ''}>Pago Móvil</option>
                    <option value="puntodeventa" ${compra && compra.formaPago === 'puntodeventa' ? 'selected' : ''}>Punto de Venta</option>
                    <option value="binance" ${compra && compra.formaPago === 'binance' ? 'selected' : ''}>Binance</option>
                    <option value="paypal" ${compra && compra.formaPago === 'paypal' ? 'selected' : ''}>PayPal</option>
                    <option value="airtm" ${compra && compra.formaPago === 'airtm' ? 'selected' : ''}>Airtm</option>
                  </select>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Banco</label>
                    <input type="text" class="form-control" name="banco" value="${compra ? UI.escapeHtml(compra.banco || '') : ''}">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Referencia</label>
                    <input type="text" class="form-control" name="referencia" value="${compra ? UI.escapeHtml(compra.referencia || '') : ''}">
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Observaciones</label>
                  <textarea class="form-control" name="observaciones" rows="2">${compra ? UI.escapeHtml(compra.observaciones || '') : ''}</textarea>
                </div>
              </div>
              <div>
                <div class="invoice-summary">
                  <div class="row subtotal"><span>Subtotal:</span><span id="rSubtotal">$0.00</span></div>
                  <div class="row subtotal"><span>Descuento:</span><span id="rDescuento" class="text-danger">-$0.00</span></div>
                  <div class="row subtotal"><span>Base Imponible:</span><span id="rBaseImp">$0.00</span></div>
                  <div class="row subtotal"><span>IVA 16%:</span><span id="rIva16">$0.00</span></div>
                  <div class="row subtotal"><span>IVA 10%:</span><span id="rIva10">$0.00</span></div>
                  <div class="row subtotal"><span>Total IVA:</span><span id="rTotalIva">$0.00</span></div>
                  <div class="row total"><span>TOTAL:</span><span id="rTotal">$0.00</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    `;

    UI.showModal(title, content, {
      size: 'lg',
      confirmText: compra ? 'Actualizar' : 'Guardar Compra',
      onConfirm: async () => {
        await this.savePurchase(compra ? compra.id : null);
      }
    });

    if (compra && compra.items) {
      this._editingItems = [...compra.items];
    } else {
      this._editingItems = [];
    }
    this.renderDetailRows();
    this.recalcAll();
  },

  pickSupplier() {
    Suppliers.showPicker((prov) => {
      this._selectedSupplier = prov;
      const el = (id) => document.getElementById(id);
      if (el('proveedorId')) el('proveedorId').value = prov.id;
      if (el('proveedorDisplay')) el('proveedorDisplay').value = prov.nombre;
      if (el('proveedorRif')) el('proveedorRif').value = prov.rif || '';
      if (el('proveedorDir')) el('proveedorDir').value = prov.direccion || '';
      if (el('proveedorTel')) el('proveedorTel').value = prov.telefono || '';
    });
  },

  clearSupplier() {
    this._selectedSupplier = null;
    const el = (id) => document.getElementById(id);
    if (el('proveedorId')) el('proveedorId').value = '';
    if (el('proveedorDisplay')) el('proveedorDisplay').value = '';
    if (el('proveedorRif')) el('proveedorRif').value = '';
    if (el('proveedorDir')) el('proveedorDir').value = '';
    if (el('proveedorTel')) el('proveedorTel').value = '';
  },

  _editingItems: [],

  addItemRow() {
    this._editingItems.push({
      productoId: '',
      descripcion: '',
      tipo: '',
      categoriaId: '',
      cantidad: 1,
      precio: 0,
      margenGanancia: Config.get('margenGeneral') || 30,
      precioDetal: 0,
      descuento: 0,
      iva: '16',
      totalLinea: 0
    });
    this.renderDetailRows();
  },

  removeItemRow(idx) {
    this._editingItems.splice(idx, 1);
    this.renderDetailRows();
    this.recalcAll();
  },

  updateItemField(idx, field, value) {
    const item = this._editingItems[idx];
    if (!item) return;

    if (field === 'cantidad' || field === 'precio' || field === 'precioDetal' || field === 'descuento' || field === 'margenGanancia') {
      item[field] = parseFloat(value) || 0;
    } else {
      item[field] = value;
    }

    if (field === 'precio' || field === 'margenGanancia') {
      const margen = item.margenGanancia || 0;
      item.precioDetal = margen > 0 ? item.precio * (1 + margen / 100) : item.precioDetal;
    }

    const lineTotal = item.precio * item.cantidad;
    const descLinea = lineTotal * ((item.descuento || 0) / 100);
    item.totalLinea = lineTotal - descLinea;

    this.renderDetailRows();
    this.recalcAll();
  },

  recalcItemVenta(idx) {
    const item = this._editingItems[idx];
    if (!item) return;
    const margen = item.margenGanancia || 0;
    item.precioDetal = margen > 0 ? item.precio * (1 + margen / 100) : item.precioDetal;
    this.renderDetailRows();
    this.recalcAll();
  },

  renderDetailRows() {
    const tbody = document.getElementById('purchaseDetailBody');
    if (!tbody) return;

    let html = '';
    this._editingItems.forEach((item, idx) => {
      const precioVenta = item.precioDetal || (item.margenGanancia > 0 ? item.precio * (1 + item.margenGanancia / 100) : item.precio);
      html += `
        <tr>
          <td class="input-cell">
            <input type="text" value="${UI.escapeHtml(item.descripcion)}" placeholder="Nombre del producto"
              onchange="Purchases.updateItemField(${idx}, 'descripcion', this.value)">
          </td>
          <td class="input-cell">
            <input type="text" value="${UI.escapeHtml(item.tipo || '')}" placeholder="Tipo"
              onchange="Purchases.updateItemField(${idx}, 'tipo', this.value)">
          </td>
          <td class="input-cell">
            <input type="number" value="${item.cantidad}" min="1"
              onchange="Purchases.updateItemField(${idx}, 'cantidad', this.value)">
          </td>
          <td class="input-cell">
            <input type="number" value="${item.precio}" step="0.01" min="0"
              onchange="Purchases.updateItemField(${idx}, 'precio', this.value)">
          </td>
          <td class="input-cell">
            <select onchange="Purchases.updateItemField(${idx}, 'margenGanancia', this.value)">
              <option value="0" ${!item.margenGanancia ? 'selected' : ''}>Sin ganancia</option>
              <option value="10" ${item.margenGanancia == 10 ? 'selected' : ''}>10%</option>
              <option value="30" ${item.margenGanancia == 30 ? 'selected' : ''}>30%</option>
              <option value="40" ${item.margenGanancia == 40 ? 'selected' : ''}>40%</option>
              <option value="60" ${item.margenGanancia == 60 ? 'selected' : ''}>60%</option>
              <option value="custom" ${![0,10,30,40,60].includes(item.margenGanancia) ? 'selected' : ''}>Otro...</option>
            </select>
            ${![0,10,30,40,60].includes(item.margenGanancia) ? `<input type="number" value="${item.margenGanancia}" step="1" min="0" max="500" style="width:60px;margin-top:4px" onchange="Purchases.updateItemField(${idx}, 'margenGanancia', this.value)">` : ''}
          </td>
          <td class="text-right font-bold" style="padding:8px;color:var(--success)">${Utils.formatCurrency(precioVenta)}</td>
          <td class="input-cell">
            <input type="number" value="${item.descuento || 0}" step="0.1" min="0" max="100"
              onchange="Purchases.updateItemField(${idx}, 'descuento', this.value)">
          </td>
          <td class="input-cell">
            <select onchange="Purchases.updateItemField(${idx}, 'iva', this.value)">
              <option value="16" ${item.iva === '16' ? 'selected' : ''}>16%</option>
              <option value="10" ${item.iva === '10' ? 'selected' : ''}>10%</option>
              <option value="0" ${item.iva === '0' ? 'selected' : ''}>0%</option>
            </select>
          </td>
          <td class="text-right font-bold" id="ptotal-${idx}" style="padding:8px">${Utils.formatCurrency(item.totalLinea)}</td>
          <td style="text-align:center">
            <button type="button" class="btn btn-ghost btn-sm" onclick="Purchases.removeItemRow(${idx})" style="color:var(--danger);border:none;background:none;cursor:pointer;font-size:16px">✕</button>
          </td>
        </tr>`;
    });

    if (this._editingItems.length === 0) {
      html = '<tr><td colspan="10" class="text-center text-muted" style="padding:24px">Haz clic en "+ Agregar" para añadir productos a la compra</td></tr>';
    }

    tbody.innerHTML = html;
  },

  recalcAll() {
    let subtotal = 0;
    let iva16 = 0;
    let iva10 = 0;

    this._editingItems.forEach(item => {
      const lineTotal = item.precio * item.cantidad;
      const descLinea = lineTotal * ((item.descuento || 0) / 100);
      item.totalLinea = lineTotal - descLinea;
      subtotal += item.totalLinea;

      if (item.iva === '16') iva16 += item.totalLinea * 0.16;
      else if (item.iva === '10') iva10 += item.totalLinea * 0.10;
    });

    const descGlobal = parseFloat(document.querySelector('[name="descuentoGlobal"]')?.value) || 0;
    const descMonto = subtotal * (descGlobal / 100);
    const baseImp = subtotal - descMonto;
    const totalIva = iva16 + iva10;
    const total = baseImp + totalIva;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('purchaseSubtotal', Utils.formatCurrency(subtotal));
    set('rSubtotal', Utils.formatCurrency(subtotal));
    set('rDescuento', '-' + Utils.formatCurrency(descMonto));
    set('rBaseImp', Utils.formatCurrency(baseImp));
    set('rIva16', Utils.formatCurrency(iva16));
    set('rIva10', Utils.formatCurrency(iva10));
    set('rTotalIva', Utils.formatCurrency(totalIva));
    set('rTotal', Utils.formatCurrency(total));
  },

  async savePurchase(editId) {
    if (this._editingItems.length === 0) {
      UI.showToast('Agrega al menos un producto', 'error');
      return;
    }

    for (let i = 0; i < this._editingItems.length; i++) {
      const item = this._editingItems[i];
      if (!item.descripcion) {
        UI.showToast(`El producto #${i + 1} necesita una descripción`, 'error');
        return;
      }
      if (item.cantidad <= 0) {
        UI.showToast(`El producto "${item.descripcion}" necesita una cantidad válida`, 'error');
        return;
      }
    }

    const data = UI.getFormData('purchaseForm');
    data.items = [...this._editingItems];

    try {
      if (editId) {
        await Storage.update(STORES.compras, { ...(await Storage.get(STORES.compras, editId)), ...data });
        UI.showToast('Compra actualizada', 'success');
      } else {
        await this.add(data);
        UI.showToast('Compra registrada e inventario actualizado', 'success');
      }
      UI.closeModal();
      this.renderList();
    } catch (e) {
      UI.showToast('Error: ' + e.message, 'error');
    }
  },

  async viewFactura(id) {
    const compra = await Storage.get(STORES.compras, id);
    if (!compra) return;

    let itemsHtml = '';
    if (compra.items) {
      compra.items.forEach(item => {
        itemsHtml += `
          <tr>
            <td>${UI.escapeHtml(item.descripcion)}</td>
            <td class="text-center">${item.cantidad}</td>
            <td class="text-right">${Utils.formatCurrency(item.precio)}</td>
            <td class="text-center">${item.margenGanancia || 0}%</td>
            <td class="text-right">${Utils.formatCurrency(item.precioDetal || 0)}</td>
            <td class="text-center">${item.descuento || 0}%</td>
            <td class="text-center">${item.iva}%</td>
            <td class="text-right font-bold">${Utils.formatCurrency(item.totalLinea)}</td>
          </tr>`;
      });
    }

    const content = `
      <div style="font-size:13px">
        <div class="text-center mb-4">
          <h2 style="margin:0">COMPRA DE INVENTARIO</h2>
          <div class="text-muted">Fecha: ${Utils.formatDate(compra.fecha)}</div>
        </div>
        <div style="padding:10px;background:#f1f5f9;border-radius:6px;margin-bottom:16px">
          <div class="grid grid-2">
            <div>
              <div><strong>Proveedor:</strong> ${UI.escapeHtml(compra.proveedor || '-')}</div>
              <div><strong>RIF:</strong> ${UI.escapeHtml(compra.rif || '-')}</div>
              <div><strong>Dirección:</strong> ${UI.escapeHtml(compra.direccion || '-')}</div>
              <div><strong>Teléfono:</strong> ${UI.escapeHtml(compra.telefono || '-')}</div>
            </div>
            <div>
              <div><strong>Factura Nro:</strong> ${UI.escapeHtml(compra.facturaNro || '-')}</div>
              <div><strong>Control:</strong> ${UI.escapeHtml(compra.control || '-')}</div>
              <div><strong>Forma de Pago:</strong> ${compra.formaPago}</div>
            </div>
          </div>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Descripción</th>
              <th class="text-center">Cant.</th>
              <th class="text-right">P. Compra</th>
              <th class="text-center">Ganancia</th>
              <th class="text-right">P. Venta</th>
              <th class="text-center">Dto</th>
              <th class="text-center">IVA</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div class="invoice-summary">
          <div class="row subtotal"><span>Subtotal:</span><span>${Utils.formatCurrency(compra.subtotal)}</span></div>
          ${compra.descuento > 0 ? `<div class="row subtotal"><span>Descuento (${compra.descuento}%):</span><span class="text-danger">-${Utils.formatCurrency(compra.subtotal * compra.descuento / 100)}</span></div>` : ''}
          <div class="row subtotal"><span>Base Imponible:</span><span>${Utils.formatCurrency(compra.baseImponible)}</span></div>
          ${compra.iva16 > 0 ? `<div class="row subtotal"><span>IVA 16%:</span><span>${Utils.formatCurrency(compra.iva16)}</span></div>` : ''}
          ${compra.iva10 > 0 ? `<div class="row subtotal"><span>IVA 10%:</span><span>${Utils.formatCurrency(compra.iva10)}</span></div>` : ''}
          <div class="row total"><span>TOTAL:</span><span>${Utils.formatCurrency(compra.total)}</span></div>
        </div>
      </div>
    `;

    UI.showModal(`Compra #${compra.facturaNro || compra.id.substring(0, 8)}`, content, {
      size: 'lg',
      footer: `
        <button class="btn btn-outline" onclick="UI.closeModal()">Cerrar</button>
        <button class="btn btn-info" onclick="UI.closeModal(); Purchases.printFactura('${compra.id}')">📄 Imprimir PDF</button>
      `
    });
  },

  async printFactura(id) {
    const compra = await Storage.get(STORES.compras, id);
    if (!compra) return;

    if (typeof window.jspdf === 'undefined') {
      UI.showToast('Librería PDF no disponible. Verifica tu conexión a internet.', 'warning');
      return;
    }

    const { jsPDF } = window.jspdf;
    const config = Config.data;
    const paperSize = config.paperSize || '58mm';
    const formatWidth = paperSize === '80mm' ? 80 : 58;
    const doc = new jsPDF({ unit: 'mm', format: [formatWidth, 297] });
    let y = 8;

    const centerText = (text, yPos, options = {}) => {
      doc.setFontSize(options.fontSize || 8);
      doc.setFont('helvetica', options.fontStyle || 'normal');
      doc.text(text, formatWidth / 2, yPos, { align: 'center', maxWidth: formatWidth - 10 });
      return yPos + (options.fontSize * 0.45);
    };

    y = centerText(Utils.escapeHtml(config.nombreComercial || 'MI NEGOCIO'), y, { fontSize: 11, fontStyle: 'bold' });
    y = centerText(`RIF: ${Utils.escapeHtml(config.rif || 'N/A')}`, y + 1, { fontSize: 7 });
    y += 3;
    doc.line(5, y, formatWidth - 5, y);
    y += 4;

    y = centerText('COMPRA DE INVENTARIO', y, { fontSize: 9, fontStyle: 'bold' });
    y += 1;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha: ${Utils.formatDate(compra.fecha)}`, 5, y); y += 3;
    doc.text(`Proveedor: ${Utils.escapeHtml(compra.proveedor || '-')}`, 5, y); y += 3;
    doc.text(`RIF: ${Utils.escapeHtml(compra.rif || '-')}`, 5, y); y += 3;
    doc.text(`Factura: ${compra.facturaNro || '-'}  Ctrl: ${compra.control || '-'}`, 5, y); y += 3;
    doc.text(`Forma Pago: ${compra.formaPago}`, 5, y); y += 3;
    doc.line(5, y, formatWidth - 5, y); y += 3;

    if (compra.items) {
      compra.items.forEach(item => {
        if (y > 240) { doc.addPage(); y = 10; }
        const maxDesc = paperSize === '80mm' ? 22 : 16;
        const desc = item.descripcion.length > maxDesc ? item.descripcion.substring(0, maxDesc) : item.descripcion;
        doc.text(`${Utils.escapeHtml(desc)}`, 5, y);
        doc.text(`x${item.cantidad}`, formatWidth - 30, y);
        doc.text(Utils.formatCurrency(item.totalLinea), formatWidth - 5, y, { align: 'right' });
        y += 3;
        doc.setFontSize(6);
        doc.text(`  $${item.precio} x ${item.cantidad} IVA:${item.iva}% Gan:${item.margenGanancia || 0}%`, 5, y);
        doc.setFontSize(7);
        y += 4;
      });
    }

    doc.line(5, y, formatWidth - 5, y); y += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', 5, y);
    doc.text(Utils.formatCurrency(compra.total), formatWidth - 5, y, { align: 'right' });

    doc.save(`Compra_${compra.facturaNro || compra.id.substring(0, 8)}.pdf`);
    UI.showToast('PDF generado', 'success');
  },

  confirmDelete(id) {
    const compra = this.items.find(c => c.id === id);
    UI.confirm(`¿Eliminar esta compra de "${compra?.proveedor || 'proveedor'}"?`, async () => {
      try {
        await this.remove(id);
        UI.showToast('Compra eliminada', 'success');
        this.renderList();
      } catch (e) {
        UI.showToast(e.message, 'error');
      }
    });
  }
};
