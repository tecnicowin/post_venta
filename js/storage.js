const DB_NAME = 'PuntoDeVentaDB';
const DB_VERSION = 2;

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
  servicios: 'servicios'
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
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
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
    const current = await this.getConfig('secuenciaFactura') || 0;
    const next = current + 1;
    await this.setConfig('secuenciaFactura', next);
    return String(next).padStart(6, '0');
  },

  async getNextServiceNumber() {
    const current = await this.getConfig('secuenciaServicio') || 0;
    const next = current + 1;
    await this.setConfig('secuenciaServicio', next);
    return String(next).padStart(6, '0');
  },

  async getFacturasByDate(date) {
    const all = await this.getAll(STORES.facturas);
    return all.filter(f => f.createdAt && f.createdAt.startsWith(date));
  },

  async getCajaByDate(date) {
    const all = await this.getAll(STORES.caja);
    return all.find(c => c.fecha === date);
  },

  async getOpenCaja() {
    const all = await this.getAll(STORES.caja);
    return all.find(c => c.estado === 'abierta');
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
  }
};
