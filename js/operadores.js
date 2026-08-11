const Operadores = {
  items: [],
  current: null,

  async load() {
    this.items = await Storage.getAll(STORES.operadores);
    this.current = this.loadSession();
  },

  loadSession() {
    const data = localStorage.getItem('pdv_operator');
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      const op = this.items.find(o => o.id === parsed.id && o.activo);
      return op || null;
    } catch { return null; }
  },

  saveSession(operator) {
    localStorage.setItem('pdv_operator', JSON.stringify({ id: operator.id }));
    this.current = operator;
  },

  logout() {
    localStorage.removeItem('pdv_operator');
    this.current = null;
  },

  isLoggedIn() {
    return this.current !== null;
  },

  isAdmin() {
    return this.current && this.current.rol === 'admin';
  },

  canAccess(module) {
    if (this.isAdmin()) return true;
    const allowed = ['dashboard', 'invoice', 'servicios'];
    return allowed.includes(module);
  },

  async add(data) {
    const existente = this.items.find(o => o.pin === data.pin && o.activo);
    if (existente) {
      throw new Error(`Ya existe un operador con ese PIN: ${existente.nombre}`);
    }
    const operador = {
      id: Utils.generateId(),
      nombre: data.nombre || '',
      pin: data.pin || '',
      rol: data.rol || 'operador',
      activo: true,
      createdAt: Utils.getNow(),
      updatedAt: Utils.getNow()
    };
    await Storage.add(STORES.operadores, operador);
    await this.load();
    return operador;
  },

  async update(id, data) {
    const existing = await Storage.get(STORES.operadores, id);
    if (!existing) throw new Error('Operador no encontrado');
    if (data.pin && data.pin !== existing.pin) {
      const duplicado = this.items.find(o => o.pin === data.pin && o.id !== id && o.activo);
      if (duplicado) throw new Error('Ya existe otro operador con ese PIN');
    }
    const updated = { ...existing, ...data, updatedAt: Utils.getNow() };
    await Storage.update(STORES.operadores, updated);
    await this.load();
    return updated;
  },

  async remove(id) {
    const op = this.items.find(o => o.id === id);
    if (op && op.rol === 'admin' && this.items.filter(o => o.rol === 'admin' && o.activo).length <= 1) {
      throw new Error('No se puede eliminar: es el último administrador');
    }
    await Storage.delete(STORES.operadores, id);
    await this.load();
  },

  getById(id) {
    return this.items.find(o => o.id === id);
  },

  async validatePin(pin) {
    const operador = this.items.find(o => o.pin === pin && o.activo);
    return operador || null;
  },

  async validateAdminPin(pin) {
    const operador = this.items.find(o => o.pin === pin && o.rol === 'admin' && o.activo);
    return operador || null;
  },

  renderPage() {
    this.renderList();
  },

  renderList() {
    const el = document.getElementById('operadoresStats');
    if (el) {
      const total = this.items.length;
      const admins = this.items.filter(o => o.rol === 'admin').length;
      const ops = this.items.filter(o => o.rol === 'operador').length;
      el.innerHTML = `
        <div class="stat-card"><div class="stat-icon blue">👤</div><div class="stat-info"><h3>${total}</h3><p>Total Operadores</p></div></div>
        <div class="stat-card"><div class="stat-icon green">🛡️</div><div class="stat-info"><h3>${admins}</h3><p>Administradores</p></div></div>
        <div class="stat-card"><div class="stat-icon yellow">🧑‍💼</div><div class="stat-info"><h3>${ops}</h3><p>Operadores</p></div></div>
      `;
    }

    UI.renderTable('operadoresTable', [
      { label: 'Nombre', render: (row) => `<div class="font-bold">${UI.escapeHtml(row.nombre)}</div>` },
      { label: 'PIN', render: (row) => '•'.repeat(row.pin.length) },
      { label: 'Rol', align: 'center', render: (row) => {
        return `<span class="badge badge-${row.rol === 'admin' ? 'success' : 'info'}">${row.rol === 'admin' ? 'Administrador' : 'Operador'}</span>`;
      }},
      { label: 'Estado', align: 'center', render: (row) => `<span class="badge badge-${row.activo ? 'success' : 'danger'}">${row.activo ? 'Activo' : 'Inactivo'}</span>` },
      { label: '', align: 'center', width: '120px', render: (row) => `
        <div class="flex gap-1 justify-center">
          <button class="btn btn-ghost btn-sm" onclick="Operadores.showForm('${row.id}')" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="Operadores.confirmDelete('${row.id}')" title="Eliminar">🗑️</button>
        </div>`
    }], this.items, {
      emptyText: 'No hay operadores registrados',
      emptyAction: "Operadores.showForm()",
      emptyActionText: '+ Nuevo Operador'
    });
  },

  showForm(editId = null) {
    const op = editId ? this.items.find(o => o.id === editId) : null;
    const title = op ? 'Editar Operador' : 'Nuevo Operador';

    const content = `
      <form id="operatorForm">
        <div class="form-group">
          <label class="form-label">Nombre <span class="required">*</span></label>
          <input type="text" class="form-control" name="nombre" value="${op ? UI.escapeHtml(op.nombre) : ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">PIN <span class="required">*</span></label>
          <input type="password" class="form-control" name="pin" value="${op ? op.pin : ''}" placeholder="4-6 dígitos" required minlength="4" maxlength="6" pattern="[0-9]{4,6}">
          <div class="form-hint">PIN de 4 a 6 dígitos numéricos</div>
        </div>
        <div class="form-group">
          <label class="form-label">Rol <span class="required">*</span></label>
          <select class="form-control" name="rol" required>
            <option value="operador" ${op && op.rol === 'operador' ? 'selected' : ''}>Operador (Solo Facturación)</option>
            <option value="admin" ${op && op.rol === 'admin' ? 'selected' : ''}>Administrador (Acceso Total)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <div class="flex items-center gap-2 mt-2">
            <input type="checkbox" name="activo" id="opActivo" ${!op || op.activo ? 'checked' : ''}>
            <label for="opActivo">Activo</label>
          </div>
        </div>
      </form>
    `;

    UI.showModal(title, content, {
      confirmText: op ? 'Actualizar' : 'Crear',
      onConfirm: async () => {
        const data = UI.getFormData('operatorForm');
        if (!data.nombre) { UI.showToast('El nombre es requerido', 'error'); return; }
        if (!data.pin) { UI.showToast('El PIN es requerido', 'error'); return; }
        if (data.pin.length < 4) { UI.showToast('El PIN debe tener al menos 4 dígitos', 'error'); return; }
        data.activo = document.getElementById('opActivo').checked;
        try {
          if (op) {
            await Operadores.update(op.id, data);
            UI.showToast('Operador actualizado', 'success');
          } else {
            await Operadores.add(data);
            UI.showToast('Operador creado', 'success');
          }
          UI.closeModal();
          this.renderList();
        } catch (e) {
          UI.showToast(e.message, 'error');
        }
      }
    });
  },

  confirmDelete(id) {
    const op = this.items.find(o => o.id === id);
    UI.confirm(`¿Eliminar el operador "${op?.nombre}"?`, async () => {
      try {
        await this.remove(id);
        UI.showToast('Operador eliminado', 'success');
        this.renderList();
      } catch (e) {
        UI.showToast(e.message, 'error');
      }
    });
  },

  showLogin() {
    const content = `
      <div class="text-center" style="padding:20px 0">
        <div style="font-size:48px;margin-bottom:16px">🔐</div>
        <h2 style="margin-bottom:8px">Iniciar Sesión</h2>
        <p class="text-muted mb-4">Ingresa tu PIN para acceder al sistema</p>
        <form id="loginForm" onsubmit="Operadores.processLogin(event)">
          <div class="form-group" style="max-width:200px;margin:0 auto">
            <input type="password" class="form-control text-center" id="loginPin" placeholder="PIN"
              style="font-size:24px;letter-spacing:8px;padding:12px" autofocus maxlength="6" inputmode="numeric" pattern="[0-9]*">
          </div>
          <div id="loginError" style="color:var(--danger);margin-top:8px;min-height:20px"></div>
          <button type="submit" class="btn btn-primary btn-lg mt-3" style="min-width:200px">Ingresar</button>
        </form>
      </div>
    `;

    UI.showModal('Acceso al Sistema', content, { footer: false, size: 'sm' });

    setTimeout(() => {
      const pinInput = document.getElementById('loginPin');
      if (pinInput) pinInput.focus();
    }, 300);
  },

  async processLogin(e) {
    e.preventDefault();
    const pin = document.getElementById('loginPin').value.trim();
    const errorEl = document.getElementById('loginError');

    if (!pin) {
      errorEl.textContent = 'Ingresa tu PIN';
      return;
    }

    const operador = await this.validatePin(pin);
    if (!operador) {
      errorEl.textContent = 'PIN incorrecto';
      document.getElementById('loginPin').value = '';
      document.getElementById('loginPin').focus();
      return;
    }

    this.saveSession(operador);
    UI.closeModal();
    UI.showToast(`Bienvenido, ${operador.nombre}`, 'success');
    App.applyRoleAccess();
    App.renderDashboard();
  },

  showAdminPinModal(callback) {
    const content = `
      <div class="text-center" style="padding:10px 0">
        <div style="font-size:36px;margin-bottom:12px">🛡️</div>
        <p class="mb-3">Se requiere PIN de administrador para esta acción</p>
        <form id="adminPinForm" onsubmit="Operadores.processAdminPin(event)">
          <div class="form-group" style="max-width:180px;margin:0 auto">
            <input type="password" class="form-control text-center" id="adminPinInput" placeholder="PIN Admin"
              style="font-size:20px;letter-spacing:6px;padding:10px" maxlength="6" inputmode="numeric" pattern="[0-9]*">
          </div>
          <div id="adminPinError" style="color:var(--danger);margin-top:8px;min-height:20px"></div>
          <button type="submit" class="btn btn-primary mt-3">Confirmar</button>
        </form>
      </div>
    `;

    this._adminPinCallback = callback;
    UI.showModal('Autorización Requerida', content, { footer: false, size: 'sm' });

    setTimeout(() => {
      const input = document.getElementById('adminPinInput');
      if (input) input.focus();
    }, 300);
  },

  async processAdminPin(e) {
    e.preventDefault();
    const pin = document.getElementById('adminPinInput').value.trim();
    const errorEl = document.getElementById('adminPinError');

    if (!pin) {
      errorEl.textContent = 'Ingresa el PIN';
      return;
    }

    const admin = await this.validateAdminPin(pin);
    if (!admin) {
      errorEl.textContent = 'PIN de administrador incorrecto';
      document.getElementById('adminPinInput').value = '';
      document.getElementById('adminPinInput').focus();
      return;
    }

    UI.closeModal();
    if (this._adminPinCallback) {
      this._adminPinCallback();
      this._adminPinCallback = null;
    }
  }
};
