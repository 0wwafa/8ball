const CACHE_NAME = '8-ball-pool-dynamic-cache-v3';
const version = 'v1.930';

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

// ACTIVATE: Clean up the cache by deleting critical files and any specified entries.
self.addEventListener('activate', event => {
  console.log(`Service worker ${version} activating...`);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Cleaning up cache...');
      return cache.keys().then(requests => {
        const deletePromises = requests.map(request => {
          const url = new URL(request.url);
          // Check if the path is a critical file, ignoring URL parameters.
          if (criticalFiles.includes(url.pathname)) {
            console.log(`Deleting critical file match from cache: ${request.url}`);
            return cache.delete(request);
          }

          // Check for and delete any unwanted requests.
          if (url.href.includes('gtag') || url.href.includes('google') || url.href.includes('facebook')) {
            console.log(`Deleting unwanted request from cache: ${request.url}`);
            return cache.delete(request);
          }
        });
        return Promise.all(deletePromises);
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

  const requestUrl = new URL(event.request.url);
  const requestPath = requestUrl.pathname;

  // Use includes() to correctly match '/' and '/index.html'
  if (criticalFiles.includes(requestPath)) {
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

