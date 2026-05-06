const CACHE_NAME = 'hawk-shell-v1';

// Operational endpoints that must NEVER be cached or intercepted.
// The SW passes these straight to the network.
const BYPASS_PATTERNS = [
  /^\/api\//,
  /^\/auth\//,
  /^\/login/,
  /^\/logout/,
  /\/scan/,
  /\/order/,
  /\/fulfillment/,
  /\/report/,
  /\/users/,
  /\/user-management/,
  /\/media\//,
  /\/camera/,
  /\/health/,
];

function shouldBypass(url) {
  const { pathname } = new URL(url);
  return BYPASS_PATTERNS.some((pattern) => pattern.test(pathname));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        '/',
        '/mobile',
        '/manifest.webmanifest',
        '/pwa-192.png',
        '/pwa-512.png',
      ])
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Explicitly bypass all operational endpoints — never cache, never intercept.
  if (shouldBypass(event.request.url)) {
    return; // falls through to browser default (network)
  }

  // Only cache GET requests for shell assets.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
