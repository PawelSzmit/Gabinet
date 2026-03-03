const CACHE_NAME = 'gabinet-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/js/data.js',
  '/js/drive.js',
  '/js/utils.js',
  '/js/views/calendar.js',
  '/js/views/patients.js',
  '/js/views/finance.js',
  '/js/views/settings.js',
  '/js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
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
  // Nie cachuj żądań do Google APIs
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('accounts.google.com')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
