const CACHE_NAME = 'cathay-app-v3';
const urlsToCache = [
  '/',
  'index.html',
  'client.html',
  'auth.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

// 安裝 Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// 攔截網路請求：有快取就用快取，沒快取就上網抓
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});