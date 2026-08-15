const DB_NAME = 'PuntoDeVentaDB';
const DB_VERSION = 4;

const STORES = {
  config: 'config',
  categorias: 'categorias',
  productos: 'productos',
  clientes: 'clientes',
  facturas: 'facturas',
  pagos: 'pagos',
  caja: 'caja',
  operadores: 'operadores',
  compras: 'compras',
  servicios: 'servicios',
  proveedores: 'proveedores',
  bitacora: 'bitacora'
};

const Storage = {
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains(STORES.config)) {
          db.createObjectStore(STORES.config, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.categorias)) {
          const store = db.createObjectStore(STORES.categorias, { keyPath: 'id' });
          store.createIndex('nombre', 'nombre', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.productos)) {
          const store = db.createObjectStore(STORES.productos, { keyPath: 'id' });
          store.createIndex('categoriaId', 'categoriaId', { unique: false });
          store.createIndex('descripcion', 'descripcion', { unique: false });
          store.createIndex('activo', 'activo', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.clientes)) {
          const store = db.createObjectStore(STORES.clientes, { keyPath: 'id' });
          store.createIndex('nombre', 'nombre', { unique: false });
          store.createIndex('tipo', 'tipo', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.facturas)) {
          const store = db.createObjectStore(STORES.facturas, { keyPath: 'id' });
          store.createIndex('numero', 'numero', { unique: true });
          store.createIndex('estado', 'estado', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('clienteId', 'clienteId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.pagos)) {
          const store = db.createObjectStore(STORES.pagos, { keyPath: 'id' });
          store.createIndex('facturaId', 'facturaId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.caja)) {
          const store = db.createObjectStore(STORES.caja, { keyPath: 'id' });
          store.createIndex('fecha', 'fecha', { unique: false });
          store.createIndex('estado', 'estado', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.operadores)) {
          const store = db.createObjectStore(STORES.operadores, { keyPath: 'id' });
          store.createIndex('pin', 'pin', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.compras)) {
          const store = db.createObjectStore(STORES.compras, { keyPath: 'id' });
          store.createIndex('fecha', 'fecha', { unique: false });
          store.createIndex('proveedor', 'proveedor', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.servicios)) {
          const store = db.createObjectStore(STORES.servicios, { keyPath: 'id' });
          store.createIndex('numero', 'numero', { unique: true });
          store.createIndex('estado', 'estado', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('clienteId', 'clienteId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.proveedores)) {
          const store = db.createObjectStore(STORES.proveedores, { keyPath: 'id' });
          store.createIndex('nombre', 'nombre', { unique: false });
          store.createIndex('rif', 'rif', { unique: false });
          store.createIndex('activo', 'activo', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.bitacora)) {
          const store = db.createObjectStore(STORES.bitacora, { keyPath: 'id' });
          store.createIndex('fecha', 'fecha', { unique: false });
          store.createIndex('accion', 'accion', { unique: false });
          store.createIndex('operadorId', 'operadorId', { unique: false });
        }
      };

      request.onblocked = () => {
        console.warn('DB bloqueada. Cierra otras pestañas de la app.');
        UI.showToast('Cierra otras pestañas de la app y recarga', 'warning');
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        this.db.onversionchange = () => {
          this.db.close();
          UI.showToast('Actualización disponible. Recargando...', 'info');
          setTimeout(() => location.reload(), 1000);
        };
        resolve(this.db);
      };

      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  },

  _tx(storeName, mode = 'readonly') {
    if (!this.db) throw new Error('Database not initialized');
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  },

  async add(storeName, data) {
    return new Promise((resolve, reject) => {
      const store = this._tx(storeName, 'readwrite');
      const request = store.add(data);
      request.onsuccess = () => resolve(data);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async get(storeName, id) {
    return new Promise((resolve, reject) => {
      const store = this._tx(storeName, 'readonly');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const store = this._tx(storeName, 'readonly');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const store = this._tx(storeName, 'readonly');
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getOneByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const store = this._tx(storeName, 'readonly');
      const index = store.index(indexName);
      const request = index.get(value);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async update(storeName, data) {
    return new Promise((resolve, reject) => {
      const store = this._tx(storeName, 'readwrite');
      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const store = this._tx(storeName, 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async count(storeName) {
    return new Promise((resolve, reject) => {
      const store = this._tx(storeName, 'readonly');
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const store = this._tx(storeName, 'readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getConfig(key) {
    const result = await this.get(STORES.config, key);
    return result ? result.value : null;
  },

  async setConfig(key, value) {
    return this.update(STORES.config, { key, value });
  },

  async getNextInvoiceNumber() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORES.config, 'readwrite');
      const store = tx.objectStore(STORES.config);
      const request = store.get('secuenciaFactura');
      request.onsuccess = () => {
        const current = request.result ? request.result.value : 0;
        const next = current + 1;
        store.put({ key: 'secuenciaFactura', value: next });
        tx.oncomplete = () => resolve(String(next).padStart(6, '0'));
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async getNextServiceNumber() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORES.config, 'readwrite');
      const store = tx.objectStore(STORES.config);
      const request = store.get('secuenciaServicio');
      request.onsuccess = () => {
        const current = request.result ? request.result.value : 0;
        const next = current + 1;
        store.put({ key: 'secuenciaServicio', value: next });
        tx.oncomplete = () => resolve(String(next).padStart(6, '0'));
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async getFacturasByDate(date) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORES.facturas, 'readonly');
      const store = tx.objectStore(STORES.facturas);
      const index = store.index('createdAt');
      const range = IDBKeyRange.bound(date, date + '\uffff');
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getCajaByDate(date) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORES.caja, 'readonly');
      const store = tx.objectStore(STORES.caja);
      const index = store.index('fecha');
      const request = index.get(date);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getOpenCaja() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORES.caja, 'readonly');
      const store = tx.objectStore(STORES.caja);
      const index = store.index('estado');
      const request = index.get('abierta');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async exportAll() {
    const data = {};
    for (const [key, storeName] of Object.entries(STORES)) {
      data[key] = await this.getAll(storeName);
    }
    return data;
  },

  async importAll(data) {
    for (const [key, storeName] of Object.entries(STORES)) {
      if (data[key] && Array.isArray(data[key])) {
        await this.clear(storeName);
        for (const item of data[key]) {
          await this.add(storeName, item);
        }
      }
    }
  },

  async getProductsLowStock() {
    const all = await this.getAll(STORES.productos);
    return all.filter(p => p.activo && p.stockMinimo > 0 && p.cantidadExistencia <= p.stockMinimo);
  },

  async searchProducts(query) {
    const all = await this.getAll(STORES.productos);
    const q = query.toLowerCase();
    return all.filter(p =>
      p.activo &&
      (p.descripcion.toLowerCase().includes(q) ||
       (p.tipo && p.tipo.toLowerCase().includes(q)))
    );
  },

  async searchClientes(query) {
    const all = await this.getAll(STORES.clientes);
    const q = query.toLowerCase();
    return all.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      (c.apellido && c.apellido.toLowerCase().includes(q)) ||
      (c.cedula && c.cedula.includes(q)) ||
      (c.rif && c.rif.toLowerCase().includes(q))
    );
  },

  async getStoreCount(storeName) {
    return this.count(storeName);
  },

  async getDataSummary() {
    const summary = {};
    for (const [key, storeName] of Object.entries(STORES)) {
      summary[key] = await this.count(storeName);
    }
    return summary;
  },

  async verifyDataIntegrity() {
    const summary = await this.getDataSummary();
    const issues = [];
    if (summary.productos === 0) issues.push('No hay productos');
    if (summary.categorias === 0) issues.push('No hay categorías');
    return { summary, issues, ok: issues.length === 0 };
  },

  checkBackupReminder() {
    const lastBackup = localStorage.getItem('pdv_lastBackup');
    const now = Date.now();
    const daysSince = lastBackup ? (now - parseInt(lastBackup)) / (1000 * 60 * 60 * 24) : 999;

    if (daysSince > 7) {
      setTimeout(() => {
        UI.showToast('⏰ Recuerda exportar tus datos (Configuración > Exportar)', 'info');
      }, 5000);
    }
  },

  markBackupDone() {
    localStorage.setItem('pdv_lastBackup', Date.now().toString());
  },

  async log(accion, detalle, operadorId = '') {
    try {
      const entry = {
        id: Utils.generateId(),
        fecha: Utils.getNow(),
        accion,
        detalle: detalle || '',
        operadorId: operadorId || (Operadores.current ? Operadores.current.id : ''),
        operadorNombre: Operadores.current ? Operadores.current.nombre : 'Sistema'
      };
      await this.add(STORES.bitacora, entry);
    } catch (e) {
      console.warn('Error logging audit:', e);
    }
  },

  async autoSave() {
    if (!window.electronAPI || !window.electronAPI.autoSave) return;
    try {
      const data = await this.exportAll();
      const json = JSON.stringify(data);
      await window.electronAPI.autoSave(json);
    } catch (e) {
      console.warn('Auto-save error:', e);
    }
  },

  async autoLoad() {
    if (!window.electronAPI || !window.electronAPI.autoLoad) return false;
    try {
      const result = await window.electronAPI.autoLoad();
      if (result.ok && result.data) {
        const data = JSON.parse(result.data);
        const counts = {};
        for (const [key, storeName] of Object.entries(STORES)) {
          if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
            counts[key] = data[key].length;
          }
        }
        if (Object.keys(counts).length > 0) {
          await this.importAll(data);
          console.log('Auto-loaded backup from data/ folder:', counts);
          return true;
        }
      }
    } catch (e) {
      console.warn('Auto-load error:', e);
    }
    return false;
  },

  startAutoSave() {
    setInterval(() => this.autoSave(), 5 * 60 * 1000);

    window.addEventListener('beforeunload', () => {
      this.autoSave();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.autoSave();
      }
    });
  }
};
