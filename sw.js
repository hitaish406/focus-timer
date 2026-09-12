/**
 * FOCUS — Service Worker
 *
 * Strategy: Cache-first for all app shell assets.
 * New deployments increment CACHE_VERSION to force clients to update.
 */

const CACHE_VERSION = 'focus-v1';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './timer.js',
  './settings.js',
  './audio.js',
  './notifications.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon.svg',
];

// ─── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  // Only handle GET requests to same origin
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (e.g. Google Fonts)
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFonts = url.hostname === 'fonts.googleapis.com' ||
                        url.hostname === 'fonts.gstatic.com';

  if (!isSameOrigin && !isGoogleFonts) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // Cache successful responses from our own origin
        if (response.ok && isSameOrigin) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // Offline fallback: serve index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
