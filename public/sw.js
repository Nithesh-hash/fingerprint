// Service Worker for IsoMatrix (Network-first with offline fallback)
const CACHE_NAME = 'isomatrix-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

// Network-first strategy so updates are always seen immediately
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Don't intercept Vite HMR or dev requests
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/@') || url.pathname.includes('node_modules') || url.pathname.includes('src/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
