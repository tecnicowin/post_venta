const Suppliers = {
  items: [],

  async load() {
    this.items = await Storage.getAll(STORES.proveedores);
    this.items.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  },

  async add(data) {
    const proveedor = {
      id: Utils.generateId(),
      nombre: data.nombre || '',
      rif: data.rif || '',
      direccion: data.direccion || '',
      telefono: data.telefono || '',
      email: data.email || '',
      contacto: data.contacto || '',
      observaciones: data.observaciones || '',
      totalCompras: 0,
      cantidadCompras: 0,
      activo: true,
      createdAt: Utils.getNow(),
      updatedAt: Utils.getNow()
    };
    await Storage.add(STORES.proveedores, proveedor);
    await this.load();
    return proveedor;
  },

  async update(id, data) {
    const existing = await Storage.get(STORES.proveedores, id);
    if (!existing) throw new Error('Proveedor no encontrado');
    const updated = { ...existing, ...data, updatedAt: Utils.getNow() };
    await Storage.update(STORES.proveedores, updated);
    await this.load();
    return updated;
  },

  async remove(id) {
    await Storage.delete(STORES.proveedores, id);
    await this.load();
  },

  getById(id) {
    return this.items.find(p => p.id === id);
  },

  search(query) {
    if (!query) return this.items.filter(p => p.activo);
    const q = query.toLowerCase();
    return this.items.filter(p =>
      p.activo && (
        (p.nombre && p.nombre.toLowerCase().includes(q)) ||
        (p.rif && p.rif.toLowerCase().includes(q)) ||
        (p.telefono && p.telefono.includes(q))
      )
    );
  },

  async incrementPurchaseStats(proveedorId, monto) {
    const proveedor = await Storage.get(STORES.proveedores, proveedorId);
    if (!proveedor) return;
    proveedor.totalCompras = (proveedor.totalCompras || 0) + monto;
    proveedor.cantidadCompras = (proveedor.cantidadCompras || 0) + 1;
    proveedor.ultimaCompra = Utils.getNow();
    proveedor.updatedAt = Utils.getNow();
    await Storage.update(STORES.proveedores, proveedor);
  },

  renderPage() {
    this.renderList();
  },

  renderList() {
    const el = document.getElementById('suppliersStats');
    if (el) {
      const total = this.items.length;
      const activos = this.items.filter(p => p.activo).length;
      const totalCompras = this.items.reduce((s, p) => s + (p.totalCompras || 0), 0);
      const masCompras = this.items.length > 0
        ? this.items.reduce((a, b) => (a.cantidadCompras || 0) >= (b.cantidadCompras || 0) ? a : b)
        : null;
      el.innerHTML = `
        <div class="stat-card"><div class="stat-icon blue">🏢</div><div class="stat-info"><h3>${total}</h3><p>Total Proveedores</p></div></div>
        <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-info"><h3>${activos}</h3><p>Activos</p></div></div>
        <div class="stat-card"><div class="stat-icon yellow">💰</div><div class="stat-info"><h3>${Utils.formatCurrency(totalCompras)}</h3><p>Total Compras</p></div></div>
        <div class="stat-card"><div class="stat-icon red">🏆</div><div class="stat-info"><h3>${masCompras ? UI.escapeHtml(masCompras.nombre) : '-'}</h3><p>Más Compras</p></div></div>
      `;
    }

    UI.renderTable('suppliersTable', [
      { label: 'Nombre', render: (row) => `<div class="font-bold">${UI.escapeHtml(row.nombre)}</div>` },
      { label: 'RIF', render: (row) => UI.escapeHtml(row.rif || '-') },
      { label: 'Teléfono', render: (row) => UI.escapeHtml(row.telefono || '-') },
      { label: 'Contacto', render: (row) => UI.escapeHtml(row.contacto || '-') },
      { label: 'Compras', align: 'center', render: (row) => row.cantidadCompras || 0 },
      { label: 'Total Compras', align: 'right', render: (row) => Utils.formatCurrency(row.totalCompras || 0) },
      { label: 'Última', render: (row) => row.ultimaCompra ? Utils.formatDate(row.ultimaCompra) : '-' },
      { label: '', align: 'center', width: '120px', render: (row) => `
        <div class="flex gap-1 justify-center">
          <button class="btn btn-ghost btn-sm" onclick="Suppliers.showForm('${row.id}')" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="Suppliers.showDetail('${row.id}')" title="Detalle">👁️</button>
          <button class="btn btn-ghost btn-sm" onclick="Suppliers.confirmDelete('${row.id}')" title="Eliminar">🗑️</button>
        </div>`
    }], this.items, {
      emptyText: 'No hay proveedores registrados',
      emptyAction: "Suppliers.showForm()",
      emptyActionText: '+ Nuevo Proveedor'
    });
  },

  showForm(editId = null) {
    const prov = editId ? this.items.find(p => p.id === editId) : null;
    const title = prov ? 'Editar Proveedor' : 'Nuevo Proveedor';

    const content = `
      <form id="supplierForm">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nombre / Razón Social <span class="required">*</span></label>
            <input type="text" class="form-control" name="nombre" value="${prov ? UI.escapeHtml(prov.nombre) : ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">RIF</label>
            <input type="text" class="form-control" name="rif" value="${prov ? UI.escapeHtml(prov.rif || '') : ''}" placeholder="J-12345678-9">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Contacto</label>
            <input type="text" class="form-control" name="contacto" value="${prov ? UI.escapeHtml(prov.contacto || '') : ''}" placeholder="Nombre del contacto">
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono</label>
            <input type="text" class="form-control" name="telefono" value="${prov ? UI.escapeHtml(prov.telefono || '') : ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-control" name="email" value="${prov ? UI.escapeHtml(prov.email || '') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Dirección / Zona</label>
            <input type="text" class="form-control" name="direccion" value="${prov ? UI.escapeHtml(prov.direccion || '') : ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Observaciones</label>
          <textarea class="form-control" name="observaciones" rows="2">${prov ? UI.escapeHtml(prov.observaciones || '') : ''}</textarea>
        </div>
      </form>
    `;

    UI.showModal(title, content, {
      confirmText: prov ? 'Actualizar' : 'Crear',
      onConfirm: async () => {
        const data = UI.getFormData('supplierForm');
        if (!data.nombre) {
          UI.showToast('El nombre es requerido', 'error');
          return;
        }
        try {
          if (prov) {
            await Suppliers.update(prov.id, data);
            UI.showToast('Proveedor actualizado', 'success');
          } else {
            await Suppliers.add(data);
            UI.showToast('Proveedor creado', 'success');
          }
          UI.closeModal();
          this.renderList();
        } catch (e) {
          UI.showToast(e.message, 'error');
        }
      }
    });
  },

  async showDetail(id) {
    const prov = await Storage.get(STORES.proveedores, id);
    if (!prov) return;

    const compras = (await Storage.getAll(STORES.compras)).filter(c => c.proveedorId === id);
    compras.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

    let comprasHtml = '';
    if (compras.length > 0) {
      compras.forEach(c => {
        comprasHtml += `<tr>
          <td>${Utils.formatDate(c.fecha)}</td>
          <td>${UI.escapeHtml(c.facturaNro || '-')}</td>
          <td class="text-right">${Utils.formatCurrency(c.total)}</td>
          <td><span class="badge badge-success">${c.estado}</span></td>
        </tr>`;
      });
    } else {
      comprasHtml = '<tr><td colspan="4" class="text-center text-muted">Sin compras registradas</td></tr>';
    }

    const content = `
      <div style="font-size:13px">
        <div style="padding:12px;background:#f1f5f9;border-radius:6px;margin-bottom:16px">
          <div class="grid grid-2">
            <div>
              <div><strong>Nombre:</strong> ${UI.escapeHtml(prov.nombre)}</div>
              <div><strong>RIF:</strong> ${UI.escapeHtml(prov.rif || 'N/A')}</div>
              <div><strong>Contacto:</strong> ${UI.escapeHtml(prov.contacto || '-')}</div>
            </div>
            <div>
              <div><strong>Teléfono:</strong> ${UI.escapeHtml(prov.telefono || '-')}</div>
              <div><strong>Email:</strong> ${UI.escapeHtml(prov.email || '-')}</div>
              <div><strong>Dirección:</strong> ${UI.escapeHtml(prov.direccion || '-')}</div>
            </div>
          </div>
        </div>
        <div class="grid grid-3 mb-3">
          <div class="stat-card"><div class="stat-info"><h3>${compras.length}</h3><p>Compras</p></div></div>
          <div class="stat-card"><div class="stat-info"><h3>${Utils.formatCurrency(prov.totalCompras || 0)}</h3><p>Total Compras</p></div></div>
          <div class="stat-card"><div class="stat-info"><h3>${prov.ultimaCompra ? Utils.formatDate(prov.ultimaCompra) : '-'}</h3><p>Última Compra</p></div></div>
        </div>
        <h4 class="mb-2">Historial de Compras</h4>
        <table class="table">
          <thead><tr><th>Fecha</th><th>Factura</th><th class="text-right">Total</th><th>Estado</th></tr></thead>
          <tbody>${comprasHtml}</tbody>
        </table>
      </div>
    `;

    UI.showModal(`Proveedor: ${prov.nombre}`, content, {
      size: 'lg',
      footer: `
        <button class="btn btn-outline" onclick="UI.closeModal()">Cerrar</button>
        <button class="btn btn-info" onclick="UI.closeModal(); Suppliers.showForm('${prov.id}')">✏️ Editar</button>
      `
    });
  },

  showPicker(callback) {
    const items = this.items.filter(p => p.activo);
    let html = '';
    items.forEach(p => {
      html += `
        <div class="flex items-center justify-between" style="padding:10px;border-bottom:1px solid var(--border);cursor:pointer"
          onclick="Suppliers._pickCallback('${p.id}')">
          <div>
            <div class="font-bold">${UI.escapeHtml(p.nombre)}</div>
            <div class="text-muted" style="font-size:11px">RIF: ${UI.escapeHtml(p.rif || 'N/A')} | Tel: ${UI.escapeHtml(p.telefono || '-')}</div>
          </div>
          <div class="text-right">
            <div class="text-muted" style="font-size:11px">Compras: ${p.cantidadCompras || 0}</div>
          </div>
        </div>`;
    });
    if (items.length === 0) {
      html = '<div class="empty-state"><p>No hay proveedores. Crea uno nuevo.</p></div>';
    }

    this._pickCallback = (id) => {
      UI.closeModal();
      const prov = this.getById(id);
      if (prov && callback) callback(prov);
    };

    const content = `
      <div class="search-box mb-3" style="max-width:100%">
        <span class="icon">🔍</span>
        <input type="text" class="form-control" placeholder="Buscar proveedor..." id="supplierSearchInput"
          oninput="Suppliers.filterPicker(this.value)" style="padding-left:36px">
      </div>
      <div id="supplierPickerList" style="max-height:400px;overflow-y:auto">
        ${html}
      </div>
    `;

    UI.showModal('Seleccionar Proveedor', content, {
      footer: `<button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
               <button class="btn btn-primary" onclick="UI.closeModal(); Suppliers.showForm()">+ Nuevo Proveedor</button>`
    });
  },

  filterPicker(query) {
    const items = this.search(query);
    let html = '';
    items.forEach(p => {
      html += `
        <div class="flex items-center justify-between" style="padding:10px;border-bottom:1px solid var(--border);cursor:pointer"
          onclick="Suppliers._pickCallback('${p.id}')">
          <div>
            <div class="font-bold">${UI.escapeHtml(p.nombre)}</div>
            <div class="text-muted" style="font-size:11px">RIF: ${UI.escapeHtml(p.rif || 'N/A')} | Tel: ${UI.escapeHtml(p.telefono || '-')}</div>
          </div>
          <div class="text-right">
            <div class="text-muted" style="font-size:11px">Compras: ${p.cantidadCompras || 0}</div>
          </div>
        </div>`;
    });
    if (items.length === 0) html = '<div class="empty-state"><p>No se encontraron proveedores</p></div>';
    document.getElementById('supplierPickerList').innerHTML = html;
  },

  confirmDelete(id) {
    const prov = this.items.find(p => p.id === id);
    UI.confirm(`¿Eliminar el proveedor "${prov?.nombre}"?`, async () => {
      try {
        await this.remove(id);
        UI.showToast('Proveedor eliminado', 'success');
        this.renderList();
      } catch (e) {
        UI.showToast(e.message, 'error');
      }
    });
  }
};
