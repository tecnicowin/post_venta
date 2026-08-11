const Clientes = {
  items: [],
  filteredItems: [],

  async load() {
    this.items = await Storage.getAll(STORES.clientes);
    this.items.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    this.filteredItems = [...this.items];
  },

  async add(data) {
    const existente = this.items.find(c =>
      c.activo && data.cedula && c.cedula && c.cedula === data.cedula
    );
    if (existente) {
      throw new Error(`Ya existe un cliente con cédula: ${existente.nombre}`);
    }
    const cliente = {
      id: Utils.generateId(),
      tipo: data.tipo || 'personalizado',
      nombre: data.nombre || '',
      apellido: data.apellido || '',
      nombreComercial: data.nombreComercial || '',
      cedula: data.cedula || '',
      rif: data.rif || '',
      direccion: data.direccion || '',
      zona: data.zona || '',
      telefono: data.telefono || '',
      email: data.email || '',
      activo: true,
      createdAt: Utils.getNow()
    };
    await Storage.add(STORES.clientes, cliente);
    await this.load();
    return cliente;
  },

  async update(id, data) {
    const existing = await Storage.get(STORES.clientes, id);
    if (!existing) throw new Error('Cliente no encontrado');
    if (data.cedula && data.cedula !== existing.cedula) {
      const duplicado = this.items.find(c => c.cedula === data.cedula && c.id !== id && c.activo);
      if (duplicado) throw new Error('Ya existe otro cliente con esa cédula');
    }
    const updated = { ...existing, ...data };
    await Storage.update(STORES.clientes, updated);
    await this.load();
    return updated;
  },

  async remove(id) {
    await Storage.delete(STORES.clientes, id);
    await this.load();
  },

  getById(id) {
    return this.items.find(c => c.id === id);
  },

  filter(query) {
    if (!query) {
      this.filteredItems = [...this.items];
    } else {
      const q = query.toLowerCase();
      this.filteredItems = this.items.filter(c =>
        (c.nombre && c.nombre.toLowerCase().includes(q)) ||
        (c.apellido && c.apellido.toLowerCase().includes(q)) ||
        (c.cedula && c.cedula.toLowerCase().includes(q)) ||
        (c.rif && c.rif.toLowerCase().includes(q)) ||
        (c.nombreComercial && c.nombreComercial.toLowerCase().includes(q)) ||
        (c.telefono && c.telefono.includes(q))
      );
    }
    this.renderTable();
  },

  renderPage() {
    this.renderStats();
    this.renderTable();
  },

  renderStats() {
    const total = this.items.length;
    const activos = this.items.filter(c => c.activo).length;
    const el = document.getElementById('clientesStats');
    if (el) {
      el.innerHTML = `
        <div class="stat-card"><div class="stat-icon blue">👤</div><div class="stat-info"><h3>${total}</h3><p>Total Clientes</p></div></div>
        <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-info"><h3>${activos}</h3><p>Activos</p></div></div>
      `;
    }
  },

  renderTable() {
    UI.renderTable('clientesTable', [
      { label: 'Nombre', render: (row) => {
        const nombre = row.tipo === 'personalizado' ?
          (row.nombreComercial || `${row.nombre || ''} ${row.apellido || ''}`.trim()) :
          'Cliente Detal';
        return `<div class="font-bold">${UI.escapeHtml(nombre)}</div>`;
      }},
      { label: 'Cédula', render: (row) => UI.escapeHtml(row.cedula || '-') },
      { label: 'RIF', render: (row) => UI.escapeHtml(row.rif || '-') },
      { label: 'Teléfono', render: (row) => UI.escapeHtml(row.telefono || '-') },
      { label: 'Email', render: (row) => UI.escapeHtml(row.email || '-') },
      { label: 'Dirección', render: (row) => UI.escapeHtml(row.direccion || '-') },
      { label: 'Estado', align: 'center', render: (row) => `<span class="badge badge-${row.activo ? 'success' : 'danger'}">${row.activo ? 'Activo' : 'Inactivo'}</span>` },
      { label: '', align: 'center', width: '120px', render: (row) => `
        <div class="flex gap-1 justify-center">
          <button class="btn btn-ghost btn-sm" onclick="Clientes.showForm('${row.id}')" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="Clientes.confirmDelete('${row.id}')" title="Eliminar">🗑️</button>
        </div>`
    }], this.filteredItems, {
      emptyText: 'No hay clientes registrados',
      emptyAction: "Clientes.showForm()",
      emptyActionText: '+ Nuevo Cliente'
    });
  },

  showForm(editId = null) {
    const cliente = editId ? this.items.find(c => c.id === editId) : null;
    const title = cliente ? 'Editar Cliente' : 'Nuevo Cliente';

    const content = `
      <form id="clienteCrudForm">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nombre Comercial (Empresa)</label>
            <input type="text" class="form-control" name="nombreComercial" value="${cliente ? UI.escapeHtml(cliente.nombreComercial || '') : ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nombre <span class="required">*</span></label>
            <input type="text" class="form-control" name="nombre" value="${cliente ? UI.escapeHtml(cliente.nombre || '') : ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Apellido</label>
            <input type="text" class="form-control" name="apellido" value="${cliente ? UI.escapeHtml(cliente.apellido || '') : ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Cédula</label>
            <input type="text" class="form-control" name="cedula" value="${cliente ? UI.escapeHtml(cliente.cedula || '') : ''}" placeholder="V-12345678">
          </div>
          <div class="form-group">
            <label class="form-label">RIF</label>
            <input type="text" class="form-control" name="rif" value="${cliente ? UI.escapeHtml(cliente.rif || '') : ''}" placeholder="J-12345678-9">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Teléfono</label>
            <input type="text" class="form-control" name="telefono" value="${cliente ? UI.escapeHtml(cliente.telefono || '') : ''}" placeholder="0412-1234567">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-control" name="email" value="${cliente ? UI.escapeHtml(cliente.email || '') : ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Dirección / Zona</label>
            <input type="text" class="form-control" name="direccion" value="${cliente ? UI.escapeHtml(cliente.direccion || '') : ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <div class="flex items-center gap-2 mt-2">
            <input type="checkbox" name="activo" id="clienteActivo" ${!cliente || cliente.activo ? 'checked' : ''}>
            <label for="clienteActivo">Activo</label>
          </div>
        </div>
      </form>
    `;

    UI.showModal(title, content, {
      size: 'lg',
      confirmText: cliente ? 'Actualizar' : 'Crear',
      onConfirm: async () => {
        const data = UI.getFormData('clienteCrudForm');
        if (!data.nombre) { UI.showToast('El nombre es requerido', 'error'); return; }
        data.tipo = 'personalizado';
        data.activo = document.getElementById('clienteActivo').checked;
        try {
          if (cliente) {
            await Clientes.update(cliente.id, data);
            UI.showToast('Cliente actualizado', 'success');
          } else {
            await Clientes.add(data);
            UI.showToast('Cliente creado', 'success');
          }
          UI.closeModal();
          this.renderPage();
        } catch (e) {
          UI.showToast(e.message, 'error');
        }
      }
    });
  },

  confirmDelete(id) {
    const cliente = this.items.find(c => c.id === id);
    UI.confirm(`¿Eliminar el cliente "${cliente?.nombre}"?`, async () => {
      try {
        await this.remove(id);
        UI.showToast('Cliente eliminado', 'success');
        this.renderPage();
      } catch (e) {
        UI.showToast(e.message, 'error');
      }
    });
  },

  showPicker(callback) {
    const clientes = this.items.filter(c => c.activo);

    let html = '';
    clientes.forEach(c => {
      const nombre = c.tipo === 'personalizado' ?
        (c.nombreComercial || `${c.nombre || ''} ${c.apellido || ''}`.trim()) :
        'Cliente Detal';
      html += `
        <div class="flex items-center justify-between" style="padding:10px;border-bottom:1px solid var(--border);cursor:pointer"
          data-cliente-id="${c.id}">
          <div>
            <div class="font-bold">${UI.escapeHtml(nombre)}</div>
            <div class="text-muted" style="font-size:11px">
              ${c.cedula ? 'C.I.: ' + UI.escapeHtml(c.cedula) : ''} ${c.rif ? 'RIF: ' + UI.escapeHtml(c.rif) : ''}
            </div>
          </div>
          <div class="text-muted" style="font-size:11px">${UI.escapeHtml(c.telefono || '')}</div>
        </div>`;
    });

    if (clientes.length === 0) {
      html = '<div class="empty-state"><p>No hay clientes registrados. Crea uno nuevo.</p></div>';
    }

    const content = `
      <div class="search-box mb-3" style="max-width:100%">
        <span class="icon">🔍</span>
        <input type="text" class="form-control" placeholder="Buscar cliente..." id="clienteSearchInput" style="padding-left:36px">
      </div>
      <div id="clientePickerList" style="max-height:400px;overflow-y:auto">
        ${html}
      </div>
    `;

    UI.showModal('Seleccionar Cliente', content, { footer: false, size: 'lg' });

    const searchInput = document.getElementById('clienteSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = clientes.filter(c =>
          (c.nombre && c.nombre.toLowerCase().includes(q)) ||
          (c.apellido && c.apellido.toLowerCase().includes(q)) ||
          (c.cedula && c.cedula.toLowerCase().includes(q)) ||
          (c.rif && c.rif.toLowerCase().includes(q)) ||
          (c.nombreComercial && c.nombreComercial.toLowerCase().includes(q))
        );
        let filteredHtml = '';
        filtered.forEach(c => {
          const nombre = c.tipo === 'personalizado' ?
            (c.nombreComercial || `${c.nombre || ''} ${c.apellido || ''}`.trim()) :
            'Cliente Detal';
          filteredHtml += `
            <div class="flex items-center justify-between" style="padding:10px;border-bottom:1px solid var(--border);cursor:pointer"
              data-cliente-id="${c.id}">
              <div>
                <div class="font-bold">${UI.escapeHtml(nombre)}</div>
                <div class="text-muted" style="font-size:11px">
                  ${c.cedula ? 'C.I.: ' + UI.escapeHtml(c.cedula) : ''} ${c.rif ? 'RIF: ' + UI.escapeHtml(c.rif) : ''}
                </div>
              </div>
              <div class="text-muted" style="font-size:11px">${UI.escapeHtml(c.telefono || '')}</div>
            </div>`;
        });
        if (filtered.length === 0) filteredHtml = '<div class="text-center text-muted" style="padding:20px">No se encontraron clientes</div>';
        document.getElementById('clientePickerList').innerHTML = filteredHtml;
      });
    }

    const pickerList = document.getElementById('clientePickerList');
    if (pickerList) {
      pickerList.addEventListener('click', (e) => {
        const item = e.target.closest('[data-cliente-id]');
        if (item) {
          const cliente = Clientes.getById(item.dataset.clienteId);
          if (cliente) {
            UI.closeModal();
            callback(cliente);
          }
        }
      });
    }
  }
};
