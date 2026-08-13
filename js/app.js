const App = {
  async init() {
    try {
      await Storage.init();
      await License.init();
      await Config.load();
      await Categories.load();
      await Inventory.load();
      await Purchases.load();
      await Suppliers.load();
      await Clientes.load();
      await Services.load();
      await CashRegister.load();
      await Operadores.load();

      UI.init();

      this.setupNavigation();
      this.updateClock();
      setInterval(() => this.updateClock(), 60000);

      const licenseStatus = await License.getStatus();
      this.updateSidebarLicense(licenseStatus);

      if (!licenseStatus.activa && licenseStatus.motivo !== 'demo_expirada') {
        this.showExpiredOverlay(licenseStatus.mensaje || 'Licencia no válida');
        return;
      }

      if (!Operadores.isLoggedIn()) {
        if (Operadores.items.length === 0) {
          await this.createDefaultAdmin();
        }
        Operadores.showLogin();
      } else {
        this.applyRoleAccess();
        UI.navigate('dashboard');
        this.renderDashboard();
      }

      if (licenseStatus.activa === false && licenseStatus.motivo === 'demo_expirada') {
        setTimeout(() => this.showExpiredOverlay(licenseStatus.mensaje), 500);
      }

      Storage.checkBackupReminder();
      console.log('Punto de Venta inicializado correctamente');
    } catch (error) {
      console.error('Error initializing app:', error);
      document.body.innerHTML = `
        <div style="padding:40px;text-align:center">
          <h1>Error al inicializar</h1>
          <p>${Utils.escapeHtml(error.message)}</p>
          <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px">Recargar</button>
        </div>
      `;
    }
  },

  async createDefaultAdmin() {
    await Operadores.add({
      nombre: 'Administrador',
      pin: '1234',
      rol: 'admin',
      activo: true
    });
    UI.showToast('Admin inicial creado (PIN: 1234). Cámbialo después.', 'info');
  },

  applyRoleAccess() {
    const op = Operadores.current;
    if (!op) return;

    const opEl = document.getElementById('headerOperator');
    if (opEl) {
      opEl.textContent = `${op.rol === 'admin' ? '🛡️' : '👤'} ${op.nombre}`;
      opEl.title = `${op.nombre} (${op.rol}) - Click para cerrar sesión`;
    }

    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      const page = item.dataset.page;
      if (Operadores.canAccess(page)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  },

  setupNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        if (!Operadores.canAccess(page)) {
          UI.showToast('No tienes acceso a este módulo', 'error');
          return;
        }
        UI.navigate(page);
        this.loadPage(page);
      });
    });
  },

  loadPage(page) {
    if (!Operadores.canAccess(page)) {
      UI.showToast('Acceso denegado', 'error');
      UI.navigate('dashboard');
      this.renderDashboard();
      return;
    }
    switch (page) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'inventory':
        Inventory.renderList();
        break;
      case 'purchases':
        Purchases.renderPage();
        break;
      case 'suppliers':
        Suppliers.renderPage();
        break;
      case 'clientes':
        Clientes.renderPage();
        break;
      case 'invoice':
        Invoice.renderFacturaPage();
        break;
      case 'cashregister':
        CashRegister.renderPage();
        break;
      case 'services':
        Services.renderPage();
        break;
      case 'config':
        Config.renderForm();
        break;
      case 'reports':
        Reports.renderPage();
        break;
      case 'operadores':
        Operadores.renderPage();
        break;
    }
  },

  async renderDashboard() {
    const container = document.getElementById('page-dashboard');
    if (!container) return;

    const today = Utils.getToday();
    const facturas = await Storage.getFacturasByDate(today);
    const productos = await Storage.getAll(STORES.productos);
    const pagadas = facturas.filter(f => f.estado === 'pagada');
    const totalHoy = pagadas.reduce((sum, f) => sum + (f.total || 0), 0);
    const totalInventario = productos.reduce((sum, p) => sum + (p.cantidadExistencia * p.precioDetal), 0);
    const lowStock = productos.filter(p => p.activo && p.stockMinimo > 0 && p.cantidadExistencia <= p.stockMinimo);

    const allPagadas = facturas.filter(f => f.estado === 'pagada');
    const productSales = {};
    allPagadas.forEach(f => {
      if (f.items) {
        f.items.forEach(item => {
          const key = item.productoId || item.descripcion;
          if (!productSales[key]) productSales[key] = { nombre: item.descripcion, cantidad: 0, total: 0 };
          productSales[key].cantidad += item.cantidad || 0;
          productSales[key].total += item.totalPorRubro || 0;
        });
      }
    });
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);

    let topProductsHtml = '';
    if (topProducts.length > 0) {
      topProductsHtml = '<table class="table" style="font-size:12px"><thead><tr><th>#</th><th>Producto</th><th class="text-center">Cant.</th><th class="text-right">Total</th></tr></thead><tbody>';
      topProducts.forEach((p, i) => {
        topProductsHtml += `<tr><td>${i + 1}</td><td>${UI.escapeHtml(p.nombre)}</td><td class="text-center">${p.cantidad}</td><td class="text-right">${Utils.formatCurrency(p.total)}</td></tr>`;
      });
      topProductsHtml += '</tbody></table>';
    } else {
      topProductsHtml = '<p class="text-muted text-center" style="padding:20px">Sin ventas registradas</p>';
    }

    const licenseStatus = await License.getStatus();
    let demoBanner = '';
    if (licenseStatus.tipo === 'DEMO') {
      const pct = Math.max(0, (licenseStatus.diasRestantes / License.DEMO_DAYS) * 100);
      const color = pct > 50 ? '#10b981' : pct > 20 ? '#f59e0b' : '#ef4444';
      demoBanner = `
        <div class="card mb-4" style="border:1px solid ${color}44;background:${color}08">
          <div class="card-body flex items-center justify-between" style="padding:12px 20px">
            <div class="flex items-center gap-3">
              <span style="font-size:20px">⚠️</span>
              <div>
                <strong>Modo Demo</strong> — ${licenseStatus.diasRestantes} días restantes
                <div style="height:4px;background:#334155;border-radius:2px;margin-top:6px;width:200px">
                  <div style="height:100%;width:${pct}%;background:${color};border-radius:2px"></div>
                </div>
              </div>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm" onclick="License.showActivateForm()">🔑 Activar</button>
              <a href="https://tudominio.com/precios" target="_blank" class="btn btn-outline btn-sm">🛒 Comprar</a>
            </div>
          </div>
        </div>`;
    }

    container.innerHTML = `
      ${demoBanner}
      <div class="grid grid-4 mb-4">
        <div class="stat-card">
          <div class="stat-icon green">💰</div>
          <div class="stat-info">
            <h3>${Utils.formatCurrency(totalHoy)}</h3>
            <p>Ventas Hoy</p>
            ${Config.get('tasaDolar') > 0 ? `<p style="font-size:12px;color:var(--success);margin:0">${Utils.formatCurrencyBs(totalHoy, Config.get('tasaDolar'))}</p>` : ''}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue">📋</div>
          <div class="stat-info">
            <h3>${pagadas.length}</h3>
            <p>Facturas Hoy</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon yellow">📦</div>
          <div class="stat-info">
            <h3>${Utils.formatCurrency(totalInventario)}</h3>
            <p>Valor Inventario</p>
            ${Config.get('tasaDolar') > 0 ? `<p style="font-size:12px;color:var(--success);margin:0">${Utils.formatCurrencyBs(totalInventario, Config.get('tasaDolar'))}</p>` : ''}
          </div>
        </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">⚠️</div>
          <div class="stat-info">
            <h3>${lowStock.length}</h3>
            <p>Stock Bajo</p>
          </div>
        </div>
      </div>

      <div class="grid grid-2 mb-4">
        <div class="card">
          <div class="card-header">
            <h3>🏆 Top 10 Productos Más Vendidos</h3>
          </div>
          <div class="card-body" id="dashboardTopProducts" style="padding:0">
            ${topProductsHtml}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Últimas Facturas</h3>
            <button class="btn btn-outline btn-sm" onclick="UI.navigate('invoice'); Invoice.renderFacturaPage();">Ver todas</button>
          </div>
          <div class="card-body" id="dashboardRecentInvoices"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Acciones Rápidas</h3>
        </div>
        <div class="card-body">
          <div class="grid grid-2 gap-3">
            <button class="btn btn-primary w-full" onclick="Invoice.showNewInvoice()">+ Nueva Factura</button>
            ${Operadores.isAdmin() ? `<button class="btn btn-outline w-full" onclick="UI.navigate('inventory'); Inventory.renderList();">📦 Inventario</button>` : ''}
            ${CashRegister.isOpen() ?
              `<button class="btn btn-outline w-full" onclick="CashRegister.showCloseModal()">🔒 Cerrar Caja</button>` :
              (() => {
                const hoursCheck = CashRegister.checkBusinessHours();
                if (!hoursCheck.open) {
                  const diasLaborables = Config.get('diasLaborables') || [1, 2, 3, 4, 5, 6];
                  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                  const openDays = diasLaborables.map(d => dayNames[d]).join(', ');
                  const horaApertura = Config.get('horaApertura') || '08:00';
                  const horaCierre = Config.get('horaCierre') || '18:00';
                  if (hoursCheck.reason === 'day') {
                    return `<button class="btn btn-outline w-full" disabled title="Días: ${openDays}">⏰ Caja (no día laborable)</button>`;
                  } else {
                    return `<button class="btn btn-outline w-full" disabled title="Horario: ${horaApertura} - ${horaCierre}">⏰ Caja (fuera de horario)</button>`;
                  }
                }
                return `<button class="btn btn-outline w-full" onclick="CashRegister.showOpenModal()">🔓 Abrir Caja</button>`;
              })()
            }
            ${Operadores.isAdmin() ? `<button class="btn btn-outline w-full" onclick="UI.navigate('reports'); Reports.renderPage();">📊 Reportes</button>` : ''}
          </div>

          ${lowStock.length > 0 ? `
            <div class="alert alert-warning mt-4">
              <span>⚠️</span>
              <div>
                <strong>${lowStock.length} productos</strong> con stock bajo.
                ${Operadores.isAdmin() ? `<button class="btn btn-ghost btn-sm" onclick="UI.navigate('inventory'); Inventory.renderList();" style="padding:2px 8px">Ver</button>` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    const recentInvoices = facturas.filter(f => f.estado === 'pagada').slice(0, 5);
    UI.renderTable('dashboardRecentInvoices', [
      { label: '#', key: 'numero', width: '60px' },
      { label: 'Cliente', render: (row) => row.cliente ? UI.escapeHtml(row.cliente.nombre || 'Detal') : 'Detal' },
      { label: 'Total', align: 'right', render: (row) => Utils.formatCurrency(row.total) },
      { label: 'Estado', align: 'center', render: (row) => {
        const colors = { borrador: 'secondary', confirmada: 'warning', pagada: 'success', anulada: 'danger' };
        return `<span class="badge badge-${colors[row.estado] || 'secondary'}">${row.estado}</span>`;
      }}
    ], recentInvoices, { emptyText: 'No hay facturas hoy' });
  },

  updateSidebarLicense(status) {
    const el = document.getElementById('sidebarLicenseInfo');
    if (!el) return;

    if (status.activa && status.empresa) {
      const tipoLabel = status.tipo === 'VIP' ? '🟢' : '🔵';
      el.innerHTML = `<span style="font-size:11px;color:#94a3b8">${tipoLabel} Licenciado a</span><br><strong style="font-size:12px;color:#e2e8f0">${Utils.escapeHtml(status.empresa)}</strong>`;
    } else if (status.tipo === 'DEMO') {
      el.innerHTML = `<span style="font-size:11px;color:#f59e0b">⚠️ Modo Demo</span><br><span style="font-size:10px;color:#94a3b8">${status.diasRestantes || 30} días restantes</span>`;
    } else {
      el.innerHTML = 'Punto de Venta v1.0';
    }
  },

  showExpiredOverlay(mensaje) {
    const existing = document.getElementById('licenseExpiredOverlay');
    if (existing) return;

    const overlay = document.createElement('div');
    overlay.id = 'licenseExpiredOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.95);z-index:99999;display:flex;align-items:center;justify-content:center;text-align:center;color:#e2e8f0;font-family:system-ui';
    overlay.innerHTML = `
      <div style="max-width:500px;padding:40px">
        <div style="font-size:64px;margin-bottom:16px">🔒</div>
        <h1 style="font-size:28px;margin-bottom:12px">Demo Expirada</h1>
        <p style="color:#94a3b8;font-size:16px;margin-bottom:8px">${Utils.escapeHtml(mensaje || 'Tu período de demo ha finalizado.')}</p>
        <p style="color:#64748b;font-size:14px;margin-bottom:24px">Compra una licencia para seguir usando la app.</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <button onclick="License.showActivateForm()" style="padding:12px 24px;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer">🔑 Activar Licencia</button>
          <a href="https://tudominio.com/precios" target="_blank" style="padding:12px 24px;background:#10b981;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;text-decoration:none">🛒 Comprar Ahora</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  updateClock() {
    const clockEl = document.getElementById('headerClock');
    if (clockEl) {
      clockEl.textContent = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
