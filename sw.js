/**
 * Ledgio — Progressive Web App Service Worker
 * Version: 1.11.10
 * 
 * Provides:
 * - 100% offline access to all app features
 * - Instant asset caching (CSS, JS, Icons, Fonts)
 * - Automatic background update detection
 */

const LEDGIO_VERSION = '1.11.10';
const CACHE_NAME = 'ledgio-v1.11.10';

const APP_SHELL = [
  './',
  './index.html',
  './dashboard.html',
  './login.html',
  './signup.html',
  './terms.html',
  './privacy.html',
  './reset-password.html',
  './manifest.json',
  './assets/vendor/supabase.min.js',
  './assets/vendor/supabase.min.js?v=1.11.10',
  './assets/fonts/inter-variable.woff2',
  './assets/fonts/instrument-serif-italic.woff2',
  './assets/fonts/geist-mono-latin.woff2',
  './assets/fonts/geist-mono-latin-medium.woff2',
  './assets/vendor/chart.min.js',
  './assets/vendor/chart.min.js?v=1.11.10',
  './assets/css/auth-legal-v2.css',
  './assets/css/auth-legal-v2.css?v=1.11.10',
  './assets/css/tokens.min.css?v=1.11.10',
  './assets/img/auth-glints-v1.svg',
  './assets/js/auth-art-v1.js',
  './assets/img/hero-art-v1.webp',
  './assets/css/tokens.css',
  './assets/css/tokens.min.css',
  './assets/css/styles.css',
  './assets/css/styles-c1-v1.min.css',
  './assets/css/styles-c1-v1.min.css?v=1.11.10',
  './assets/css/dashboard.css',
  './assets/css/dashboard-theme-c2-v1.css?v=1.11.10',
  './assets/vendor/fontawesome-c2-v1.css',
  './assets/fonts/fa-solid-900-c2-v1.woff2',
  './assets/fonts/fa-regular-400-c2-v1.woff2',
  './assets/fonts/fa-brands-400-c2-v1.woff2',
  './assets/img/empty-voxels-c2-v1.svg',
  './assets/css/dashboard-c2-v1.min.css',
  './assets/css/dashboard-c2-v1.min.css?v=1.11.10',
  './assets/css/landing-b3-v2.css',
  './assets/css/landing-b3-v2.min.css',
  './assets/css/landing-b3-v2.min.css?v=1.11.10',
  './assets/js/app.js',
  './assets/js/app-c2-v1.min.js',
  './assets/js/app-c2-v1.min.js?v=1.11.10',
  './assets/js/auth.js',
  './assets/js/auth-c1-v1.min.js',
  './assets/js/auth-c1-v1.min.js?v=1.11.10',
  './assets/js/categories.js',
  './assets/js/categories.min.js',
  './assets/js/categories.min.js?v=1.11.10',
  './assets/js/expenses.js',
  './assets/js/expenses-c2-v1.min.js',
  './assets/js/expenses-c2-v1.min.js?v=1.11.10',
  './assets/js/goals.js',
  './assets/js/goals.min.js',
  './assets/js/goals.min.js?v=1.11.10',
  './assets/js/hero-ascii-v1.js',
  './assets/js/hero-ascii-v1.min.js',
  './assets/js/hero-ascii.js',
  './assets/js/hero-ascii-b3-v2.min.js',
  './assets/js/hero-ascii-b3-v2.min.js?v=1.11.10',
  './assets/js/closing-ascii-b3-v2.min.js',
  './assets/js/closing-ascii-b3-v2.min.js?v=1.11.10',
  './assets/js/income.js',
  './assets/js/income.min.js',
  './assets/js/income.min.js?v=1.11.10',
  './assets/js/landing-b3-v2.js',
  './assets/js/landing-b3-v2.min.js',
  './assets/js/landing-b3-v2.min.js?v=1.11.10',
  './assets/js/landing-mobile.js',
  './assets/js/landing-mobile-b3-v1.min.js',
  './assets/js/landing-mobile-b3-v1.min.js?v=1.11.10',
  './assets/js/loans.js',
  './assets/js/loans.min.js',
  './assets/js/loans.min.js?v=1.11.10',
  './assets/js/pwa-installer.js',
  './assets/js/pwa-installer.min.js',
  './assets/js/pwa-installer.min.js?v=1.11.10',
  './assets/js/supabase-config.js',
  './assets/js/supabase-config-b3-v1.min.js',
  './assets/js/supabase-config-b3-v1.min.js?v=1.11.10',
  './assets/js/sync-engine.js',
  './assets/js/sync-engine.min.js',
  './assets/js/sync-engine.min.js?v=1.11.10',
  './assets/js/vault.js',
  './assets/js/vault.min.js',
  './assets/js/vault.min.js?v=1.11.10',
  './assets/img/landing/screen_dashboard_dark.webp',
  './assets/img/landing/screen_dashboard_light.webp',
  './assets/img/smoke-haze.webp',
  './assets/img/hero-art-v1.webp',
  './assets/img/hero-art-sm-v1.webp',
  './assets/img/grain-dot.svg',
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

  // HTML Navigation: Network-First with Fast Timeout and Cache Fallback
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      Promise.race([
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return networkResponse;
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Navigation network timeout')), 2500))
      ]).catch(() => {
        return caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
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

// Notification Click Handler — Focus existing window or open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetPath = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : './dashboard.html';
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. If an app window is already open, focus it
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // 2. If no app window exists, open one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
