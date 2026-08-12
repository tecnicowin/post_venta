const License = {
  API_URL: '', // Set in config

  LICENSE_KEY: 'pdv_license',
  DEMO_START_KEY: 'pdv_demo_start',
  DEMO_DAYS: 30,
  CHECK_INTERVAL_DAYS: 7,
  GRACE_PERIOD_DAYS: 8,

  async init() {
    await this.migrateOldLicense();
    this.startPeriodicCheck();
    return this.getStatus();
  },

  async migrateOldLicense() {
    const old = localStorage.getItem(this.LICENSE_KEY);
    if (old && !old.includes('.')) {
      try {
        const data = JSON.parse(old);
        if (data.clave && !data.firma) {
          localStorage.setItem(this.LICENSE_KEY, JSON.stringify({
            ...data,
            firma: 'legacy'
          }));
        }
      } catch (e) {}
    }
  },

  async getStatus() {
    const license = this.getLocal();
    const now = Date.now();

    if (!license) {
      return this.getDemoStatus();
    }

    if (license.estado === 'revocada') {
      return { activa: false, motivo: 'revocada', mensaje: 'Tu licencia ha sido revocada.' };
    }

    if (license.tipo === 'VIP') {
      return { activa: true, tipo: 'VIP', nombre: 'Vitalicia', empresa: license.empresa || '', expira: null };
    }

    if (license.tipo === 'PRO') {
      const expira = new Date(license.expira).getTime();
      if (now > expira) {
        return { activa: false, motivo: 'expirada', mensaje: 'Tu licencia PRO ha expirado.' };
      }
      const diasRestantes = Math.ceil((expira - now) / (1000 * 60 * 60 * 24));
      return { activa: true, tipo: 'PRO', nombre: 'PRO', empresa: license.empresa || '', expira: license.expira, diasRestantes };
    }

    return this.getDemoStatus();
  },

  getDemoStatus() {
    let start = parseInt(localStorage.getItem(this.DEMO_START_KEY));
    if (!start) {
      start = Date.now();
      localStorage.setItem(this.DEMO_START_KEY, start.toString());
    }
    const elapsed = Date.now() - start;
    const daysLeft = this.DEMO_DAYS - Math.floor(elapsed / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
      return { activa: false, motivo: 'demo_expirada', mensaje: 'La demo ha expirado. Compra una licencia.' };
    }
    return { activa: true, tipo: 'DEMO', nombre: `Demo (${daysLeft} días)`, diasRestantes: daysLeft };
  },

  getLocal() {
    try {
      const raw = localStorage.getItem(this.LICENSE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  async activate(clave, empresa) {
    clave = clave.trim().toUpperCase();
    if (!this.isValidFormat(clave)) {
      return { ok: false, mensaje: 'Formato de clave inválido. Ejemplo: PDV-VIP-ABCD-1234-EFGH-5678' };
    }

    try {
      const result = await this.validateOnline(clave);
      if (!result.ok) return result;

      const license = {
        clave,
        tipo: result.tipo,
        empresa: empresa || '',
        email: result.email || '',
        expira: result.expira || null,
        dispositivos: result.dispositivos || 1,
        dispositivoActual: result.dispositivoId || this.getDeviceId(),
        fechaActivacion: new Date().toISOString(),
        firma: result.firma || '',
        estado: 'activa'
      };

      localStorage.setItem(this.LICENSE_KEY, JSON.stringify(license));
      await Storage.log('licencia_activada', `Tipo: ${license.tipo}, Empresa: ${license.empresa}, Clave: ${clave.substring(0, 12)}...`);

      return { ok: true, tipo: license.tipo, mensaje: `Licencia activada para "${license.empresa}".` };
    } catch (e) {
      return { ok: false, mensaje: 'Error al validar. Intenta de nuevo.' };
    }
  },

  async validateOnline(clave) {
    if (!this.API_URL) {
      return this.validateOffline(clave);
    }

    const deviceId = this.getDeviceId();
    const response = await fetch(`${this.API_URL}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave, deviceId })
    });

    if (!response.ok) {
      throw new Error('API error');
    }

    return await response.json();
  },

  validateOffline(clave) {
    const parts = clave.split('-');
    if (parts.length !== 6) return { ok: false, mensaje: 'Formato inválido.' };

    const [prefix, tipo] = parts;
    if (prefix !== 'PDV') return { ok: false, mensaje: 'Prefijo inválido.' };
    if (!['VIP', 'PRO'].includes(tipo)) return { ok: false, mensaje: 'Tipo inválido.' };

    if (tipo === 'VIP') {
      return { ok: true, tipo: 'VIP', expira: null };
    }

    const year = parseInt(parts[2].substring(0, 2)) || 26;
    const month = parseInt(parts[2].substring(2, 4)) || 12;
    const expira = new Date(2000 + year, month, 28).toISOString();

    return { ok: true, tipo: 'PRO', expira };
  },

  isValidFormat(clave) {
    return /^PDV-(VIP|PRO)-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(clave);
  },

  getDeviceId() {
    let id = localStorage.getItem('pdv_device_id');
    if (!id) {
      id = 'dev_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('pdv_device_id', id);
    }
    return id;
  },

  async deactivate() {
    localStorage.removeItem(this.LICENSE_KEY);
    await Storage.log('licencia_desactivada', 'Licencia removida del dispositivo');
  },

  startPeriodicCheck() {
    const lastCheck = parseInt(localStorage.getItem('pdv_last_license_check') || '0');
    const daysSinceCheck = (Date.now() - lastCheck) / (1000 * 60 * 60 * 24);

    if (daysSinceCheck >= this.CHECK_INTERVAL_DAYS) {
      this.checkOnline().catch(() => {});
    }

    setInterval(() => this.checkOnline().catch(() => {}), 6 * 60 * 60 * 1000);
  },

  async checkOnline() {
    const license = this.getLocal();
    if (!license || !this.API_URL) return;

    try {
      const result = await this.validateOnline(license.clave);
      localStorage.setItem('pdv_last_license_check', Date.now().toString());

      if (!result.ok && result.mensaje) {
        license.estado = 'revocada';
        localStorage.setItem(this.LICENSE_KEY, JSON.stringify(license));
        UI.showToast('Tu licencia ha sido desactivada.', 'error');
      }
    } catch (e) {
      const lastCheck = parseInt(localStorage.getItem('pdv_last_license_check') || '0');
      const daysSince = (Date.now() - lastCheck) / (1000 * 60 * 60 * 24);

      if (daysSince > this.CHECK_INTERVAL_DAYS + this.GRACE_PERIOD_DAYS) {
        UI.showToast('Sin validación por muchos días. Conéctate para validar tu licencia.', 'warning');
      }
    }
  },

  renderStatus() {
    return this.getStatus().then(status => {
      let html = '<div class="card"><div class="card-header"><h3>🔑 Licencia</h3></div><div class="card-body">';

      if (status.tipo === 'DEMO') {
        html += `
          <div class="alert alert-warning mb-3">
            <span>⚠️</span>
            <div><strong>Modo Demo</strong> — ${status.diasRestantes} días restantes</div>
          </div>
          <div class="progress-bar mb-3">
            <div class="progress-fill" style="width: ${Math.max(0, (status.diasRestantes / this.DEMO_DAYS) * 100)}%"></div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-primary" onclick="License.showActivateForm()">🔑 Activar Licencia</button>
            <a href="https://tudominio.com/precios" target="_blank" class="btn btn-outline">🛒 Comprar Licencia</a>
          </div>
        `;
      } else if (status.activa) {
        const tipoColor = status.tipo === 'VIP' ? 'success' : 'info';
        html += `
          <div class="alert alert-${tipoColor} mb-3">
            <span>${status.tipo === 'VIP' ? '🟢' : '🔵'}</span>
            <div><strong>Licencia ${status.nombre}</strong> — Activa</div>
          </div>
          ${status.expira ? `<p class="text-muted">Expira: ${Utils.formatDate(status.expira)}</p>` : ''}
          ${status.diasRestantes !== undefined ? `<p class="text-muted">${status.diasRestantes} días restantes</p>` : ''}
          <button class="btn btn-outline btn-sm" onclick="License.deactivateConfirm()">Desactivar</button>
        `;
      } else {
        html += `
          <div class="alert alert-danger mb-3">
            <span>❌</span>
            <div>${Utils.escapeHtml(status.mensaje)}</div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-primary" onclick="License.showActivateForm()">🔑 Activar Licencia</button>
            <a href="https://tudominio.com/precios" target="_blank" class="btn btn-outline">🛒 Comprar</a>
          </div>
        `;
      }

      html += '</div></div>';
      return html;
    });
  },

  showActivateForm() {
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal" style="max-width:450px">
        <div class="modal-header">
          <h3>🔑 Activar Licencia</h3>
          <button class="modal-close" id="closeLicenseModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Clave de Licencia</label>
            <input type="text" class="form-control" id="licenseKeyInput" placeholder="PDV-PRO-XXXX-XXXX-XXXX-XXXX" style="text-transform:uppercase;font-family:monospace;font-size:14px" autocomplete="off" spellcheck="false">
            <div class="form-hint">Ejemplo: PDV-VIP-ABCD-1234-EFGH-5678</div>
          </div>
          <div class="form-group">
            <label class="form-label">Nombre de tu Empresa</label>
            <input type="text" class="form-control" id="licenseEmpresaInput" placeholder="Ej: Bodega La Esperanza" autocomplete="off">
            <div class="form-hint">Aparecerá en el sistema como identificación de licencia</div>
          </div>
          <div id="licenseActivateMsg"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="cancelLicenseModal">Cancelar</button>
          <button class="btn btn-primary" id="btnActivateLicense">🔓 Activar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = document.getElementById('licenseKeyInput');
    const empresaInput = document.getElementById('licenseEmpresaInput');
    const msgEl = document.getElementById('licenseActivateMsg');

    document.getElementById('closeLicenseModal').addEventListener('click', () => modal.remove());
    document.getElementById('cancelLicenseModal').addEventListener('click', () => modal.remove());

    setTimeout(() => input.focus(), 100);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnActivateLicense').click();
      }
    });

    input.addEventListener('paste', (e) => {
      setTimeout(() => {
        input.value = input.value.trim().toUpperCase().replace(/\s+/g, '');
      }, 0);
    });

    document.getElementById('btnActivateLicense').addEventListener('click', async () => {
      let clave = input.value;
      if (!clave) {
        clave = input.textContent || '';
      }
      clave = (clave || '').trim().toUpperCase().replace(/\s+/g, '');
      const empresa = empresaInput.value.trim();

      if (!clave) {
        msgEl.innerHTML = '<div class="alert alert-danger mt-2"><span>⚠️</span><div>Ingresa una clave válida (ej: PDV-VIP-ABCD-1234-EFGH-5678)</div></div>';
        input.focus();
        return;
      }

      if (!empresa) {
        msgEl.innerHTML = '<div class="alert alert-danger mt-2"><span>⚠️</span><div>Ingresa el nombre de tu empresa</div></div>';
        empresaInput.focus();
        return;
      }

      const btn = document.getElementById('btnActivateLicense');
      btn.disabled = true;
      btn.textContent = 'Validando...';

      const result = await License.activate(clave, empresa);

      if (result.ok) {
        msgEl.innerHTML = `<div class="alert alert-success mt-2"><span>✅</span><div>${Utils.escapeHtml(result.mensaje)}</div></div>`;
        setTimeout(() => {
          modal.remove();
          location.reload();
        }, 1500);
      } else {
        msgEl.innerHTML = `<div class="alert alert-danger mt-2"><span>⚠️</span><div>${Utils.escapeHtml(result.mensaje)}</div></div>`;
        btn.disabled = false;
        btn.textContent = '🔓 Activar';
      }
    });
  },

  deactivateConfirm() {
    UI.confirm('¿Desactivar la licencia? La app volverá a modo demo.', async () => {
      await this.deactivate();
      UI.showToast('Licencia desactivada', 'info');
      setTimeout(() => location.reload(), 1000);
    });
  }
};
