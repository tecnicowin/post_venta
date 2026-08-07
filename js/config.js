const Config = {
  data: null,

  async load() {
    this.data = {
      nombreComercial: await Storage.getConfig('nombreComercial') || '',
      rif: await Storage.getConfig('rif') || '',
      telefono: await Storage.getConfig('telefono') || '',
      direccion: await Storage.getConfig('direccion') || '',
      tasaDolar: await Storage.getConfig('tasaDolar') || 0,
      fechaApertura: await Storage.getConfig('fechaApertura') || '',
      secuenciaFactura: await Storage.getConfig('secuenciaFactura') || 1,
      iva16: await Storage.getConfig('iva16') || 0.16,
      iva10: await Storage.getConfig('iva10') || 0.10,
      horaApertura: await Storage.getConfig('horaApertura') || '08:00',
      horaCierre: await Storage.getConfig('horaCierre') || '18:00',
      diasLaborables: await Storage.getConfig('diasLaborables') || [1, 2, 3, 4, 5, 6],
      printerName: await Storage.getConfig('printerName') || '',
      paperSize: await Storage.getConfig('paperSize') || '58mm',
      autoPrint: await Storage.getConfig('autoPrint') || false,
      printCopies: await Storage.getConfig('printCopies') || 1
    };
    return this.data;
  },

  async save(data) {
    for (const [key, value] of Object.entries(data)) {
      await Storage.setConfig(key, value);
    }
    this.data = { ...this.data, ...data };
  },

  get(key) {
    return this.data ? this.data[key] : null;
  },

  renderForm() {
    const container = document.getElementById('configForm');
    if (!container) return;

    container.innerHTML = `
      <form id="configFormEl">
        <div class="card">
          <div class="card-header">
            <h3>Datos del Negocio</h3>
          </div>
          <div class="card-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Nombre Comercial <span class="required">*</span></label>
                <input type="text" class="form-control" name="nombreComercial" value="${UI.escapeHtml(this.data.nombreComercial)}" required>
              </div>
              <div class="form-group">
                <label class="form-label">RIF <span class="required">*</span></label>
                <input type="text" class="form-control" name="rif" value="${UI.escapeHtml(this.data.rif)}" placeholder="V-12345678" required>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Teléfono</label>
                <input type="text" class="form-control" name="telefono" value="${UI.escapeHtml(this.data.telefono)}" placeholder="0212-1234567">
              </div>
              <div class="form-group">
                <label class="form-label">Dirección</label>
                <input type="text" class="form-control" name="direccion" value="${UI.escapeHtml(this.data.direccion)}">
              </div>
            </div>
          </div>
        </div>

        <div class="card mt-4">
          <div class="card-header">
            <h3>Configuración de IVA y Tasa del Dólar</h3>
          </div>
          <div class="card-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Tasa del Dólar ($)</label>
                <input type="number" class="form-control" name="tasaDolar" value="${this.data.tasaDolar}" step="0.01" min="0">
                <div class="form-hint">Actualizar antes de abrir caja cada día</div>
              </div>
              <div class="form-group">
                <label class="form-label">IVA 16%</label>
                <input type="number" class="form-control" name="iva16" value="${this.data.iva16}" step="0.01" min="0" max="1">
              </div>
              <div class="form-group">
                <label class="form-label">IVA 10%</label>
                <input type="number" class="form-control" name="iva10" value="${this.data.iva10}" step="0.01" min="0" max="1">
              </div>
            </div>
          </div>
        </div>

        <div class="card mt-4">
          <div class="card-header">
            <h3>Horario y Días Laborables</h3>
          </div>
          <div class="card-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Hora de Apertura</label>
                <input type="time" class="form-control" name="horaApertura" value="${this.data.horaApertura}">
              </div>
              <div class="form-group">
                <label class="form-label">Hora de Cierre</label>
                <input type="time" class="form-control" name="horaCierre" value="${this.data.horaCierre}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Días Laborables</label>
              <div class="flex gap-2 flex-wrap" id="diasLaborablesCheckboxes">
                ${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((dia, i) => `
                  <label class="flex items-center gap-1" style="cursor:pointer">
                    <input type="checkbox" name="dia_${i}" value="${i}" ${(this.data.diasLaborables || []).includes(i) ? 'checked' : ''}>
                    ${dia}
                  </label>
                `).join('')}
              </div>
              <div class="form-hint">Selecciona los días en que el negocio abre. La caja solo se puede abrir en estos días y horario.</div>
            </div>
          </div>
        </div>

        <div class="card mt-4">
          <div class="card-header">
            <h3>Configuración de Impresora USB</h3>
          </div>
          <div class="card-body">
            <div class="alert alert-info mb-3">
              <span>ℹ️</span>
              <div>Conecta la impresora térmica por USB, selecciónala como impresora predeterminada en tu sistema, y configura aquí el tamaño de papel.</div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Nombre de la Impresora</label>
                <input type="text" class="form-control" name="printerName" value="${UI.escapeHtml(this.data.printerName)}" placeholder="Ej: EPSON TM-T20III">
                <div class="form-hint">Nombre descriptivo (referencia). La impresora real se configura en Windows/Mac.</div>
              </div>
              <div class="form-group">
                <label class="form-label">Tamaño de Papel</label>
                <select class="form-control" name="paperSize">
                  <option value="58mm" ${this.data.paperSize === '58mm' ? 'selected' : ''}>58mm (Estrecho)</option>
                  <option value="80mm" ${this.data.paperSize === '80mm' ? 'selected' : ''}>80mm (Estándar)</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Copias por Recibo</label>
                <input type="number" class="form-control" name="printCopies" value="${this.data.printCopies}" min="1" max="5">
              </div>
              <div class="form-group">
                <label class="form-label">Impresión Automática</label>
                <div class="flex items-center gap-2 mt-2">
                  <input type="checkbox" name="autoPrint" ${this.data.autoPrint ? 'checked' : ''} id="autoPrintCheck">
                  <label for="autoPrintCheck">Imprimir recibo al confirmar factura</label>
                </div>
              </div>
            </div>
            <div class="mt-3">
              <button type="button" class="btn btn-outline" onclick="Config.testPrint()">🖨️ Imprimir Prueba</button>
            </div>
          </div>
        </div>

        <div class="card mt-4">
          <div class="card-header">
            <h3>Datos de Backup</h3>
          </div>
          <div class="card-body">
            <div class="flex gap-2">
              <button type="button" class="btn btn-outline" onclick="Config.exportData()">📤 Exportar Datos (JSON)</button>
              <label class="btn btn-outline" style="cursor:pointer">
                📥 Importar Datos (JSON)
                <input type="file" accept=".json" style="display:none" onchange="Config.importData(event)">
              </label>
            </div>
          </div>
        </div>

        <div class="mt-4 flex justify-end">
          <button type="submit" class="btn btn-primary btn-lg">💾 Guardar Configuración</button>
        </div>
      </form>
    `;

    document.getElementById('configFormEl').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = UI.getFormData('configFormEl');
      data.tasaDolar = parseFloat(data.tasaDolar) || 0;
      data.iva16 = parseFloat(data.iva16) || 0.16;
      data.iva10 = parseFloat(data.iva10) || 0.10;
      data.printCopies = parseInt(data.printCopies) || 1;
      data.autoPrint = document.getElementById('autoPrintCheck').checked;

      // Collect diasLaborables from checkboxes
      const dias = [];
      for (let i = 0; i <= 6; i++) {
        const cb = document.querySelector(`[name="dia_${i}"]`);
        if (cb && cb.checked) dias.push(i);
      }
      data.diasLaborables = dias;

      Config.save(data).then(() => {
        UI.showToast('Configuración guardada exitosamente', 'success');
      });
    });
  },

  async exportData() {
    try {
      const data = await Storage.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `punto_venta_backup_${Utils.getToday()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      UI.showToast('Datos exportados exitosamente', 'success');
    } catch (e) {
      UI.showToast('Error al exportar: ' + e.message, 'error');
    }
  },

  async importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    UI.confirm('¿Estás seguro de importar estos datos? Esto reemplazará todos los datos actuales.', async () => {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await Storage.importAll(data);
        await Config.load();
        UI.showToast('Datos importados exitosamente. Recargando...', 'success');
        setTimeout(() => location.reload(), 1500);
      } catch (e) {
        UI.showToast('Error al importar: ' + e.message, 'error');
      }
    });
  },

  testPrint() {
    const config = this.data;
    const paperSize = config.paperSize || '58mm';
    const width = paperSize === '80mm' ? '80mm' : '58mm';

    const printWindow = window.open('', '_blank', `width=300,height=600`);
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prueba de Impresión</title>
        <style>
          @page { size: ${width} auto; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: ${width};
            padding: 3mm;
            color: #000;
            background: #fff;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .line { border-top: 1px dashed #000; margin: 3mm 0; }
          .total { font-size: 16px; font-weight: bold; text-align: right; }
          .small { font-size: 10px; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 1px 0; }
          .right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size:16px">${Utils.escapeHtml(config.nombreComercial || 'MI NEGOCIO')}</div>
        <div class="center small">RIF: ${Utils.escapeHtml(config.rif || 'N/A')}</div>
        <div class="center small">Tel: ${Utils.escapeHtml(config.telefono || '')}</div>
        <div class="center small">${Utils.escapeHtml(config.direccion || '')}</div>
        <div class="line"></div>
        <div class="center bold" style="font-size:14px">--- PRUEBA DE IMPRESIÓN ---</div>
        <div class="center small">${Utils.formatDateTime(Utils.getNow())}</div>
        <div class="line"></div>
        <div class="center small">Impresora: ${Utils.escapeHtml(config.printerName || 'Por configurar')}</div>
        <div class="center small">Papel: ${paperSize}</div>
        <div class="line"></div>
        <table>
          <tr><td>Artículo de prueba 1</td><td class="right">$10.00</td></tr>
          <tr><td>Artículo de prueba 2</td><td class="right">$25.50</td></tr>
          <tr><td>Artículo de prueba 3</td><td class="right">$8.75</td></tr>
        </table>
        <div class="line"></div>
        <div class="total">TOTAL: $44.25</div>
        <div class="line"></div>
        <div class="center small">¡Impresora funcionando!</div>
        <div class="center small">${Utils.escapeHtml(config.nombreComercial || '')}</div>
        <script>window.onload = function() { window.print(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
    UI.showToast('Ventana de impresión abierta. Verifica la impresora.', 'info');
  }
};
