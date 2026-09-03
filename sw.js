/**
 * Ledgio — Progressive Web App Service Worker
 * Version: 1.3.2
 * 
 * Provides:
 * - 100% offline access to all app features
 * - Instant asset caching (CSS, JS, Icons, Fonts)
 * - Automatic background update detection
 */

const CACHE_NAME = 'ledgio-v1.3.2';

const APP_SHELL = [
  './',
  './index.html',
  './dashboard.html',
  './login.html',
  './signup.html',
  './manifest.json',
  './assets/css/styles.css',
  './assets/css/styles.min.css',
  './assets/css/dashboard.css',
  './assets/css/dashboard.min.css',
  './assets/js/app.js',
  './assets/js/app.min.js',
  './assets/js/auth.js',
  './assets/js/auth.min.js',
  './assets/js/pwa-installer.js',
  './assets/js/pwa-installer.min.js',
  './assets/js/supabase-config.js',
  './assets/js/supabase-config.min.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon.png'
];

// Install: Cache App Shell Immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn('Some optional assets failed to precache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Purge Outdated Caches & Claim Clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate & Offline-First Strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore non-GET requests or Supabase/API requests
  if (request.method !== 'GET' || request.url.includes('supabase.co')) {
    return;
  }

  // HTML Navigation: Network-First with Cache Fallback
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            // Default fallback
            return caches.match('./dashboard.html') || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Static Assets (CSS, JS, Fonts, Images, CDNs): Cache-First with Background Update
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline network error handled silently
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Skip Waiting Message Trigger
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
