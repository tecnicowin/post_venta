const App = {
  async init() {
    try {
      await Storage.init();
      await Config.load();
      await Categories.load();
      await Inventory.load();
      await Purchases.load();
      await Suppliers.load();
      await Services.load();
      await CashRegister.load();

      UI.init();

      this.setupNavigation();
      this.updateClock();
      setInterval(() => this.updateClock(), 60000);

      UI.navigate('dashboard');
      this.renderDashboard();

      console.log('Punto de Venta inicializado correctamente');
    } catch (error) {
      console.error('Error initializing app:', error);
      document.body.innerHTML = `
        <div style="padding:40px;text-align:center">
          <h1>Error al inicializar</h1>
          <p>${error.message}</p>
          <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px">Recargar</button>
        </div>
      `;
    }
  },

  setupNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        UI.navigate(page);
        this.loadPage(page);
      });
    });
  },

  loadPage(page) {
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
    }
  },

  async renderDashboard() {
    const container = document.getElementById('page-dashboard');
    if (!container) return;

    const today = Utils.getToday();
    const facturas = await Storage.getAll(STORES.facturas);
    const productos = await Storage.getAll(STORES.productos);
    const todayFacturas = facturas.filter(f => f.createdAt && f.createdAt.startsWith(today));
    const pagadas = todayFacturas.filter(f => f.estado === 'pagada');
    const totalHoy = pagadas.reduce((sum, f) => sum + (f.total || 0), 0);
    const totalInventario = productos.reduce((sum, p) => sum + (p.cantidadExistencia * p.precioDetal), 0);
    const lowStock = productos.filter(p => p.activo && p.stockMinimo > 0 && p.cantidadExistencia <= p.stockMinimo);

    container.innerHTML = `
      <div class="grid grid-4 mb-4">
        <div class="stat-card">
          <div class="stat-icon green">💰</div>
          <div class="stat-info">
            <h3>${Utils.formatCurrency(totalHoy)}</h3>
            <p>Ventas Hoy</p>
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
            <h3>${productos.length}</h3>
            <p>Productos</p>
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

      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">
            <h3>Últimas Facturas</h3>
            <button class="btn btn-outline btn-sm" onclick="UI.navigate('invoice'); Invoice.renderFacturaPage();">Ver todas</button>
          </div>
          <div class="card-body" id="dashboardRecentInvoices"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Acciones Rápidas</h3>
          </div>
          <div class="card-body">
            <div class="grid grid-2 gap-3">
              <button class="btn btn-primary w-full" onclick="Invoice.showNewInvoice()">+ Nueva Factura</button>
              <button class="btn btn-outline w-full" onclick="UI.navigate('inventory'); Inventory.renderList();">📦 Inventario</button>
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
              <button class="btn btn-outline w-full" onclick="UI.navigate('reports'); Reports.renderPage();">📊 Reportes</button>
            </div>

            ${lowStock.length > 0 ? `
              <div class="alert alert-warning mt-4">
                <span>⚠️</span>
                <div>
                  <strong>${lowStock.length} productos</strong> con stock bajo.
                  <button class="btn btn-ghost btn-sm" onclick="UI.navigate('inventory'); Inventory.renderList();" style="padding:2px 8px">Ver</button>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    const recentInvoices = todayFacturas.slice(0, 5);
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
