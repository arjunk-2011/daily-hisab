const CACHE = "daily-hisab-by-ak-v3";
const ASSETS = ["./","./index.html","./style.css","./app.js","./i18n.js","./manifest.json","./icon.svg","./icon-192.png","./icon-512.png","./icon-maskable-512.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone(); caches.open(CACHE).then(c => c.put(event.request, copy)); return response;
  }).catch(() => caches.match("./index.html"))));
});
