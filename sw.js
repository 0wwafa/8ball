const CACHE_NAME = '8-ball-pool-dynamic-cache-v3';
const version = 'v1.927';
const appShellFiles = [
  // Add any core files you want to pre-cache here
];
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
      console.log('Forcing deletion of critical files from cache...');
      // Delete the old, cached versions of our critical files.
      const criticalFileDeletions = Promise.all(
        criticalFiles.map(url => {
          console.log(`Deleting ${url}`);
          return cache.delete(url);
        })
      );

      // Find and delete any requests containing "gtag", "google", or "facebook".
      const unwantedDeletions = cache.keys().then(requests => {
        const deletePromises = [];
        requests.forEach(request => {
          if (request.url.includes('gtag') || request.url.includes('google') || request.url.includes('facebook')) {
            console.log(`Deleting unwanted request from cache: ${request.url}`);
            deletePromises.push(cache.delete(request));
          }
        });
        return Promise.all(deletePromises);
      });

      // Wait for all deletions to complete before claiming clients.
      return Promise.all([criticalFileDeletions, unwantedDeletions]);

    }).then(() => {
      // Now that the stale files are gone, take control of the clients.
      console.log('Stale files deleted. Claiming clients.');
      return self.clients.claim();
    })
  );
});


// FETCH: Your network-first logic is now guaranteed to work for index.html
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
