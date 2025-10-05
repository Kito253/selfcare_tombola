/* Cache-first service worker */ 
const CACHE_NAME = 'tombola-cache-v3';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './service-worker.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k))))
  );
  self.clients.call;
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(()=>{});
        return resp;
      }).catch(() => {
        if (request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
