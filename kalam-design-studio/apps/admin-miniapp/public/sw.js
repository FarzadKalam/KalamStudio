/*
 * Minimal, dependency-free app-shell worker. API, uploads and Telegram calls
 * are never cached: the worker only makes the installed Studio resilient to a
 * short network interruption while keeping all live data server-authoritative.
 */
// Bump whenever the app-shell filenames are kept stable by a constrained
// deployment. This ensures an older cached bundle cannot keep a broken UI alive.
const CACHE_NAME = 'kalam-studio-shell-v2';
const CORE_ASSETS = [
  './',
  './manifest.webmanifest',
  './brand/kalametaze-profile.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('kalam-studio-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

function isStudioAsset(requestUrl) {
  const scopePath = new URL(self.registration.scope).pathname;
  return requestUrl.pathname.startsWith(scopePath);
}

function isLiveApi(requestUrl) {
  return requestUrl.pathname.includes('/api/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin || !isStudioAsset(requestUrl) || isLiveApi(requestUrl)) {
    return;
  }

  if (request.mode === 'navigate') {
    // Prefer a freshly deployed UI, with the cached app shell only as a
    // fallback if the user temporarily loses connectivity.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./'))),
    );
    return;
  }

  // Hashed Vite assets are immutable. Cache-first avoids downloading the app
  // shell every time the installed application is opened.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    })),
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(payload.title || 'استودیو کلام تازه', {
    body: payload.body || 'یک رویداد جدید دارید.',
    icon: './brand/kalametaze-profile.jpg',
    badge: './brand/kalametaze-profile.jpg',
    data: { url: payload.url || './' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || './', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) return existing.focus().then(() => existing.navigate(url));
    return clients.openWindow(url);
  }));
});
