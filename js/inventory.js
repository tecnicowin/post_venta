const Inventory = {
  items: [],
  filteredItems: [],
  currentFilter: '',

  async load() {
    this.items = await Storage.getAll(STORES.productos);
    this.items.sort((a, b) => a.descripcion.localeCompare(b.descripcion));
    this.filteredItems = [...this.items];
  },

  async add(data) {
    const producto = {
      id: Utils.generateId(),
      descripcion: data.descripcion,
      categoriaId: data.categoriaId || '',
      tipo: data.tipo || '',
      codigoBarras: data.codigoBarras || '',
      cantidadExistencia: parseFloat(data.cantidadExistencia) || 0,
      stockMinimo: parseFloat(data.stockMinimo) || 0,
      entradas: parseFloat(data.entradas) || 0,
      salidas: parseFloat(data.salidas) || 0,
      costoCompra: parseFloat(data.costoCompra) || 0,
      margenGanancia: parseFloat(data.margenGanancia) || 0,
      precioMayor: parseFloat(data.precioMayor) || 0,
      precioDetal: parseFloat(data.precioDetal) || 0,
      iva: data.iva || '16',
      activo: true,
      fechaCreacion: Utils.getNow(),
      fechaModificacion: Utils.getNow()
    };
    await Storage.add(STORES.productos, producto);
    await this.load();
    return producto;
  },

  async update(id, data) {
    const existing = await Storage.get(STORES.productos, id);
    if (!existing) throw new Error('Producto no encontrado');
    const updated = {
      ...existing,
      ...data,
      codigoBarras: data.codigoBarras !== undefined ? data.codigoBarras : existing.codigoBarras,
      cantidadExistencia: parseFloat(data.cantidadExistencia) || existing.cantidadExistencia,
      stockMinimo: parseFloat(data.stockMinimo) || 0,
      costoCompra: parseFloat(data.costoCompra) || existing.costoCompra || 0,
      margenGanancia: parseFloat(data.margenGanancia) || existing.margenGanancia || 0,
      precioMayor: parseFloat(data.precioMayor) || 0,
      precioDetal: parseFloat(data.precioDetal) || 0,
      fechaModificacion: Utils.getNow()
    };
    await Storage.update(STORES.productos, updated);
    await this.load();
    return updated;
  },

  async remove(id) {
    await Storage.delete(STORES.productos, id);
    await this.load();
  },

  async toggleActive(id) {
    const product = this.items.find(p => p.id === id);
    if (product) {
      product.activo = !product.activo;
      product.fechaModificacion = Utils.getNow();
      await Storage.update(STORES.productos, product);
      await this.load();
    }
  },

  async addEntry(id, quantity) {
    const product = this.items.find(p => p.id === id);
    if (!product) throw new Error('Producto no encontrado');
    product.cantidadExistencia += parseFloat(quantity);
    product.entradas += parseFloat(quantity);
    product.fechaModificacion = Utils.getNow();
    await Storage.update(STORES.productos, product);
    await this.load();
    return product;
  },

  async addExit(id, quantity) {
    const product = this.items.find(p => p.id === id);
    if (!product) throw new Error('Producto no encontrado');
    const qty = parseFloat(quantity);
    if (product.cantidadExistencia < qty) {
      throw new Error(`Stock insuficiente. Disponible: ${product.cantidadExistencia}`);
    }
    product.cantidadExistencia -= qty;
    product.salidas += qty;
    product.fechaModificacion = Utils.getNow();
    await Storage.update(STORES.productos, product);
    await this.load();
    return product;
  },

  getById(id) {
    return this.items.find(p => p.id === id);
  },

  filter(query) {
    this.currentFilter = query;
    if (!query) {
      this.filteredItems = [...this.items];
    } else {
      const q = query.toLowerCase();
      this.filteredItems = this.items.filter(p =>
        p.descripcion.toLowerCase().includes(q) ||
        (p.tipo && p.tipo.toLowerCase().includes(q)) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(q)) ||
        (p.categoriaId && this.getCatName(p.categoriaId).toLowerCase().includes(q))
      );
    }
    this.renderTable();
  },

  getCatName(catId) {
    const cat = Categories.items.find(c => c.id === catId);
    return cat ? cat.nombre : '';
  },

  filterByCategory(categoryId) {
    if (!categoryId) {
      this.filteredItems = [...this.items];
    } else {
      this.filteredItems = this.items.filter(p => p.categoriaId === categoryId);
    }
    this.currentFilter = categoryId;
    this.renderTable();
  },

  renderList() {
    this.renderTable();
    this.renderStats();
    this.updateCategoryFilter();
  },

  updateCategoryFilter() {
    const select = document.getElementById('categoryFilter');
    if (!select) return;
    select.innerHTML = '<option value="">Todas las categorías</option>';
    Categories.items.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.nombre;
      select.appendChild(option);
    });
  },

  renderTable() {
    const data = this.currentFilter ? this.filteredItems : this.items;
    UI.renderTable('inventoryTable', [
      { label: 'Descripción', key: 'descripcion', render: (row) => `
        <div>
          <div class="font-bold">${UI.escapeHtml(row.descripcion)}</div>
          ${row.codigoBarras ? `<div style="font-size:11px;color:var(--primary);font-family:monospace">📋 ${UI.escapeHtml(row.codigoBarras)}</div>` : ''}
          ${row.tipo ? `<div class="text-muted" style="font-size:11px">${UI.escapeHtml(row.tipo)}</div>` : ''}
        </div>`
      },
      { label: 'Categoría', render: (row) => {
        const cat = Categories.items.find(c => c.id === row.categoriaId);
        return cat ? `<span class="chip" style="border-color:${cat.color};background:${cat.color}15;color:${cat.color}">${UI.escapeHtml(cat.nombre)}</span>` : '<span class="text-muted">-</span>';
      }},
      { label: 'Stock', key: 'cantidadExistencia', align: 'center', render: (row) => {
        const isLow = row.stockMinimo > 0 && row.cantidadExistencia <= row.stockMinimo;
        return `<span class="${isLow ? 'text-danger font-bold' : ''}">${row.cantidadExistencia}</span>`;
      }},
      { label: 'Entradas', key: 'entradas', align: 'center' },
      { label: 'Salidas', key: 'salidas', align: 'center' },
      { label: 'Costo', key: 'costoCompra', align: 'right', render: (row) => Utils.formatCurrency(row.costoCompra || 0) },
      { label: 'Ganancia', key: 'margenGanancia', align: 'center', render: (row) => row.margenGanancia ? `${row.margenGanancia}%` : '-' },
      { label: 'P. Mayor', key: 'precioMayor', align: 'right', render: (row) => Utils.formatCurrency(row.precioMayor) },
      { label: 'P. Detal', key: 'precioDetal', align: 'right', render: (row) => Utils.formatCurrency(row.precioDetal) },
      { label: 'IVA', key: 'iva', align: 'center', render: (row) => `<span class="badge badge-${row.iva == '0' ? 'success' : row.iva == '10' ? 'warning' : 'info'}">${row.iva}%</span>` },
      { label: '', align: 'center', width: '140px', render: (row) => `
        <div class="flex gap-1 justify-center">
          <button class="btn btn-ghost btn-sm" onclick="Inventory.showEntryModal('${row.id}')" title="Entrada">📥</button>
          <button class="btn btn-ghost btn-sm" onclick="Inventory.showExitModal('${row.id}')" title="Salida">📤</button>
          <button class="btn btn-ghost btn-sm" onclick="Inventory.showForm('${row.id}')" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="Inventory.confirmDelete('${row.id}')" title="Eliminar">🗑️</button>
        </div>`
    }], data, {
      emptyText: 'No hay productos en el inventario',
      emptyAction: "Inventory.showForm()",
      emptyActionText: '+ Nuevo Producto'
    });
  },

  renderStats() {
    const total = this.items.length;
    const active = this.items.filter(p => p.activo).length;
    const lowStock = this.items.filter(p => p.activo && p.stockMinimo > 0 && p.cantidadExistencia <= p.stockMinimo).length;
    const totalValue = this.items.reduce((sum, p) => sum + (p.cantidadExistencia * p.precioDetal), 0);

    const statsEl = document.getElementById('inventoryStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="stat-card"><div class="stat-icon blue">📦</div><div class="stat-info"><h3>${total}</h3><p>Total Productos</p></div></div>
        <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-info"><h3>${active}</h3><p>Activos</p></div></div>
        <div class="stat-card"><div class="stat-icon red">⚠️</div><div class="stat-info"><h3>${lowStock}</h3><p>Stock Bajo</p></div></div>
        <div class="stat-card"><div class="stat-icon yellow">💰</div><div class="stat-info"><h3>${Utils.formatCurrency(totalValue)}</h3><p>Valor Total</p></div></div>
      `;
    }
  },

  showForm(editId = null) {
    const product = editId ? this.items.find(p => p.id === editId) : null;
    const title = product ? 'Editar Producto' : 'Nuevo Producto';

    const content = `
      <form id="productForm">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Código <span class="required">*</span></label>
            <input type="text" class="form-control" name="codigoBarras" value="${product ? UI.escapeHtml(product.codigoBarras || '') : ''}" placeholder="Código del producto para buscar">
          </div>
          <div class="form-group">
            <label class="form-label">Tipo</label>
            <input type="text" class="form-control" name="tipo" value="${product ? UI.escapeHtml(product.tipo || '') : ''}" placeholder="Ej: Alimento, Bebida...">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Descripción <span class="required">*</span></label>
          <input type="text" class="form-control" name="descripcion" value="${product ? UI.escapeHtml(product.descripcion) : ''}" required>
        </div>
          <div class="form-group">
            <label class="form-label">Categoría</label>
            <select class="form-control" name="categoriaId" id="productCategory">
              <option value="">Sin categoría</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">IVA</label>
            <select class="form-control" name="iva">
              <option value="16" ${product && product.iva == '16' ? 'selected' : ''}>16%</option>
              <option value="10" ${product && product.iva == '10' ? 'selected' : ''}>10%</option>
              <option value="0" ${product && product.iva == '0' ? 'selected' : ''}>0% (Exento)</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Cantidad en Existencia</label>
            <input type="number" class="form-control" name="cantidadExistencia" value="${product ? product.cantidadExistencia : 0}" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Stock Mínimo</label>
            <input type="number" class="form-control" name="stockMinimo" value="${product ? product.stockMinimo : 0}" min="0">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Costo de Compra ($)</label>
            <input type="number" class="form-control" name="costoCompra" value="${product ? product.costoCompra || '' : ''}" step="0.01" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Margen de Ganancia (%)</label>
            <input type="number" class="form-control" name="margenGanancia" value="${product ? product.margenGanancia || 0 : 0}" step="1" min="0" max="500">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Precio Mayor ($)</label>
            <input type="number" class="form-control" name="precioMayor" value="${product ? product.precioMayor : ''}" step="0.01" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Precio Detal ($)</label>
            <input type="number" class="form-control" name="precioDetal" value="${product ? product.precioDetal : ''}" step="0.01" min="0">
          </div>
        </div>
      </form>
    `;

    UI.showModal(title, content, {
      size: 'lg',
      confirmText: product ? 'Actualizar' : 'Crear',
      onConfirm: async () => {
        const data = UI.getFormData('productForm');
        if (!data.descripcion) {
          UI.showToast('La descripción es requerida', 'error');
          return;
        }
        try {
          if (product) {
            await Inventory.update(product.id, data);
            UI.showToast('Producto actualizado', 'success');
          } else {
            await Inventory.add(data);
            UI.showToast('Producto creado', 'success');
          }
          UI.closeModal();
          await Inventory.renderList();
        } catch (e) {
          UI.showToast(e.message, 'error');
        }
      }
    });

    setTimeout(() => Categories.renderSelectOptions('productCategory', product ? product.categoriaId : ''), 100);
  },

  showEntryModal(id) {
    const product = this.items.find(p => p.id === id);
    if (!product) return;

    const content = `
      <div class="mb-3">
        <strong>${UI.escapeHtml(product.descripcion)}</strong>
        <div class="text-muted">Stock actual: ${product.cantidadExistencia}</div>
      </div>
      <form id="entryForm">
        <div class="form-group">
          <label class="form-label">Cantidad a ingresar <span class="required">*</span></label>
          <input type="number" class="form-control" name="cantidad" min="1" required autofocus>
        </div>
      </form>
    `;

    UI.showModal('Registrar Entrada', content, {
      size: 'sm',
      confirmText: 'Confirmar Entrada',
      onConfirm: async () => {
        const data = UI.getFormData('entryForm');
        if (!data.cantidad || data.cantidad <= 0) {
          UI.showToast('Ingrese una cantidad válida', 'error');
          return;
        }
        try {
          await Inventory.addEntry(id, data.cantidad);
          UI.showToast(`+${data.cantidad} unidades agregadas`, 'success');
          UI.closeModal();
          await Inventory.renderList();
        } catch (e) {
          UI.showToast(e.message, 'error');
        }
      }
    });
  },

  showExitModal(id) {
    const product = this.items.find(p => p.id === id);
    if (!product) return;

    const content = `
      <div class="mb-3">
        <strong>${UI.escapeHtml(product.descripcion)}</strong>
        <div class="text-muted">Stock actual: ${product.cantidadExistencia}</div>
      </div>
      <form id="exitForm">
        <div class="form-group">
          <label class="form-label">Cantidad a retirar <span class="required">*</span></label>
          <input type="number" class="form-control" name="cantidad" min="1" max="${product.cantidadExistencia}" required autofocus>
        </div>
      </form>
    `;

    UI.showModal('Registrar Salida', content, {
      size: 'sm',
      confirmText: 'Confirmar Salida',
      onConfirm: async () => {
        const data = UI.getFormData('exitForm');
        if (!data.cantidad || data.cantidad <= 0) {
          UI.showToast('Ingrese una cantidad válida', 'error');
          return;
        }
        try {
          await Inventory.addExit(id, data.cantidad);
          UI.showToast(`-${data.cantidad} unidades retiradas`, 'success');
          UI.closeModal();
          await Inventory.renderList();
        } catch (e) {
          UI.showToast(e.message, 'error');
        }
      }
    });
  },

  confirmDelete(id) {
    const product = this.items.find(p => p.id === id);
    UI.confirm(`¿Eliminar el producto "${product.descripcion}"?`, async () => {
      try {
        await Inventory.remove(id);
        UI.showToast('Producto eliminado', 'success');
        await Inventory.renderList();
      } catch (e) {
        UI.showToast(e.message, 'error');
      }
    });
  }
};
