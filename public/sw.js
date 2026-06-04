// Panelia Service Worker
// Strategy: Stale-while-revalidate for static assets, network-first for pages, bypass for API

const CACHE_NAME = 'panelia-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
];

// Assets to cache on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Always let API and proxy requests pass through unchanged — SW caching breaks them
  if (
    url.pathname.startsWith('/api/') ||
    request.method !== 'GET'
  ) {
    return; // Let browser handle natively
  }

  // Stale-while-revalidate for static assets and pages
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const fetched = fetch(request)
          .then((response) => {
            // Only cache successful non-API, non-proxy responses
            if (response.ok && !url.pathname.startsWith('/api/')) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached || new Response('Offline', { status: 503 }));

        return cached || fetched;
      })
    )
  );
});