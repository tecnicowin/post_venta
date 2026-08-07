const Categories = {
  items: [],
  colors: ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#ec4899', '#0891b2', '#64748b', '#059669', '#d946ef', '#ea580c', '#0284c7'],

  async load() {
    this.items = await Storage.getAll(STORES.categorias);
    this.items.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  async add(data) {
    const categoria = {
      id: Utils.generateId(),
      nombre: data.nombre,
      descripcion: data.descripcion || '',
      color: data.color || this.colors[0],
      createdAt: Utils.getNow()
    };
    await Storage.add(STORES.categorias, categoria);
    await this.load();
    return categoria;
  },

  async update(id, data) {
    const existing = await Storage.get(STORES.categorias, id);
    if (!existing) throw new Error('Categoría no encontrada');
    const updated = { ...existing, ...data };
    await Storage.update(STORES.categorias, updated);
    await this.load();
    return updated;
  },

  async remove(id) {
    const productos = await Storage.getByIndex(STORES.productos, 'categoriaId', id);
    if (productos.length > 0) {
      throw new Error('No se puede eliminar: tiene productos asociados');
    }
    await Storage.delete(STORES.categorias, id);
    await this.load();
  },

  getById(id) {
    return this.items.find(c => c.id === id);
  },

  async renderList() {
    await this.load();
    const container = document.getElementById('categoriesList');
    if (!container) return;

    if (this.items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">📁</div>
          <h3>Sin categorías</h3>
          <p>Crea categorías para organizar tus productos</p>
          <button class="btn btn-primary" onclick="Categories.showForm()">+ Nueva Categoría</button>
        </div>`;
      return;
    }

    let html = '<div class="grid grid-3">';
    this.items.forEach(cat => {
      const productCount = this.items.length;
      html += `
        <div class="card" style="border-left: 4px solid ${cat.color}">
          <div class="card-body">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span style="width:12px;height:12px;border-radius:50%;background:${cat.color};display:inline-block"></span>
                <strong>${UI.escapeHtml(cat.nombre)}</strong>
              </div>
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-sm" onclick="Categories.showForm('${cat.id}')" title="Editar">✏️</button>
                <button class="btn btn-ghost btn-sm" onclick="Categories.confirmDelete('${cat.id}')" title="Eliminar">🗑️</button>
              </div>
            </div>
            <p class="text-muted" style="font-size:12px">${UI.escapeHtml(cat.descripcion || 'Sin descripción')}</p>
          </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  },

  showForm(editId = null) {
    const cat = editId ? this.items.find(c => c.id === editId) : null;
    const title = cat ? 'Editar Categoría' : 'Nueva Categoría';

    let colorOptions = '';
    this.colors.forEach(color => {
      const selected = (cat && cat.color === color) ? 'selected' : '';
      colorOptions += `<div class="color-option ${selected}" style="background:${color}" data-color="${color}" onclick="Categories.selectColor(this)"></div>`;
    });

    const content = `
      <form id="categoryForm">
        <div class="form-group">
          <label class="form-label">Nombre <span class="required">*</span></label>
          <input type="text" class="form-control" name="nombre" value="${cat ? UI.escapeHtml(cat.nombre) : ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Descripción</label>
          <textarea class="form-control" name="descripcion" rows="2">${cat ? UI.escapeHtml(cat.descripcion || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="color-options">${colorOptions}</div>
          <input type="hidden" name="color" id="categoryColor" value="${cat ? cat.color : this.colors[0]}">
        </div>
      </form>
    `;

    UI.showModal(title, content, {
      confirmText: cat ? 'Actualizar' : 'Crear',
      onConfirm: async () => {
        const data = UI.getFormData('categoryForm');
        if (!data.nombre) {
          UI.showToast('El nombre es requerido', 'error');
          return;
        }
        try {
          if (cat) {
            await Categories.update(cat.id, data);
            UI.showToast('Categoría actualizada', 'success');
          } else {
            await Categories.add(data);
            UI.showToast('Categoría creada', 'success');
          }
          UI.closeModal();
          await Categories.renderList();
          await Inventory.renderList();
        } catch (e) {
          UI.showToast(e.message, 'error');
        }
      }
    });
  },

  selectColor(el) {
    document.querySelectorAll('.color-option').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('categoryColor').value = el.dataset.color;
  },

  confirmDelete(id) {
    const cat = this.items.find(c => c.id === id);
    UI.confirm(`¿Eliminar la categoría "${cat.nombre}"?`, async () => {
      try {
        await Categories.remove(id);
        UI.showToast('Categoría eliminada', 'success');
        await Categories.renderList();
        await Inventory.renderList();
      } catch (e) {
        UI.showToast(e.message, 'error');
      }
    });
  },

  renderSelectOptions(selectId, selectedValue) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">Sin categoría</option>';
    this.items.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.nombre;
      if (cat.id === selectedValue) option.selected = true;
      select.appendChild(option);
    });
  }
};
