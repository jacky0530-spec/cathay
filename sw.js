// V1.0 security: NEVER serve cached authentication, customer, or HTML pages.
// Firebase authentication requires an online connection; do not fall back to stale offline pages.
const CACHE_NAME='cathay-app-v1.0.1';
const ASSETS=[
  'assets/css/section.css','manifest.json','icon-192.png','icon-512.png'
];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(ASSETS.map(path=>cache.add(new Request(path,{cache:'reload'}))));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const all=await caches.keys();
    await Promise.all(all.filter(k=>k.startsWith('cathay-app-')&&k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request, url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  // A stale auth.js could silently restore insecure login; always request the current code.
  const needsFreshNetwork=request.mode==='navigate' ||
    /\/$|\.(?:html?|js|mjs)$/i.test(url.pathname);
  if(needsFreshNetwork){
    event.respondWith(fetch(request,{cache:'no-store'}));
    return;
  }
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const saved=await cache.match(request);
    if(saved)return saved;
    const response=await fetch(request);
    if(response.ok)cache.put(request,response.clone());
    return response;
  })());
});
