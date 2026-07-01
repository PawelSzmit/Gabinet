const CACHE_NAME = 'gabinet-v58';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/encryption.js',
  './js/utils.js',
  './js/data.js',
  './js/security.js',
  './js/local-store.js',
  './js/drive.js',
  './js/views/calendar.js',
  './js/views/patients.js',
  './js/views/finance.js',
  './js/views/settings.js',
  './js/app.js'
];
const APP_SHELL_FALLBACK = './index.html';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') {
    return;
  }

  // Nie cachuj żądań do Google APIs
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('accounts.google.com')) {
    return;
  }

  const isNavigationRequest =
    e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').includes('text/html');

  if (isNavigationRequest) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseClone));
          return response;
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match(APP_SHELL_FALLBACK)))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
