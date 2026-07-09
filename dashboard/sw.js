const CACHE_NAME = 'upbs-cache-v23';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/student-dashboard.html',
  '/admin-dashboard.html',
  '/css/style.css',
  '/js/theme.js',
  '/js/student.js',
  '/js/admin-search.js',
  '/js/analytics.js',
  '/js/bike.js',
  '/js/history.js',
  '/js/map.js',
  '/js/settings.js',
  '/js/sms.js',
  '/manifest.json'
];

// Install Event: cache all core static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Pre-caching offline assets...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: clear old cache versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache...', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: network fallback with cache fallback (stale-while-revalidate)
self.addEventListener('fetch', event => {
  // Only handle HTTP/HTTPS (skip chrome-extension, etc.)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip API network calls (let dynamic data fetch fresh from DB)
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Return cached asset, and update in background
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(err => console.log('[Service Worker] Offline background update skipped.'));
        return cachedResponse;
      }

      // Fetch from network for uncached pages
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        return networkResponse;
      });
    })
  );
});
