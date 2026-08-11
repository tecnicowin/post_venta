const UI = {
  currentPage: null,

  init() {
    this.setupMobileMenu();
    this.setupToastContainer();
  },

  setupMobileMenu() {
    const toggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.querySelector('.sidebar-backdrop');

    if (toggle) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        backdrop.classList.toggle('active');
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', () => {
        sidebar.classList.remove('open');
        backdrop.classList.remove('active');
      });
    }
  },

  setupToastContainer() {
    if (!document.querySelector('.toast-container')) {
      const container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
  },

  showToast(message, type = 'info') {
    const container = document.querySelector('.toast-container');
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${icons[type] || 'ℹ'}</span>
      <span class="message">${Utils.escapeHtml(message)}</span>
      <button class="close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  showModal(title, content, options = {}) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.classList.add('modal-bg');

    const sizeClass = options.size ? `modal-${options.size}` : '';
    const footerHtml = options.footer !== false ? `
      <div class="modal-footer">
        ${options.footer || `
          <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
          <button class="btn btn-primary" id="modalConfirmBtn">${options.confirmText || 'Aceptar'}</button>
        `}
      </div>
    ` : '';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal ${sizeClass}">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="UI.closeModal()">×</button>
        </div>
        <div class="modal-body">${content}</div>
        ${footerHtml}
      </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));

    if (options.onConfirm) {
      const btn = document.getElementById('modalConfirmBtn');
      if (btn) btn.addEventListener('click', options.onConfirm);
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) UI.closeModal();
    });

    return modal;
  },

  closeModal() {
    const modal = document.querySelector('.modal-overlay:not(.modal-bg)');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.remove();
        const bg = document.querySelector('.modal-bg');
        if (bg) bg.classList.remove('modal-bg');
      }, 300);
    }
  },

  confirm(message, onConfirm) {
    this.showModal('Confirmar', `<p>${Utils.escapeHtml(message)}</p>`, {
      size: 'sm',
      confirmText: 'Confirmar',
      onConfirm: () => {
        UI.closeModal();
        onConfirm();
      }
    });
  },

  setLoading(show) {
    let overlay = document.querySelector('.loading-overlay');
    if (show) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(overlay);
      }
    } else {
      if (overlay) overlay.remove();
    }
  },

  navigate(page) {
    if (this.currentPage === page) return;
    this.currentPage = page;

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    document.querySelectorAll('.page-section').forEach(section => {
      section.classList.toggle('hidden', section.id !== `page-${page}`);
    });

    const headerTitle = document.querySelector('.header-title');
    const titles = {
      dashboard: 'Dashboard',
      inventory: 'Inventario',
      purchases: 'Compras',
      suppliers: 'Proveedores',
      invoice: 'Facturación',
      cashregister: 'Caja',
      services: 'Servicios',
      config: 'Configuración',
      reports: 'Reportes',
      operadores: 'Operadores',
      clientes: 'Clientes'
    };
    if (headerTitle) headerTitle.textContent = titles[page] || 'Dashboard';

    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.querySelector('.sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
  },

  renderTable(containerId, columns, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">📋</div>
          <h3>Sin resultados</h3>
          <p>${options.emptyText || 'No hay datos para mostrar'}</p>
          ${options.emptyAction ? `<button class="btn btn-primary" onclick="${options.emptyAction}">${options.emptyActionText || 'Agregar'}</button>` : ''}
        </div>
      `;
      return;
    }

    let html = '<div class="table-wrapper"><table class="table"><thead><tr>';
    columns.forEach(col => {
      const cls = col.align === 'right' ? 'text-right' : (col.align === 'center' ? 'text-center' : '');
      html += `<th class="${cls}" ${col.width ? `style="width:${col.width}"` : ''}>${col.label}</th>`;
    });
    html += '</tr></thead><tbody>';

    data.forEach((row, idx) => {
      html += '<tr>';
      columns.forEach(col => {
        const cls = col.align === 'right' ? 'text-right' : (col.align === 'center' ? 'text-center' : '');
        const value = col.render ? col.render(row, idx) : (row[col.key] || '');
        html += `<td class="${cls}">${value}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  renderSelectOptions(selectId, items, valueKey, labelKey, selectedValue) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const current = select.value || selectedValue;
    select.innerHTML = '<option value="">Seleccionar...</option>';
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item[valueKey];
      option.textContent = item[labelKey];
      if (item[valueKey] == current) option.selected = true;
      select.appendChild(option);
    });
  },

  getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    const data = {};
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (input.name) {
        if (input.type === 'checkbox') {
          data[input.name] = input.checked;
        } else if (input.type === 'number') {
          data[input.name] = parseFloat(input.value) || 0;
        } else {
          data[input.name] = input.value.trim();
        }
      }
    });
    return data;
  },

  clearForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.querySelectorAll('input, select, textarea').forEach(input => {
      if (input.type === 'checkbox') input.checked = false;
      else if (input.tagName === 'SELECT') input.selectedIndex = 0;
      else input.value = '';
    });
  },

  renderCashStatus(caja) {
    const badge = document.querySelector('.cash-status');
    if (!badge) return;

    if (caja && caja.estado === 'abierta') {
      badge.className = 'header-badge cash-open';
      badge.innerHTML = `<span class="icon">●</span> <span>Caja Abierta</span> <span class="font-bold">${Utils.formatCurrency(caja.montoApertura)}</span>`;
    } else {
      badge.className = 'header-badge cash-closed';
      badge.innerHTML = `<span class="icon">●</span> <span>Caja Cerrada</span>`;
    }
  },

  getTodayDate() {
    return Utils.getToday();
  },

  escapeHtml(str) {
    return Utils.escapeHtml(str);
  }
};
