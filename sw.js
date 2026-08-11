const CACHE_NAME = 'punto-de-venta-v4';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/theme.css',
  '/css/main.css',
  '/css/components.css',
  '/css/responsive.css',
  '/js/utils.js',
  '/js/storage.js',
  '/js/ui.js',
  '/js/config.js',
  '/js/inventory.js',
  '/js/categories.js',
  '/js/cashregister.js',
  '/js/invoice.js',
  '/js/payment.js',
  '/js/purchases.js',
  '/js/services.js',
  '/js/suppliers.js',
  '/js/clientes.js',
  '/js/operadores.js',
  '/js/pdf.js',
  '/js/whatsapp.js',
  '/js/reports.js',
  '/js/app.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetched;
    })
  );
});
