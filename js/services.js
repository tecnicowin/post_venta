const Services = {
  items: [],
  currentService: null,

  async load() {
    this.items = await Storage.getAll(STORES.servicios);
    this.items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  createNew() {
    this.currentService = {
      id: Utils.generateId(),
      numero: '',
      clienteId: '',
      cliente: null,
      categoriaServicio: '',
      descripcionServicio: '',
      descripcionDetallada: '',
      accesorios: '',
      condicionEquipo: '',
      fallaReportada: '',
      diagnosticoTecnico: '',
      equipo: {
        tipo: 'PC',
        marca: '',
        modelo: '',
        serial: '',
        ram: '',
        procesador: '',
        tarjetaVideo: '',
        tarjetasPCI: '',
        discoDuro: '',
        otrosDetalles: ''
      },
      items: [],
      costoServicio: 0,
      subtotal: 0,
      descuento: 0,
      baseImponible: 0,
      iva16: 0,
      iva10: 0,
      totalIva: 0,
      total: 0,
      tasaDolar: Config.get('tasaDolar') || 0,
      pagos: [],
      estado: 'abierta',
      createdAt: Utils.getNow(),
      updatedAt: Utils.getNow(),
      cerradaEn: '',
      pagadaEn: ''
    };
  },

  async addCliente(clienteData) {
    if (!this.currentService) this.createNew();
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
      this.currentService.clienteId = cliente.id;
      this.currentService.cliente = cliente;
    } else {
      this.currentService.clienteId = '';
      this.currentService.cliente = { tipo: 'detal', nombre: 'Cliente Detal' };
    }
  },

  addItem(product) {
    if (!this.currentService) this.createNew();
    this.currentService.items.push({
      productoId: product.id,
      descripcion: product.descripcion,
      precio: product.precioDetal,
      cantidad: 1,
      iva: product.iva || '16',
      totalPorRubro: product.precioDetal
    });
    this.recalculate();
  },

  addCustomItem() {
    if (!this.currentService) this.createNew();
    this.currentService.items.push({
      productoId: '',
      descripcion: '',
      precio: 0,
      cantidad: 1,
      iva: '16',
      totalPorRubro: 0
    });
  },

  updateItem(index, field, value) {
    if (!this.currentService || !this.currentService.items[index]) return;
    const item = this.currentService.items[index];
    if (field === 'cantidad') item.cantidad = parseFloat(value) || 1;
    else if (field === 'precio') item.precio = parseFloat(value) || 0;
    else if (field === 'descripcion') item.descripcion = value;
    else if (field === 'iva') item.iva = value;
    item.totalPorRubro = item.precio * item.cantidad;
    this.recalculate();
  },

  removeItem(index) {
    if (!this.currentService) return;
    this.currentService.items.splice(index, 1);
    this.recalculate();
  },

  recalculate() {
    if (!this.currentService) return;
    const svc = this.currentService;
    const iva16Rate = Config.get('iva16') || 0.16;
    const iva10Rate = Config.get('iva10') || 0.10;
    let subtotal = 0, iva16 = 0, iva10 = 0;
    svc.items.forEach(item => {
      subtotal += item.totalPorRubro;
      if (item.iva === '16') iva16 += item.totalPorRubro * iva16Rate;
      else if (item.iva === '10') iva10 += item.totalPorRubro * iva10Rate;
    });
    svc.subtotal = subtotal;
    const descMonto = subtotal * (svc.descuento / 100);
    svc.baseImponible = subtotal - descMonto;
    svc.iva16 = iva16;
    svc.iva10 = iva10;
    svc.totalIva = iva16 + iva10;
    svc.total = svc.baseImponible + svc.totalIva;
  },

  async save(status) {
    if (!this.currentService) throw new Error('No hay servicio activo');
    if (!this.currentService.numero) {
      this.currentService.numero = await Storage.getNextServiceNumber();
    }
    this.currentService.estado = status;
    this.currentService.updatedAt = Utils.getNow();
    if (status === 'cerrada') this.currentService.cerradaEn = Utils.getNow();
    if (status === 'pagada') this.currentService.pagadaEn = Utils.getNow();
    this.recalculate();
    await Storage.update(STORES.servicios, this.currentService);
    const saved = { ...this.currentService };
    await this.load();
    return saved;
  },

  async loadForEdit(id) {
    this.currentService = await Storage.get(STORES.servicios, id);
    return this.currentService;
  },

  async remove(id) {
    await Storage.delete(STORES.servicios, id);
    await this.load();
  },

  renderPage() {
    this.renderList();
  },

  renderList() {
    this.renderStats();
    UI.renderTable('servicesTable', [
      { label: '#', key: 'numero', width: '80px' },
      { label: 'Cliente', render: (row) => row.cliente ? UI.escapeHtml(row.cliente.nombre || 'Detal') : 'Detal' },
      { label: 'Equipo', render: (row) => {
        const eq = row.equipo || {};
        return `${eq.tipo || 'PC'} ${eq.marca || ''} ${eq.modelo || ''}`;
      }},
      { label: 'Servicio', render: (row) => UI.escapeHtml((row.descripcionServicio || '').substring(0, 30)) },
      { label: 'Total', render: (row) => Utils.formatCurrency(row.total), align: 'right' },
      { label: 'Estado', align: 'center', render: (row) => {
        const colors = { abierta: 'warning', cerrada: 'info', pagada: 'success', anulada: 'danger' };
        return `<span class="badge badge-${colors[row.estado] || 'secondary'}">${row.estado}</span>`;
      }},
      { label: 'Fecha', render: (row) => Utils.formatDate(row.createdAt) },
      { label: '', align: 'center', width: '180px', render: (row) => `
        <div class="flex gap-1 justify-center">
          ${row.estado === 'abierta' ? `
            <button class="btn btn-ghost btn-sm" onclick="Services.editService('${row.id}')" title="Editar">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="Services.closeService('${row.id}')" title="Cerrar Orden">🔒</button>
          ` : ''}
          <button class="btn btn-ghost btn-sm" onclick="Services.viewService('${row.id}')" title="Ver">👁️</button>
          ${row.estado === 'cerrada' ? `
            <button class="btn btn-ghost btn-sm" onclick="Services.showPaymentModal('${row.id}')" title="Cobrar">💰</button>
          ` : ''}
          ${row.estado === 'pagada' ? `
            <button class="btn btn-ghost btn-sm" onclick="Services.printRecepcion('${row.id}')" title="PDF Recepción">📄</button>
            <button class="btn btn-ghost btn-sm" onclick="Services.printService('${row.id}')" title="Imprimir">🖨️</button>
            <button class="btn btn-ghost btn-sm" onclick="Services.shareWhatsApp('${row.id}')" title="WhatsApp">📱</button>
          ` : ''}
          <button class="btn btn-ghost btn-sm" onclick="Services.confirmDelete('${row.id}')" title="Eliminar">🗑️</button>
        </div>`
    }], this.items, {
      emptyText: 'No hay órdenes de servicio',
      emptyAction: "Services.showForm()",
      emptyActionText: '+ Nueva Orden'
    });
  },

  renderStats() {
    const total = this.items.length;
    const abiertas = this.items.filter(s => s.estado === 'abierta').length;
    const cerradas = this.items.filter(s => s.estado === 'cerrada').length;
    const pagadas = this.items.filter(s => s.estado === 'pagada');
    const totalIngresos = pagadas.reduce((sum, s) => sum + (s.total || 0), 0);
    const el = document.getElementById('servicesStats');
    if (el) {
      el.innerHTML = `
        <div class="stat-card"><div class="stat-icon blue">🔧</div><div class="stat-info"><h3>${total}</h3><p>Total Órdenes</p></div></div>
        <div class="stat-card"><div class="stat-icon yellow">⏳</div><div class="stat-info"><h3>${abiertas}</h3><p>Abiertas</p></div></div>
        <div class="stat-card"><div class="stat-icon red">📋</div><div class="stat-info"><h3>${cerradas}</h3><p>Cerradas (por cobrar)</p></div></div>
        <div class="stat-card"><div class="stat-icon green">💰</div><div class="stat-info"><h3>${Utils.formatCurrency(totalIngresos)}</h3><p>Ingresos</p></div></div>
      `;
    }
  },

  showForm(editId = null) {
    const svc = editId ? this.items.find(s => s.id === editId) : null;
    const title = svc ? 'Editar Orden de Servicio' : 'Nueva Orden de Servicio';

    if (svc) {
      this.currentService = { ...svc, items: [...(svc.items || [])], equipo: { ...(svc.equipo || {}) } };
    } else {
      this.createNew();
    }

    const s = this.currentService;
    const eq = s.equipo || {};

    const content = `
      <form id="serviceForm">
        <div class="card mb-3">
          <div class="card-header"><h3>📋 Datos del Cliente</h3></div>
          <div class="card-body">
            <div class="flex items-center gap-3 mb-3">
              <strong>Cliente:</strong>
              <span id="serviceClienteName">${s.cliente ? UI.escapeHtml(s.cliente.nombre || 'Cliente Detal') : 'Sin seleccionar'}</span>
              <button type="button" class="btn btn-outline btn-sm" onclick="Services.showClienteModal()">👤 Seleccionar</button>
            </div>
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-header"><h3>💻 Datos del Equipo</h3></div>
          <div class="card-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Tipo de Equipo</label>
                <select class="form-control" name="equipoTipo" id="equipoTipo" onchange="Services.toggleEquipoFields()">
                  <option value="PC" ${eq.tipo === 'PC' ? 'selected' : ''}>PC / Computadora</option>
                  <option value="Laptop" ${eq.tipo === 'Laptop' ? 'selected' : ''}>Laptop</option>
                  <option value="Celular" ${eq.tipo === 'Celular' ? 'selected' : ''}>Celular / Móvil</option>
                  <option value="Tablet" ${eq.tipo === 'Tablet' ? 'selected' : ''}>Tablet</option>
                  <option value="Impresora" ${eq.tipo === 'Impresora' ? 'selected' : ''}>Impresora</option>
                  <option value="Otro" ${eq.tipo === 'Otro' ? 'selected' : ''}>Otro</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Marca</label>
                <input type="text" class="form-control" name="equipoMarca" value="${UI.escapeHtml(eq.marca || '')}" placeholder="HP, Dell, Samsung...">
              </div>
              <div class="form-group">
                <label class="form-label">Modelo</label>
                <input type="text" class="form-control" name="equipoModelo" value="${UI.escapeHtml(eq.modelo || '')}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Serial / Número de Serie</label>
                <input type="text" class="form-control" name="equipoSerial" value="${UI.escapeHtml(eq.serial || '')}" placeholder="Número de serie del equipo">
              </div>
            </div>
            <div id="pcFields" class="${eq.tipo === 'Celular' || eq.tipo === 'Tablet' ? 'hidden' : ''}">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">RAM (GB)</label>
                  <input type="text" class="form-control" name="equipoRam" value="${UI.escapeHtml(eq.ram || '')}" placeholder="Ej: 8 GB DDR4">
                </div>
                <div class="form-group">
                  <label class="form-label">Procesador</label>
                  <input type="text" class="form-control" name="equipoProcesador" value="${UI.escapeHtml(eq.procesador || '')}" placeholder="Ej: Intel i5 12va">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Tarjeta de Video</label>
                  <input type="text" class="form-control" name="equipoVideo" value="${UI.escapeHtml(eq.tarjetaVideo || '')}" placeholder="Ej: NVIDIA GTX 1650">
                </div>
                <div class="form-group">
                  <label class="form-label">Tarjetas PCI</label>
                  <input type="text" class="form-control" name="equipoPCI" value="${UI.escapeHtml(eq.tarjetasPCI || '')}" placeholder="Ej: Tarjeta de red, Sound card">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Disco Duro (GB/TB)</label>
                  <input type="text" class="form-control" name="equipoDisco" value="${UI.escapeHtml(eq.discoDuro || '')}" placeholder="Ej: 500 GB SSD">
                </div>
                <div class="form-group">
                  <label class="form-label">Otros Detalles</label>
                  <input type="text" class="form-control" name="equipoOtros" value="${UI.escapeHtml(eq.otrosDetalles || '')}" placeholder="Fuente, cooler, etc.">
                </div>
              </div>
            </div>
            <div class="form-group mt-2">
              <label class="form-label">Accesorios Incluidos</label>
              <input type="text" class="form-control" name="accesorios" value="${UI.escapeHtml(s.accesorios || '')}" placeholder="Cargador, mouse, cable, etc.">
            </div>
            <div class="form-group mt-2">
              <label class="form-label">Condición del Equipo al Recibir</label>
              <textarea class="form-control" name="condicionEquipo" rows="2" placeholder="Estado físico, rasguños, daños visibles...">${UI.escapeHtml(s.condicionEquipo || '')}</textarea>
            </div>
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-header"><h3>🔧 Detalle del Servicio</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Falla Reportada por el Cliente <span class="required">*</span></label>
              <textarea class="form-control" name="fallaReportada" rows="2" placeholder="Describe la falla que reporta el cliente...">${UI.escapeHtml(s.fallaReportada || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Tipo de Servicio <span class="required">*</span></label>
              <input type="text" class="form-control" name="descripcionServicio" value="${UI.escapeHtml(s.descripcionServicio || '')}" placeholder="Ej: Formateo, Cambio de disco, Instalación de Windows..." required>
            </div>
            <div class="form-group">
              <label class="form-label">Diagnóstico Técnico</label>
              <textarea class="form-control" name="diagnosticoTecnico" rows="2" placeholder="Diagnóstico realizado por el técnico...">${UI.escapeHtml(s.diagnosticoTecnico || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Observaciones / Detalles Adicionales</label>
              <textarea class="form-control" name="descripcionDetallada" rows="2" placeholder="Detalles del servicio prestado, observaciones...">${UI.escapeHtml(s.descripcionDetallada || '')}</textarea>
            </div>
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-header">
            <h3>🔩 Materiales / Repuestos</h3>
            <button type="button" class="btn btn-primary btn-sm" onclick="Services.addCustomItem(); Services.renderEditorItems();">+ Agregar</button>
          </div>
          <div class="card-body" style="padding:0">
            <table class="invoice-detail-table">
              <thead><tr>
                <th style="min-width:200px">Descripción</th>
                <th style="width:70px">Cant.</th>
                <th style="width:100px">Precio</th>
                <th style="width:70px">IVA</th>
                <th style="width:100px">Total</th>
                <th style="width:40px"></th>
              </tr></thead>
              <tbody id="serviceDetailBody"></tbody>
            </table>
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-body">
            <div class="grid grid-2">
              <div>
                <div class="form-group">
                  <label class="form-label">Costo del Servicio ($)</label>
                  <input type="number" class="form-control" name="costoServicio" step="0.01" min="0" value="${s.costoServicio || 0}" onchange="Services.recalcAll()">
                </div>
                <div class="form-group">
                  <label class="form-label">Descuento Global %</label>
                  <input type="number" class="form-control" name="descuentoGlobal" step="0.1" min="0" max="100" value="${s.descuento || 0}" onchange="Services.recalcAll()">
                </div>
              </div>
              <div class="invoice-summary">
                <div class="row subtotal"><span>Materiales:</span><span id="sMateriales">$0.00</span></div>
                <div class="row subtotal"><span>Servicio:</span><span id="sCostoServ">$0.00</span></div>
                <div class="row subtotal"><span>Subtotal:</span><span id="sSubtotal">$0.00</span></div>
                <div class="row subtotal"><span>Descuento:</span><span id="sDescuento" class="text-danger">-$0.00</span></div>
                <div class="row subtotal"><span>Base Imponible:</span><span id="sBaseImp">$0.00</span></div>
                <div class="row subtotal"><span>IVA:</span><span id="sIva">$0.00</span></div>
                <div class="row total"><span>TOTAL A COBRAR:</span><span id="sTotal">$0.00</span></div>
              </div>
            </div>
          </div>
        </div>
      </form>
    `;

    UI.showModal(title, content, {
      size: 'lg',
      confirmText: svc ? 'Actualizar' : 'Guardar Orden',
      onConfirm: async () => {
        await this.saveService(editId);
      }
    });

    setTimeout(() => {
      this.renderEditorItems();
      this.recalcAll();
    }, 100);
  },

  toggleEquipoFields() {
    const tipo = document.getElementById('equipoTipo')?.value;
    const pcFields = document.getElementById('pcFields');
    if (pcFields) {
      pcFields.classList.toggle('hidden', tipo === 'Celular' || tipo === 'Tablet');
    }
  },

  renderEditorItems() {
    const tbody = document.getElementById('serviceDetailBody');
    if (!tbody || !this.currentService) return;
    let html = '';
    this.currentService.items.forEach((item, idx) => {
      html += `
        <tr>
          <td class="input-cell"><input type="text" value="${UI.escapeHtml(item.descripcion)}" onchange="Services.updateItem(${idx}, 'descripcion', this.value)"></td>
          <td class="input-cell"><input type="number" value="${item.cantidad}" min="1" onchange="Services.updateItem(${idx}, 'cantidad', this.value)"></td>
          <td class="input-cell"><input type="number" value="${item.precio}" step="0.01" min="0" onchange="Services.updateItem(${idx}, 'precio', this.value)"></td>
          <td class="input-cell">
            <select onchange="Services.updateItem(${idx}, 'iva', this.value)">
              <option value="16" ${item.iva === '16' ? 'selected' : ''}>16%</option>
              <option value="10" ${item.iva === '10' ? 'selected' : ''}>10%</option>
              <option value="0" ${item.iva === '0' ? 'selected' : ''}>0%</option>
            </select>
          </td>
          <td class="text-right font-bold" id="stotal-${idx}" style="padding:8px">${Utils.formatCurrency(item.totalPorRubro)}</td>
          <td style="text-align:center"><button type="button" onclick="Services.removeItem(${idx}); Services.renderEditorItems(); Services.recalcAll();" style="color:var(--danger);border:none;background:none;cursor:pointer;font-size:16px">✕</button></td>
        </tr>`;
    });
    if (this.currentService.items.length === 0) {
      html = '<tr><td colspan="6" class="text-center text-muted" style="padding:20px">Sin materiales. Agrega si es necesario.</td></tr>';
    }
    tbody.innerHTML = html;
  },

  recalcAll() {
    if (!this.currentService) return;
    const iva16Rate = Config.get('iva16') || 0.16;
    const iva10Rate = Config.get('iva10') || 0.10;
    let matSubtotal = 0, iva16 = 0, iva10 = 0;
    this.currentService.items.forEach(item => {
      const lt = item.precio * item.cantidad;
      item.totalPorRubro = lt;
      matSubtotal += lt;
      if (item.iva === '16') iva16 += lt * iva16Rate;
      else if (item.iva === '10') iva10 += lt * iva10Rate;
    });

    const costoServ = parseFloat(document.querySelector('[name="costoServicio"]')?.value) || 0;
    const descGlobal = parseFloat(document.querySelector('[name="descuentoGlobal"]')?.value) || 0;
    const subtotal = matSubtotal + costoServ;
    const descMonto = subtotal * (descGlobal / 100);
    const baseImp = subtotal - descMonto;
    const totalIva = iva16 + iva10 + (costoServ * iva16Rate);
    const total = baseImp + totalIva;

    this.currentService.costoServicio = costoServ;
    this.currentService.descuento = descGlobal;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('sMateriales', Utils.formatCurrency(matSubtotal));
    set('sCostoServ', Utils.formatCurrency(costoServ));
    set('sSubtotal', Utils.formatCurrency(subtotal));
    set('sDescuento', '-' + Utils.formatCurrency(descMonto));
    set('sBaseImp', Utils.formatCurrency(baseImp));
    set('sIva', Utils.formatCurrency(totalIva));
    set('sTotal', Utils.formatCurrency(total));
  },

  async saveService(editId) {
    if (!this.currentService) return;
    if (!this.currentService.descripcionServicio) {
      UI.showToast('Ingresa el tipo de servicio', 'error');
      return;
    }
    const form = document.getElementById('serviceForm');
    if (form) {
      this.currentService.descripcionServicio = form.querySelector('[name="descripcionServicio"]').value;
      this.currentService.descripcionDetallada = form.querySelector('[name="descripcionDetallada"]').value;
      this.currentService.fallaReportada = form.querySelector('[name="fallaReportada"]').value;
      this.currentService.diagnosticoTecnico = form.querySelector('[name="diagnosticoTecnico"]').value;
      this.currentService.accesorios = form.querySelector('[name="accesorios"]').value;
      this.currentService.condicionEquipo = form.querySelector('[name="condicionEquipo"]').value;
      this.currentService.equipo = {
        tipo: form.querySelector('[name="equipoTipo"]').value,
        marca: form.querySelector('[name="equipoMarca"]').value,
        modelo: form.querySelector('[name="equipoModelo"]').value,
        serial: form.querySelector('[name="equipoSerial"]')?.value || '',
        ram: form.querySelector('[name="equipoRam"]')?.value || '',
        procesador: form.querySelector('[name="equipoProcesador"]')?.value || '',
        tarjetaVideo: form.querySelector('[name="equipoVideo"]')?.value || '',
        tarjetasPCI: form.querySelector('[name="equipoPCI"]')?.value || '',
        discoDuro: form.querySelector('[name="equipoDisco"]')?.value || '',
        otrosDetalles: form.querySelector('[name="equipoOtros"]')?.value || ''
      };
      this.currentService.costoServicio = parseFloat(form.querySelector('[name="costoServicio"]').value) || 0;
      this.currentService.descuento = parseFloat(form.querySelector('[name="descuentoGlobal"]').value) || 0;
    }
    this.recalculate();
    try {
      if (editId) {
        this.currentService.id = editId;
        await Storage.update(STORES.servicios, this.currentService);
        UI.showToast('Orden actualizada', 'success');
      } else {
        await this.save('abierta');
        UI.showToast('Orden de servicio creada', 'success');
      }
      UI.closeModal();
      await this.load();
      this.renderList();
    } catch (e) {
      UI.showToast('Error: ' + e.message, 'error');
    }
  },

  editService(id) {
    this.loadForEdit(id).then(() => {
      if (this.currentService && this.currentService.estado === 'abierta') {
        this.showForm(id);
      } else {
        UI.showToast('Solo se pueden editar órdenes abiertas', 'warning');
      }
    });
  },

  async closeService(id) {
    const svc = await Storage.get(STORES.servicios, id);
    if (!svc) return;
    this.currentService = { ...svc, items: [...(svc.items || [])], equipo: { ...(svc.equipo || {}) } };

    UI.confirm('¿Cerrar esta orden de servicio? El cliente ya no podrá agregar más materiales.', async () => {
      this.currentService.estado = 'cerrada';
      this.currentService.cerradaEn = Utils.getNow();
      this.currentService.updatedAt = Utils.getNow();
      this.recalculate();
      await Storage.update(STORES.servicios, this.currentService);
      await this.load();
      UI.closeModal();
      UI.showToast('Orden cerrada. Pendiente de pago.', 'success');
      this.renderList();
    });
  },

  async showPaymentModal(id) {
    const svc = await Storage.get(STORES.servicios, id);
    if (!svc) return;

    this.currentService = { ...svc, items: [...(svc.items || [])], equipo: { ...(svc.equipo || {}) } };
    this.recalculate();

    const eq = svc.equipo || {};
    const cliente = svc.cliente || { tipo: 'detal', nombre: 'Cliente Detal' };
    const clienteNombre = cliente.tipo === 'personalizado' ? (cliente.nombreComercial || `${cliente.nombre} ${cliente.apellido}`) : 'Cliente Detal';

    const fpLabels = { transferencia: 'Transferencia', pagomovil: 'Pago Móvil', puntodeventa: 'Punto Venta', efectivo: 'Efectivo $', binance: 'Binance', paypal: 'PayPal', airtm: 'Airtm' };
    let methodsHtml = '';
    Object.entries(fpLabels).forEach(([key, label]) => {
      methodsHtml += `<div class="payment-method-card" onclick="Services.togglePayMethod('${key}')" id="spm-${key}"><div class="name">${label}</div></div>`;
    });

    const content = `
      <div class="mb-4">
        <div style="padding:12px;background:#f1f5f9;border-radius:8px;border-left:4px solid var(--primary)">
          <div class="grid grid-2" style="font-size:13px">
            <div>
              <div><strong>Orden:</strong> #${svc.numero}</div>
              <div><strong>Cliente:</strong> ${UI.escapeHtml(clienteNombre)}</div>
              <div><strong>Equipo:</strong> ${eq.tipo || 'PC'} ${eq.marca || ''} ${eq.modelo || ''}</div>
            </div>
            <div>
              <div><strong>Servicio:</strong> ${UI.escapeHtml(svc.descripcionServicio || '')}</div>
              <div><strong>Fecha:</strong> ${Utils.formatDate(svc.createdAt)}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="text-center mb-4" style="padding:16px;background:linear-gradient(135deg,#10b981,#059669);border-radius:12px;color:white">
        <div style="font-size:13px;opacity:0.9">MONTO A COBRAR</div>
        <div style="font-size:32px;font-weight:800;margin:4px 0">${Utils.formatCurrency(this.currentService.total)}</div>
        <div id="spm-change" style="font-size:12px;opacity:0.8"></div>
      </div>

      <h4 class="mb-3">💰 Forma de Pago</h4>
      <div class="payment-methods mb-3">${methodsHtml}</div>
      <div id="servicePaymentForms"></div>
    `;

    this._payMethods = [];

    UI.showModal('Cobrar Servicio', content, {
      size: 'lg',
      confirmText: '✓ Confirmar Pago',
      onConfirm: () => this.processServicePayment(id)
    });
  },

  _payMethods: [],

  togglePayMethod(method) {
    const card = document.getElementById(`spm-${method}`);
    if (!card) return;
    const idx = this._payMethods.indexOf(method);
    if (idx >= 0) { this._payMethods.splice(idx, 1); card.classList.remove('selected'); }
    else { this._payMethods.push(method); card.classList.add('selected'); }
    this.renderServicePaymentForms();
  },

  renderServicePaymentForms() {
    const container = document.getElementById('servicePaymentForms');
    if (!container) return;
    let html = '';
    this._payMethods.forEach((method) => {
      html += `
        <div class="card mb-2" style="border-left:3px solid var(--primary)">
          <div class="card-body" style="padding:12px">
            <div class="form-row">
              <div class="form-group"><label class="form-label">Banco</label>
                <select class="form-control" id="spm-banco-${method}">
                  <option value="">Banco...</option>
                  <option value="0102">Banco de Venezuela</option><option value="0104">BVC</option>
                  <option value="0105">Mercantil</option><option value="0108">Provincial</option>
                  <option value="0134">BNC</option><option value="0156">100% Banco</option>
                  <option value="0166">Agrícola</option><option value="0172">Bancamiga</option>
                  <option value="0175">Bicentenario</option><option value="crypto">Crypto</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">Referencia</label><input type="text" class="form-control" id="spm-ref-${method}"></div>
              <div class="form-group"><label class="form-label">Monto ($)</label><input type="number" class="form-control" id="spm-monto-${method}" step="0.01" min="0" onchange="Services.updatePaySummary()"></div>
            </div>
          </div>
        </div>`;
    });
    container.innerHTML = html;
  },

  updatePaySummary() {
    let total = 0;
    this._payMethods.forEach(m => {
      total += parseFloat(document.getElementById(`spm-monto-${m}`)?.value) || 0;
    });
    const diff = total - (this.currentService?.total || 0);
    const el = document.getElementById('spm-change');
    if (el) {
      if (diff >= 0) {
        el.innerHTML = `<span style="color:#d1fae5">✓ Pago completo${diff > 0 ? ` | Cambio: ${Utils.formatCurrency(diff)}` : ''}</span>`;
      } else {
        el.innerHTML = `<span style="color:#fecaca">⚠ Falta: ${Utils.formatCurrency(Math.abs(diff))}</span>`;
      }
    }
  },

  async processServicePayment(id) {
    if (this._payMethods.length === 0) { UI.showToast('Selecciona una forma de pago', 'error'); return; }
    const pagos = [];
    let totalPaid = 0;
    for (const method of this._payMethods) {
      const monto = parseFloat(document.getElementById(`spm-monto-${method}`)?.value) || 0;
      if (monto <= 0) { UI.showToast(`Monto inválido para ${method}`, 'error'); return; }
      pagos.push({
        id: Utils.generateId(), formaPago: method,
        banco: document.getElementById(`spm-banco-${method}`)?.value || '',
        referencia: document.getElementById(`spm-ref-${method}`)?.value || '',
        monto, montoDolares: monto, fecha: Utils.getNow()
      });
      totalPaid += monto;
    }
    if (totalPaid < this.currentService.total) { UI.showToast('Monto insuficiente', 'error'); return; }

    this.currentService.pagos = pagos;
    this.currentService.totalPagado = totalPaid;
    this.currentService.estado = 'pagada';
    this.currentService.updatedAt = Utils.getNow();
    this.currentService.pagadaEn = Utils.getNow();
    this.recalculate();
    await Storage.update(STORES.servicios, this.currentService);
    await this.load();
    UI.closeModal();
    UI.showToast('Pago confirmado', 'success');
    this.renderList();

    if (Config.get('autoPrint')) {
      setTimeout(() => this.printService(id), 500);
    }
  },

  async viewService(id) {
    const svc = await Storage.get(STORES.servicios, id);
    if (!svc) return;
    const config = Config.data;
    const cliente = svc.cliente || { tipo: 'detal', nombre: 'Cliente Detal' };
    const clienteNombre = cliente.tipo === 'personalizado' ? (cliente.nombreComercial || `${cliente.nombre} ${cliente.apellido}`) : 'Cliente Detal';
    const eq = svc.equipo || {};

    let itemsHtml = '';
    if (svc.items && svc.items.length > 0) {
      svc.items.forEach(item => {
        itemsHtml += `<tr><td>${UI.escapeHtml(item.descripcion)}</td><td class="text-center">${item.cantidad}</td><td class="text-right">${Utils.formatCurrency(item.precio)}</td><td class="text-right font-bold">${Utils.formatCurrency(item.totalPorRubro)}</td></tr>`;
      });
    } else {
      itemsHtml = '<tr><td colspan="4" class="text-center text-muted">Sin materiales</td></tr>';
    }

    let pagosHtml = '';
    if (svc.pagos && svc.pagos.length > 0) {
      pagosHtml = '<div style="margin-top:12px;padding:10px;background:#f0fdf4;border-radius:6px;border-left:4px solid var(--success)"><strong>💰 Pagos:</strong><br>';
      svc.pagos.forEach(p => {
        pagosHtml += `<div style="font-size:12px">${p.formaPago}: ${Utils.formatCurrency(p.monto)}${p.banco ? ` (${p.banco})` : ''}${p.referencia ? ` Ref: ${p.referencia}` : ''}</div>`;
      });
      pagosHtml += '</div>';
    }

    const content = `
      <div style="font-size:13px">
        <div class="text-center mb-3"><h2 style="margin:0">ORDEN DE SERVICIO #${svc.numero}</h2></div>
        <div style="padding:10px;background:#f1f5f9;border-radius:6px;margin-bottom:12px">
          <div class="grid grid-2">
            <div>
              <div><strong>Cliente:</strong> ${UI.escapeHtml(clienteNombre)}</div>
              <div><strong>RIF/C.I.:</strong> ${UI.escapeHtml(cliente.rif || cliente.cedula || 'N/A')}</div>
              ${cliente.telefono ? `<div><strong>Tel:</strong> ${UI.escapeHtml(cliente.telefono)}</div>` : ''}
            </div>
            <div>
              <div><strong>Fecha:</strong> ${Utils.formatDate(svc.createdAt)}</div>
              <div><strong>Estado:</strong> <span class="badge badge-${svc.estado === 'pagada' ? 'success' : svc.estado === 'cerrada' ? 'info' : 'warning'}">${svc.estado}</span></div>
            </div>
          </div>
        </div>

        <div style="padding:10px;background:#fffbeb;border-radius:6px;margin-bottom:12px;border-left:4px solid var(--warning)">
          <h4 style="margin:0 0 6px">💻 Equipo: ${eq.tipo || 'PC'}</h4>
          <div class="grid grid-3" style="font-size:12px">
            <div><strong>Marca:</strong> ${UI.escapeHtml(eq.marca || '-')}</div>
            <div><strong>Modelo:</strong> ${UI.escapeHtml(eq.modelo || '-')}</div>
            ${eq.serial ? `<div><strong>Serial:</strong> ${UI.escapeHtml(eq.serial)}</div>` : ''}
            ${eq.ram ? `<div><strong>RAM:</strong> ${UI.escapeHtml(eq.ram)}</div>` : ''}
            ${eq.procesador ? `<div><strong>Procesador:</strong> ${UI.escapeHtml(eq.procesador)}</div>` : ''}
            ${eq.tarjetaVideo ? `<div><strong>Video:</strong> ${UI.escapeHtml(eq.tarjetaVideo)}</div>` : ''}
            ${eq.discoDuro ? `<div><strong>Disco:</strong> ${UI.escapeHtml(eq.discoDuro)}</div>` : ''}
            ${eq.otrosDetalles ? `<div><strong>Otros:</strong> ${UI.escapeHtml(eq.otrosDetalles)}</div>` : ''}
          </div>
          ${svc.accesorios ? `<div style="margin-top:6px;font-size:12px"><strong>Accesorios:</strong> ${UI.escapeHtml(svc.accesorios)}</div>` : ''}
          ${svc.condicionEquipo ? `<div style="margin-top:6px;font-size:12px"><strong>Condición:</strong> ${UI.escapeHtml(svc.condicionEquipo)}</div>` : ''}
        </div>

        ${svc.fallaReportada ? `<div style="margin-bottom:12px"><strong>⚠️ Falla Reportada:</strong><br>${UI.escapeHtml(svc.fallaReportada).replace(/\n/g, '<br>')}</div>` : ''}
        <div style="margin-bottom:12px"><strong>🔧 Servicio:</strong> ${UI.escapeHtml(svc.descripcionServicio || '')}</div>
        ${svc.diagnosticoTecnico ? `<div style="margin-bottom:12px"><strong>🔍 Diagnóstico:</strong><br>${UI.escapeHtml(svc.diagnosticoTecnico).replace(/\n/g, '<br>')}</div>` : ''}
        ${svc.descripcionDetallada ? `<div style="margin-bottom:12px"><strong>📝 Observaciones:</strong><br>${UI.escapeHtml(svc.descripcionDetallada).replace(/\n/g, '<br>')}</div>` : ''}

        <table class="table mb-3">
          <thead><tr><th>Material/Repuesto</th><th class="text-center">Cant.</th><th class="text-right">Precio</th><th class="text-right">Total</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div class="invoice-summary">
          <div class="row subtotal"><span>Materiales:</span><span>${Utils.formatCurrency((svc.subtotal || 0) - (svc.costoServicio || 0))}</span></div>
          <div class="row subtotal"><span>Servicio:</span><span>${Utils.formatCurrency(svc.costoServicio || 0)}</span></div>
          <div class="row subtotal"><span>Subtotal:</span><span>${Utils.formatCurrency(svc.subtotal)}</span></div>
          ${svc.descuento > 0 ? `<div class="row subtotal"><span>Descuento (${svc.descuento}%):</span><span class="text-danger">-${Utils.formatCurrency(svc.subtotal * svc.descuento / 100)}</span></div>` : ''}
          <div class="row subtotal"><span>Base Imponible:</span><span>${Utils.formatCurrency(svc.baseImponible)}</span></div>
          ${svc.iva16 > 0 ? `<div class="row subtotal"><span>IVA 16%:</span><span>${Utils.formatCurrency(svc.iva16)}</span></div>` : ''}
          ${svc.iva10 > 0 ? `<div class="row subtotal"><span>IVA 10%:</span><span>${Utils.formatCurrency(svc.iva10)}</span></div>` : ''}
          <div class="row total"><span>TOTAL:</span><span>${Utils.formatCurrency(svc.total)}</span></div>
        </div>

        ${pagosHtml}
      </div>
    `;

    UI.showModal(`Orden #${svc.numero}`, content, {
      size: 'lg',
      footer: `
        <button class="btn btn-outline" onclick="UI.closeModal()">Cerrar</button>
        ${svc.estado === 'abierta' ? `<button class="btn btn-warning" onclick="UI.closeModal(); Services.closeService('${svc.id}')">🔒 Cerrar Orden</button>` : ''}
        ${svc.estado === 'cerrada' ? `<button class="btn btn-success" onclick="UI.closeModal(); Services.showPaymentModal('${svc.id}')">💰 Cobrar</button>` : ''}
        ${svc.estado === 'pagada' ? `
          <button class="btn btn-info" onclick="UI.closeModal(); Services.printRecepcion('${svc.id}')">📄 PDF Recepción</button>
          <button class="btn btn-primary" onclick="UI.closeModal(); Services.printService('${svc.id}')">🖨️ Imprimir</button>
          <button class="btn btn-success" onclick="UI.closeModal(); Services.shareWhatsApp('${svc.id}')">📱 WhatsApp</button>
        ` : ''}
      `
    });
  },

  async printRecepcion(id) {
    const svc = await Storage.get(STORES.servicios, id);
    if (!svc) return;
    if (typeof window.jspdf === 'undefined') { UI.showToast('PDF no disponible. Verifica tu conexión.', 'warning'); return; }

    const { jsPDF } = window.jspdf;
    const config = Config.data;
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const pageWidth = 215.9;
    const margin = 15;
    const width = pageWidth - 30;
    let y = 15;

    const centerText = (text, yPos, options = {}) => {
      doc.setFontSize(options.fs || 8);
      doc.setFont('helvetica', options.fw || 'normal');
      doc.text(text, pageWidth / 2, yPos, { align: 'center', maxWidth: width });
      return yPos + (options.lh || (options.fs || 8) * 0.4);
    };

    const leftText = (text, xPos, yPos, options = {}) => {
      doc.setFontSize(options.fs || 8);
      doc.setFont('helvetica', options.fw || 'normal');
      doc.text(text, xPos, yPos);
      return yPos + (options.lh || (options.fs || 8) * 0.4);
    };

    const eq = svc.equipo || {};
    const cliente = svc.cliente || { tipo: 'detal', nombre: 'Cliente Detal' };
    const clienteNombre = cliente.tipo === 'personalizado' ? (cliente.nombreComercial || `${cliente.nombre} ${cliente.apellido}`) : 'Cliente Detal';

    doc.setDrawColor(0);

    y = centerText(config.nombreComercial || 'MI NEGOCIO', y, { fs: 14, fw: 'bold', lh: 6 });
    y = centerText(`RIF: ${config.rif || 'N/A'} | Tel: ${config.telefono || ''}`, y, { fs: 8, lh: 4 });
    y = centerText(config.direccion || '', y, { fs: 7, lh: 4 });
    y += 2;
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    y = centerText('ORDEN DE RECEPCIÓN DE EQUIPO', y, { fs: 12, fw: 'bold', lh: 6 });
    y = centerText(`Orden Nro: #${svc.numero}`, y, { fs: 9, lh: 5 });
    y += 2;

    doc.setFillColor(240, 245, 255);
    doc.rect(margin, y - 3, width, 8, 'F');
    y = leftText(`Fecha de Recepción: ${Utils.formatDateTime(svc.createdAt)}`, margin + 3, y + 2, { fs: 8 });
    y += 3;

    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 3, width, 12, 'F');
    y = leftText(`Cliente: ${clienteNombre}`, margin + 3, y + 2, { fs: 8 });
    y = leftText(`C.I./RIF: ${cliente.cedula || cliente.rif || 'N/A'}    Tel: ${cliente.telefono || 'N/A'}`, margin + 3, y + 1, { fs: 7 });
    y += 4;

    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
    y = leftText('DATOS DEL EQUIPO', margin, y, { fs: 9, fw: 'bold', lh: 5 });
    y += 1;

    const eqData = [
      [`Tipo: ${eq.tipo || 'PC'}`, `Marca: ${eq.marca || '-'}`, `Modelo: ${eq.modelo || '-'}`],
      [`Serial: ${eq.serial || '-'}`, `RAM: ${eq.ram || '-'}`, `CPU: ${eq.procesador || '-'}`],
      [`Disco: ${eq.discoDuro || '-'}`, `Video: ${eq.tarjetaVideo || '-'}`, `Otros: ${eq.otrosDetalles || '-'}`]
    ];
    eqData.forEach(row => {
      y = leftText(row.join('  |  '), margin + 3, y, { fs: 7, lh: 4 });
    });

    if (svc.accesorios) {
      y = leftText(`Accesorios: ${svc.accesorios}`, margin + 3, y + 1, { fs: 7, lh: 4 });
    }
    if (svc.condicionEquipo) {
      y += 2;
      y = leftText('Condición del Equipo:', margin + 3, y, { fs: 7, fw: 'bold', lh: 4 });
      y = leftText(svc.condicionEquipo, margin + 6, y, { fs: 7, lh: 4 });
    }
    y += 3;

    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
    y = leftText('DESCRIPCIÓN DEL SERVICIO', margin, y, { fs: 9, fw: 'bold', lh: 5 });
    y += 1;

    if (svc.fallaReportada) {
      y = leftText('Falla Reportada:', margin + 3, y, { fs: 7, fw: 'bold', lh: 4 });
      const fallaLines = doc.splitTextToSize(svc.fallaReportada, width - 10);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text(fallaLines, margin + 6, y);
      y += fallaLines.length * 3.5 + 2;
    }

    y = leftText(`Tipo de Servicio: ${svc.descripcionServicio || '-'}`, margin + 3, y, { fs: 7, lh: 4 });

    if (svc.diagnosticoTecnico) {
      y = leftText('Diagnóstico Técnico:', margin + 3, y + 1, { fs: 7, fw: 'bold', lh: 4 });
      const diagLines = doc.splitTextToSize(svc.diagnosticoTecnico, width - 10);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text(diagLines, margin + 6, y);
      y += diagLines.length * 3.5 + 2;
    }
    y += 3;

    if (svc.items && svc.items.length > 0) {
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      y = leftText('MATERIALES / REPUESTOS', margin, y, { fs: 9, fw: 'bold', lh: 5 });
      y += 2;

      const colX = [margin + 3, margin + 90, margin + 120, margin + 140, margin + 165];
      doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      ['Descripción', 'Cant.', 'Precio', 'IVA', 'Total'].forEach((h, i) => {
        doc.text(h, colX[i], y);
      });
      y += 3;
      doc.line(margin, y, pageWidth - margin, y);
      y += 2;

      doc.setFont('helvetica', 'normal');
      svc.items.forEach(item => {
        if (y > 240) { doc.addPage(); y = 15; }
        doc.text(item.descripcion.substring(0, 40), colX[0], y);
        doc.text(String(item.cantidad), colX[1], y);
        doc.text(Utils.formatCurrency(item.precio), colX[2], y);
        doc.text(`${item.iva}%`, colX[3], y);
        doc.text(Utils.formatCurrency(item.totalPorRubro), colX[4], y);
        y += 3.5;
      });
      y += 2;
    }

    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
    y = leftText('RESUMEN DE COBRO', margin, y, { fs: 9, fw: 'bold', lh: 5 });
    y += 2;

    const summaryX = margin + 3;
    const summaryValX = pageWidth - margin - 3;
    const printLine = (label, value, bold = false) => {
      doc.setFontSize(8); doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(label, summaryX, y);
      doc.text(value, summaryValX, y, { align: 'right' });
      y += 4;
    };

    printLine('Materiales:', Utils.formatCurrency((svc.subtotal || 0) - (svc.costoServicio || 0)));
    printLine('Costo Servicio:', Utils.formatCurrency(svc.costoServicio || 0));
    printLine('Subtotal:', Utils.formatCurrency(svc.subtotal));
    if (svc.descuento > 0) printLine(`Descuento (${svc.descuento}%):`, `-${Utils.formatCurrency(svc.subtotal * svc.descuento / 100)}`);
    printLine('Base Imponible:', Utils.formatCurrency(svc.baseImponible));
    if (svc.iva16 > 0) printLine('IVA 16%:', Utils.formatCurrency(svc.iva16));
    if (svc.iva10 > 0) printLine('IVA 10%:', Utils.formatCurrency(svc.iva10));

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 3, width, 8, 'F');
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('TOTAL A COBRAR:', summaryX, y + 2);
    doc.text(Utils.formatCurrency(svc.total), summaryValX, y + 2, { align: 'right' });
    y += 10;

    if (svc.pagos && svc.pagos.length > 0) {
      y = leftText('Formas de Pago:', margin + 3, y, { fs: 8, fw: 'bold', lh: 4 });
      svc.pagos.forEach(p => {
        y = leftText(`  ${p.formaPago}: ${Utils.formatCurrency(p.monto)}${p.banco ? ` (${p.banco})` : ''}${p.referencia ? ` Ref: ${p.referencia}` : ''}`, margin + 3, y, { fs: 7, lh: 4 });
      });
      y += 3;
    }

    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    const sigWidth = width / 2 - 10;
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.line(margin + 5, y, margin + 5 + sigWidth, y);
    y += 3;
    centerText('Firma del Cliente', y, { fs: 7 });

    doc.line(pageWidth - margin - sigWidth - 5, y - 3, pageWidth - margin - 5, y - 3);
    y = centerText('Firma del Técnico', y, { fs: 7 });

    y += 8;
    centerText('¡Gracias por su preferencia!', y, { fs: 7 });
    y = centerText(config.nombreComercial || '', y + 1, { fs: 6 });

    doc.save(`Recepcion_${svc.numero}_${(clienteNombre || 'Cliente').replace(/\s/g, '_')}.pdf`);
    UI.showToast('PDF de recepción generado', 'success');
  },

  async printService(id) {
    const svc = await Storage.get(STORES.servicios, id);
    if (!svc) return;
    if (typeof window.jspdf === 'undefined') { UI.showToast('PDF no disponible. Verifica tu conexión.', 'warning'); return; }

    const { jsPDF } = window.jspdf;
    const config = Config.data;
    const paperSize = config.paperSize || '58mm';
    const formatWidth = paperSize === '80mm' ? 80 : 58;
    const doc = new jsPDF({ unit: 'mm', format: [formatWidth, 297] });
    const eq = svc.equipo || {};
    let y = 5;
    const ct = (t, yPos, o = {}) => { doc.setFontSize(o.fs || 7); doc.setFont('helvetica', o.fw || 'normal'); doc.text(t, formatWidth / 2, yPos, { align: 'center', maxWidth: formatWidth - 10 }); return yPos + (o.fs * 0.4); };

    y = ct(Utils.escapeHtml(config.nombreComercial || 'MI NEGOCIO'), y, { fs: 10, fw: 'bold' });
    y = ct(`RIF: ${Utils.escapeHtml(config.rif || 'N/A')}`, y + 1, { fs: 6 }); y += 2;
    doc.line(5, y, formatWidth - 5, y); y += 3;
    y = ct(`ORDEN DE SERVICIO #${svc.numero}`, y, { fs: 8, fw: 'bold' }); y += 1;
    doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text(`Fecha: ${Utils.formatDate(svc.createdAt)}`, 5, y); y += 3;
    const cn = svc.cliente ? (svc.cliente.nombreComercial || `${svc.cliente.nombre || ''} ${svc.cliente.apellido || ''}`) : 'Detal';
    doc.text(`Cliente: ${Utils.escapeHtml(cn)}`, 5, y); y += 3;
    doc.line(5, y, formatWidth - 5, y); y += 3;
    doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text(`EQUIPO: ${Utils.escapeHtml(eq.tipo || 'PC')} ${Utils.escapeHtml(eq.marca || '')} ${Utils.escapeHtml(eq.modelo || '')}`, 5, y); y += 3;
    doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    if (eq.serial) { doc.text(`Serial: ${Utils.escapeHtml(eq.serial)}`, 5, y); y += 3; }
    if (eq.ram) { doc.text(`RAM: ${Utils.escapeHtml(eq.ram)}`, 5, y); y += 3; }
    if (eq.procesador) { doc.text(`CPU: ${Utils.escapeHtml(eq.procesador)}`, 5, y); y += 3; }
    if (eq.discoDuro) { doc.text(`Disco: ${Utils.escapeHtml(eq.discoDuro)}`, 5, y); y += 3; }
    doc.line(5, y, formatWidth - 5, y); y += 3;
    doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text(`SERVICIO: ${Utils.escapeHtml(svc.descripcionServicio || '')}`, 5, y); y += 4;
    if (svc.items && svc.items.length > 0) {
      doc.setFontSize(6); doc.setFont('helvetica', 'normal');
      svc.items.forEach(item => {
        if (y > 250) { doc.addPage(); y = 10; }
        doc.text(`${Utils.escapeHtml(item.descripcion.substring(0, 25))}`, 5, y);
        doc.text(`x${item.cantidad}`, formatWidth - 30, y);
        doc.text(Utils.formatCurrency(item.totalPorRubro), formatWidth - 5, y, { align: 'right' });
        y += 3;
      });
    }
    doc.line(5, y, formatWidth - 5, y); y += 3;
    if (svc.costoServicio > 0) { doc.text(`Servicio: ${Utils.formatCurrency(svc.costoServicio)}`, 5, y); y += 3; }
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', 5, y); doc.text(Utils.formatCurrency(svc.total), formatWidth - 5, y, { align: 'right' });
    doc.save(`Servicio_${svc.numero}.pdf`);
    UI.showToast('PDF generado', 'success');
  },

  async shareWhatsApp(id) {
    const svc = await Storage.get(STORES.servicios, id);
    if (!svc) return;
    const config = Config.data;
    const cliente = svc.cliente || { tipo: 'detal', nombre: 'Cliente Detal' };
    const clienteNombre = cliente.tipo === 'personalizado' ? (cliente.nombreComercial || `${cliente.nombre} ${cliente.apellido}`) : 'Cliente Detal';
    const eq = svc.equipo || {};

    let msg = `*${config.nombreComercial || 'MI NEGOCIO'}*\n`;
    msg += `Orden de Servicio #${svc.numero}\n`;
    msg += `Fecha: ${Utils.formatDate(svc.createdAt)}\n`;
    msg += `Cliente: ${clienteNombre}\n`;
    msg += `Equipo: ${eq.tipo || 'PC'} ${eq.marca || ''} ${eq.modelo || ''}\n`;
    msg += `Servicio: ${svc.descripcionServicio || ''}\n`;
    msg += `─────────────\n`;
    msg += `*TOTAL: ${Utils.formatCurrency(svc.total)}*\n`;
    msg += `Estado: ${svc.estado}\n`;

    if (navigator.share) {
      try { await navigator.share({ title: `Orden #${svc.numero}`, text: msg }); } catch (e) {}
    } else {
      const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
    }
    UI.showToast('Compartiendo por WhatsApp', 'info');
  },

  confirmDelete(id) {
    const svc = this.items.find(s => s.id === id);
    UI.confirm(`¿Eliminar la orden de servicio #${svc?.numero || ''}?`, async () => {
      try { await this.remove(id); UI.showToast('Orden eliminada', 'success'); this.renderList(); }
      catch (e) { UI.showToast(e.message, 'error'); }
    });
  },

  showClienteModal() {
    const content = `
      <div class="tabs mb-4">
        <div class="tab-item active" onclick="Services.switchClienteTab('detal', this)">Cliente Detal</div>
        <div class="tab-item" onclick="Services.switchClienteTab('personalizado', this)">Cliente Personalizado</div>
      </div>
      <div id="svcClienteDetal"><div class="alert alert-info"><span>ℹ️</span> Cliente sin datos específicos.</div></div>
      <div id="svcClientePerso" class="hidden">
        <form id="svcClienteForm">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Nombre Comercial</label><input type="text" class="form-control" name="nombreComercial"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Nombre <span class="required">*</span></label><input type="text" class="form-control" name="nombre"></div>
            <div class="form-group"><label class="form-label">Apellido</label><input type="text" class="form-control" name="apellido"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Cédula</label><input type="text" class="form-control" name="cedula" placeholder="V-12345678"></div>
            <div class="form-group"><label class="form-label">RIF</label><input type="text" class="form-control" name="rif" placeholder="J-12345678-9"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Dirección</label><input type="text" class="form-control" name="direccion"></div>
            <div class="form-group"><label class="form-label">Teléfono</label><input type="text" class="form-control" name="telefono"></div>
          </div>
        </form>
      </div>
    `;
    UI.showModal('Seleccionar Cliente', content, {
      confirmText: 'Guardar',
      onConfirm: async () => {
        const tab = document.querySelector('.tabs .tab-item.active');
        const isPerso = tab && tab.textContent.includes('Personalizado');
        if (isPerso) {
          const data = UI.getFormData('svcClienteForm');
          if (!data.nombre) { UI.showToast('Nombre requerido', 'error'); return; }
          data.tipo = 'personalizado';
          await this.addCliente(data);
        } else {
          await this.addCliente({ tipo: 'detal' });
        }
        UI.closeModal();
        const nameEl = document.getElementById('serviceClienteName');
        if (nameEl) nameEl.textContent = isPerso ? (data.nombreComercial || `${data.nombre} ${data.apellido}`) : 'Cliente Detal';
      }
    });
  },

  switchClienteTab(tab, el) {
    document.querySelectorAll('.tabs .tab-item').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('svcClienteDetal').classList.toggle('hidden', tab !== 'detal');
    document.getElementById('svcClientePerso').classList.toggle('hidden', tab !== 'personalizado');
  }
};
