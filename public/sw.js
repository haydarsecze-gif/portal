const CACHE_NAME = 'student-portal-v2';
const STATIC_ASSETS = [
  '/icon.svg',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  // Purge old versions of the cache to resolve stale chunk crashes immediately
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // 1. Only handle GET requests (prevents crashes on API/form submission methods)
  if (e.request.method !== 'GET') {
    return;
  }

  const url = new URL(e.request.url);

  // 2. Bypass cache entirely for Supabase endpoints, NextJS hot-reload, and API routes
  if (
    url.origin.includes('supabase.co') || 
    url.pathname.startsWith('/api/') || 
    url.pathname.includes('_next/webpack-hmr')
  ) {
    return;
  }

  // 3. Network First for Next.js assets, routes, and dynamic pages
  // This prevents hash-mismatches and build-version crashes on redeployment
  if (
    url.pathname.includes('_next/') || 
    url.pathname === '/' || 
    url.pathname.startsWith('/auth') || 
    url.pathname.startsWith('/dashboard') || 
    url.pathname.startsWith('/admin')
  ) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Cache successful Next.js assets to speed up subsequent load times
          if (response.status === 200 && url.pathname.includes('_next/')) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If offline, fallback to cache
          return caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return new Response('Offline: Limkokwing Network Connection Interrupted.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain' })
            });
          });
        })
    );
    return;
  }

  // 4. Cache First for static public files (manifest, logo, icons)
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request).then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        return new Response('Offline: Limkokwing Network Connection Interrupted.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      });
    })
  );
});
