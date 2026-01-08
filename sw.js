const CACHE_NAME = '8-ball-pool-dynamic-cache-v3';
const version = 'v1.931';

const criticalFiles = [
  './',
  './index.html',
  './game.html',
  './manifest.json',
  './logo192.png',
  './favicon.ico'
];

// INSTALL: Force the new service worker to activate immediately.
self.addEventListener('install', event => {
  console.log(`Service worker ${version} installing...`);
  self.skipWaiting();
});

// ACTIVATE: Clean up the cache by deleting critical files, unwanted entries, and page routes.
self.addEventListener('activate', event => {
  console.log(`Service worker ${version} activating...`);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Cleaning up cache...');
      // Resolve critical file paths relative to the service worker's location for robust matching.
      const criticalFilePaths = criticalFiles.map(file => new URL(file, self.location.href).pathname);

      return cache.keys().then(requests => {
        const deletePromises = requests.map(request => {
          const url = new URL(request.url);
          const path = url.pathname;

          // Condition 1: Delete if it's a critical file (ignoring URL parameters).
          if (criticalFilePaths.includes(path)) {
            console.log(`Deleting critical file match from cache: ${request.url}`);
            return cache.delete(request);
          }

          // Condition 2: Delete unwanted third-party requests.
          if (url.href.includes('gtag') || url.href.includes('google') || url.href.includes('facebook')) {
            console.log(`Deleting unwanted request from cache: ${request.url}`);
            return cache.delete(request);
          }

          // Condition 3: Delete cached pages/routes (heuristic: no file extension).
          // This handles your request to delete items related to the location pathname.
          const lastPathComponent = path.substring(path.lastIndexOf('/') + 1);
          if (lastPathComponent && !lastPathComponent.includes('.')) {
            console.log(`Deleting potential page route from cache: ${request.url}`);
            return cache.delete(request);
          }
        });
        return Promise.all(deletePromises.filter(Boolean));
      });
    }).then(() => {
      // Now that the stale files are gone, take control of the clients.
      console.log('Cache cleanup complete. Claiming clients.');
      return self.clients.claim();
    })
  );
});


self.addEventListener('fetch', event => {
  // Do not cache anything that contains "gtag", "google", or "facebook" and only handle GET requests.
  if (event.request.method !== 'GET' || event.request.url.includes('gtag') || event.request.url.includes('google') || event.request.url.includes('facebook')) {
    return;
  }

  // Resolve critical file paths once for robust matching.
  const criticalFilePaths = criticalFiles.map(file => new URL(file, self.location.href).pathname);
  const requestPath = new URL(event.request.url).pathname;

  if (criticalFilePaths.includes(requestPath)) {
    // Network-first for critical files.
    event.respondWith(
      fetch(event.request)
      .then(networkResponse => {
        // On success, update the cache
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // If network fails, try to serve from cache (as a fallback)
        console.log('Network failed for critical file, serving from cache:', requestPath);
        return caches.match(event.request);
      })
    );
  } else {
    // Cache-first for all other static assets.
    event.respondWith(
      caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(networkResponse => {
          if (!networkResponse || (networkResponse.status !== 200 && networkResponse.status !== 0)) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
  }
});

