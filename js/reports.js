const Reports = {
  async renderPage() {
    const container = document.getElementById('reportsContent');
    if (!container) return;

    const today = Utils.getToday();
    const facturas = await Storage.getAll(STORES.facturas);
    const productos = await Storage.getAll(STORES.productos);
    const todayFacturas = facturas.filter(f => f.createdAt && f.createdAt.startsWith(today));
    const pagadas = todayFacturas.filter(f => f.estado === 'pagada');

    let totalVentasHoy = 0;
    let efectivo = 0, transferencia = 0, pagomovil = 0, otros = 0;
    pagadas.forEach(f => {
      totalVentasHoy += f.total || 0;
      if (f.pagos) {
        f.pagos.forEach(p => {
          const monto = parseFloat(p.monto) || 0;
          if (p.formaPago === 'efectivo') efectivo += monto;
          else if (p.formaPago === 'transferencia') transferencia += monto;
          else if (p.formaPago === 'pagomovil') pagomovil += monto;
          else otros += monto;
        });
      }
    });

    const totalInventario = productos.reduce((sum, p) => sum + (p.cantidadExistencia * p.precioDetal), 0);
    const lowStock = productos.filter(p => p.activo && p.stockMinimo > 0 && p.cantidadExistencia <= p.stockMinimo);

    const productSales = {};
    pagadas.forEach(f => {
      if (f.items) {
        f.items.forEach(item => {
          if (!productSales[item.descripcion]) productSales[item.descripcion] = { qty: 0, total: 0 };
          productSales[item.descripcion].qty += item.cantidad;
          productSales[item.descripcion].total += item.totalPorRubro;
        });
      }
    });
    const topProducts = Object.entries(productSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    container.innerHTML = `
      <div class="tabs mb-4">
        <div class="tab-item active" onclick="Reports.showTab('resumen', this)">Resumen del Día</div>
        <div class="tab-item" onclick="Reports.showTab('comprasventas', this)">Compras vs Ventas</div>
        <div class="tab-item" onclick="Reports.showTab('flujo', this)">Flujo de Efectivo</div>
      </div>

      <div id="tab-resumen">
        <div class="grid grid-4 mb-4">
        <div class="stat-card">
          <div class="stat-icon green">💰</div>
          <div class="stat-info">
            <h3>${Utils.formatCurrency(totalVentasHoy)}</h3>
            <p>Ventas Hoy</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue">📋</div>
          <div class="stat-info">
            <h3>${pagadas.length}</h3>
            <p>Facturas Pagadas</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon yellow">📦</div>
          <div class="stat-info">
            <h3>${Utils.formatCurrency(totalInventario)}</h3>
            <p>Valor Inventario</p>
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
          <div class="card-header"><h3>Resumen de Pagos Hoy</h3></div>
          <div class="card-body">
            <div class="table-wrapper">
              <table class="table">
                <thead><tr><th>Forma de Pago</th><th class="text-right">Monto</th></tr></thead>
                <tbody>
                  <tr><td>Efectivo</td><td class="text-right font-bold">${Utils.formatCurrency(efectivo)}</td></tr>
                  <tr><td>Transferencia</td><td class="text-right font-bold">${Utils.formatCurrency(transferencia)}</td></tr>
                  <tr><td>Pago Móvil</td><td class="text-right font-bold">${Utils.formatCurrency(pagomovil)}</td></tr>
                  <tr><td>Otros</td><td class="text-right font-bold">${Utils.formatCurrency(otros)}</td></tr>
                  <tr style="background:var(--bg-body)"><td class="font-bold">TOTAL</td><td class="text-right font-bold text-success">${Utils.formatCurrency(totalVentasHoy)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Productos Más Vendidos (Hoy)</h3></div>
          <div class="card-body">
            ${topProducts.length === 0 ?
              '<div class="empty-state"><p>No hay ventas registradas hoy</p></div>' :
              `<div class="table-wrapper">
                <table class="table">
                  <thead><tr><th>Producto</th><th class="text-center">Cant.</th><th class="text-right">Total</th></tr></thead>
                  <tbody>
                    ${topProducts.map(p => `
                      <tr>
                        <td>${UI.escapeHtml(p.name)}</td>
                        <td class="text-center">${p.qty}</td>
                        <td class="text-right font-bold">${Utils.formatCurrency(p.total)}</td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>`
            }
          </div>
        </div>
      </div>

      ${lowStock.length > 0 ? `
        <div class="card mt-4">
          <div class="card-header">
            <h3>⚠️ Productos con Stock Bajo</h3>
            <span class="badge badge-danger">${lowStock.length} productos</span>
          </div>
          <div class="card-body">
            <div class="table-wrapper">
              <table class="table">
                <thead><tr><th>Producto</th><th class="text-center">Stock Actual</th><th class="text-center">Stock Mínimo</th></tr></thead>
                <tbody>
                  ${lowStock.map(p => `
                    <tr>
                      <td>${UI.escapeHtml(p.descripcion)}</td>
                      <td class="text-center text-danger font-bold">${p.cantidadExistencia}</td>
                      <td class="text-center">${p.stockMinimo}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="card mt-4">
        <div class="card-header">
          <h3>Historial de Facturas</h3>
          <button class="btn btn-outline btn-sm" onclick="Reports.exportFacturas()">📥 Exportar CSV</button>
        </div>
        <div class="card-body">
          <div id="reportsFacturasTable"></div>
        </div>
      </div>
      </div>

      <div id="tab-comprasventas" class="hidden">
        <div class="card">
          <div class="card-header"><h3>Compras vs Ventas por Mes</h3></div>
          <div class="card-body">
            <div id="reportsComprasVentas"></div>
          </div>
        </div>
      </div>

      <div id="tab-flujo" class="hidden">
        <div class="card">
          <div class="card-header"><h3>Flujo de Efectivo (Últimos 30 días)</h3></div>
          <div class="card-body">
            <div id="reportsFlujoEfectivo"></div>
          </div>
        </div>
      </div>
    `;

    const recentFacturas = facturas.slice(0, 100);
    UI.renderTable('reportsFacturasTable', [
      { label: '#', key: 'numero', width: '70px' },
      { label: 'Cliente', render: (row) => row.cliente ? UI.escapeHtml(row.cliente.nombre || 'Detal') : 'Detal' },
      { label: 'Total', align: 'right', render: (row) => Utils.formatCurrency(row.total) },
      { label: 'Estado', align: 'center', render: (row) => {
        const colors = { borrador: 'secondary', confirmada: 'warning', pagada: 'success', anulada: 'danger' };
        return `<span class="badge badge-${colors[row.estado] || 'secondary'}">${row.estado}</span>`;
      }},
      { label: 'Fecha', render: (row) => Utils.formatDateTime(row.createdAt) },
      { label: '', align: 'center', width: '80px', render: (row) => `
        <div class="flex gap-1 justify-center">
          <button class="btn btn-ghost btn-sm" onclick="Invoice.viewFactura('${row.id}')" title="Ver">👁️</button>
          ${row.estado === 'pagada' ? `
            <button class="btn btn-ghost btn-sm" onclick="PdfGenerator.generateAndDownload('${row.id}')" title="PDF">📄</button>
          ` : ''}
        </div>`
    }], recentFacturas, { emptyText: 'No hay facturas registradas' });
  },

  showTab(tab, el) {
    document.querySelectorAll('.tabs .tab-item').forEach(t => t.classList.remove('active'));
    el.classList.add('active');

    ['resumen', 'comprasventas', 'flujo'].forEach(t => {
      const section = document.getElementById(`tab-${t}`);
      if (section) section.classList.toggle('hidden', t !== tab);
    });

    if (tab === 'comprasventas') this.renderComprasVentas();
    if (tab === 'flujo') this.renderFlujoEfectivo();
  },

  async exportFacturas() {
    const facturas = await Storage.getAll(STORES.facturas);
    if (facturas.length === 0) {
      UI.showToast('No hay facturas para exportar', 'warning');
      return;
    }

    let csv = 'Numero,Fecha,Cliente,Subtotal,Descuento,Base Imponible,IVA 16%,IVA 10%,Total IVA,Total,Estado\n';
    facturas.forEach(f => {
      const cliente = f.cliente ? (f.cliente.nombreComercial || `${f.cliente.nombre || ''} ${f.cliente.apellido || ''}`.trim()) : 'Detal';
      csv += `${f.numero},${Utils.formatDateTime(f.createdAt)},"${cliente}",${f.subtotal},${f.descuento},${f.baseImponible},${f.iva16},${f.iva10},${f.totalIva},${f.total},${f.estado}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facturas_${Utils.getToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast('CSV exportado exitosamente', 'success');
  },

  async renderComprasVentas() {
    const container = document.getElementById('reportsComprasVentas');
    if (!container) return;

    const facturas = await Storage.getAll(STORES.facturas);
    const compras = await Storage.getAll(STORES.compras);
    const pagadas = facturas.filter(f => f.estado === 'pagada');

    const meses = {};
    const allDates = [...pagadas.map(f => f.createdAt), ...compras.map(c => c.createdAt)].filter(Boolean);
    allDates.forEach(d => {
      const mes = d.substring(0, 7);
      if (!meses[mes]) meses[mes] = { ventas: 0, compras: 0, cantVentas: 0, cantCompras: 0 };
    });

    pagadas.forEach(f => {
      const mes = (f.createdAt || '').substring(0, 7);
      if (meses[mes]) {
        meses[mes].ventas += f.total || 0;
        meses[mes].cantVentas++;
      }
    });

    compras.forEach(c => {
      const mes = (c.createdAt || '').substring(0, 7);
      if (meses[mes]) {
        meses[mes].compras += c.total || 0;
        meses[mes].cantCompras++;
      }
    });

    const sortedMeses = Object.entries(meses).sort((a, b) => b[0].localeCompare(a[0]));

    let html = '<div class="table-wrapper"><table class="table">';
    html += '<thead><tr><th>Mes</th><th class="text-right">Ventas ($)</th><th class="text-center"># Ventas</th><th class="text-right">Compras ($)</th><th class="text-center"># Compras</th><th class="text-right">Utilidad</th></tr></thead><tbody>';

    let totalGeneralVentas = 0, totalGeneralCompras = 0;

    sortedMeses.forEach(([mes, data]) => {
      const utilidad = data.ventas - data.compras;
      totalGeneralVentas += data.ventas;
      totalGeneralCompras += data.compras;
      html += `
        <tr>
          <td class="font-bold">${mes}</td>
          <td class="text-right text-success font-bold">${Utils.formatCurrency(data.ventas)}</td>
          <td class="text-center">${data.cantVentas}</td>
          <td class="text-right text-danger font-bold">${Utils.formatCurrency(data.compras)}</td>
          <td class="text-center">${data.cantCompras}</td>
          <td class="text-right font-bold ${utilidad >= 0 ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(utilidad)}</td>
        </tr>`;
    });

    const utilidadTotal = totalGeneralVentas - totalGeneralCompras;
    html += `
      <tr style="background:var(--bg-body);font-weight:700">
        <td>TOTAL</td>
        <td class="text-right text-success">${Utils.formatCurrency(totalGeneralVentas)}</td>
        <td class="text-center">${pagadas.length}</td>
        <td class="text-right text-danger">${Utils.formatCurrency(totalGeneralCompras)}</td>
        <td class="text-center">${compras.length}</td>
        <td class="text-right ${utilidadTotal >= 0 ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(utilidadTotal)}</td>
      </tr>`;

    html += '</tbody></table></div>';

    if (sortedMeses.length === 0) {
      html = '<div class="empty-state"><p>No hay datos de compras o ventas para comparar</p></div>';
    }

    container.innerHTML = html;
  },

  async renderFlujoEfectivo() {
    const container = document.getElementById('reportsFlujoEfectivo');
    if (!container) return;

    const caja = await Storage.getAll(STORES.caja);
    const facturas = await Storage.getAll(STORES.facturas);
    const compras = await Storage.getAll(STORES.compras);
    const pagadas = facturas.filter(f => f.estado === 'pagada');

    const dias = {};

    caja.forEach(c => {
      const dia = c.fecha;
      if (!dias[dia]) dias[dia] = { apertura: 0, cierre: 0, estado: c.estado, efectivoVentas: 0, otrosPagos: 0, efectivoCompras: 0, otrosCompras: 0 };
      if (c.estado === 'abierta') {
        dias[dia].apertura = c.montoApertura;
      } else {
        dias[dia].cierre = c.montoCierre;
        dias[dia].estado = 'cerrada';
      }
    });

    pagadas.forEach(f => {
      const dia = (f.createdAt || '').substring(0, 10);
      if (!dias[dia]) dias[dia] = { apertura: 0, cierre: 0, estado: '', efectivoVentas: 0, otrosPagos: 0, efectivoCompras: 0, otrosCompras: 0 };
      if (f.pagos) {
        f.pagos.forEach(p => {
          if (p.formaPago === 'efectivo') dias[dia].efectivoVentas += parseFloat(p.monto) || 0;
          else dias[dia].otrosPagos += parseFloat(p.monto) || 0;
        });
      }
    });

    compras.forEach(c => {
      const dia = (c.fecha || '').substring(0, 10);
      if (!dias[dia]) dias[dia] = { apertura: 0, cierre: 0, estado: '', efectivoVentas: 0, otrosPagos: 0, efectivoCompras: 0, otrosCompras: 0 };
      if (c.formaPago === 'efectivo') dias[dia].efectivoCompras += c.total || 0;
      else dias[dia].otrosCompras += c.total || 0;
    });

    const sortedDias = Object.entries(dias).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);

    let html = '<div class="table-wrapper"><table class="table">';
    html += '<thead><tr><th>Fecha</th><th class="text-right">Apertura</th><th class="text-right">Efectivo Ventas</th><th class="text-right">Otros Pagos</th><th class="text-right">Efectivo Compras</th><th class="text-right">Otros Gastos</th><th class="text-right">Saldo Neto</th></tr></thead><tbody>';

    let totalApertura = 0, totalEfVentas = 0, totalOtros = 0, totalEfCompras = 0, totalOtrosC = 0;

    sortedDias.forEach(([dia, data]) => {
      const saldoNeto = data.apertura + data.efectivoVentas - data.efectivoCompras;
      totalApertura += data.apertura;
      totalEfVentas += data.efectivoVentas;
      totalOtros += data.otrosPagos;
      totalEfCompras += data.efectivoCompras;
      totalOtrosC += data.otrosCompras;

      html += `
        <tr>
          <td class="font-bold">${Utils.formatDate(dia)}</td>
          <td class="text-right">${Utils.formatCurrency(data.apertura)}</td>
          <td class="text-right text-success">${Utils.formatCurrency(data.efectivoVentas)}</td>
          <td class="text-right">${Utils.formatCurrency(data.otrosPagos)}</td>
          <td class="text-right text-danger">${Utils.formatCurrency(data.efectivoCompras)}</td>
          <td class="text-right text-danger">${Utils.formatCurrency(data.otrosCompras)}</td>
          <td class="text-right font-bold ${saldoNeto >= 0 ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(saldoNeto)}</td>
        </tr>`;
    });

    const saldoTotal = totalApertura + totalEfVentas - totalEfCompras;
    html += `
      <tr style="background:var(--bg-body);font-weight:700">
        <td>TOTAL</td>
        <td class="text-right">${Utils.formatCurrency(totalApertura)}</td>
        <td class="text-right text-success">${Utils.formatCurrency(totalEfVentas)}</td>
        <td class="text-right">${Utils.formatCurrency(totalOtros)}</td>
        <td class="text-right text-danger">${Utils.formatCurrency(totalEfCompras)}</td>
        <td class="text-right text-danger">${Utils.formatCurrency(totalOtrosC)}</td>
        <td class="text-right ${saldoTotal >= 0 ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(saldoTotal)}</td>
      </tr>`;

    html += '</tbody></table></div>';

    if (sortedDias.length === 0) {
      html = '<div class="empty-state"><p>No hay datos de caja para generar el flujo de efectivo</p></div>';
    }

    container.innerHTML = html;
  }
};
