const CACHE_NAME = 'cathay-app-v60-activity-log';
const urlsToCache = [
  './',
  'index.html',
  'hub-ui.css',
  'calc.html',
  'client.html',
  'photos.html',
  'photos.css',
  'photos.js',
  'auth.js',
  'hub-usage.mjs',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'calc_labor.html',  // 新增
  'calc_combo.html',  // 新增
  'calc_retire.html', // 新增
  'products.html',
  'prod_overflow_love.html',   // 新增
  'prod_accident.html',
  'prod_accident_history.html', 
  'prod_rider.html', 
  'prod_surgery.html', 
  'prod_bone.html',
  'prod_full_heart.html',
  'prod_full_heart.css',
  'prod_full_heart.js', 
  'prod_invest_enjoy.html',
  'prod_invest_taifu.html',
  'prod_invest_forever.html', 
  'prod_invest_full.html', 
  'event.html',
  'event_rules.html', // 新增
  'calc_ah.html',     // 新增
];

// 安裝 Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// 攔截網路請求：有快取就用快取，沒快取就上網抓
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('cathay-app-v') && key !== CACHE_NAME)
      .map(key => caches.delete(key)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.endsWith('/products.html')) {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request,copy)));
      }
      return response;
    }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});