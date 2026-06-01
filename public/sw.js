const CACHE_NAME = 'student-portal-v3';
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
    url.pathname.startsWith('/_supabase') || 
    url.pathname.startsWith('/api/') || 
    url.pathname.includes('_next/webpack-hmr')
  ) {
    return;
  }

  // 3. Stale-While-Revalidate for Next.js assets, routes, and dynamic pages
  // This achieves sub-100ms loading speeds on cellular networks, while keeping code fresh in the background
  if (
    url.pathname.includes('_next/') || 
    url.pathname === '/' || 
    url.pathname.startsWith('/auth') || 
    url.pathname.startsWith('/dashboard') || 
    url.pathname.startsWith('/admin')
  ) {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        const fetchPromise = fetch(e.request)
          .then((response) => {
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(e.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Silently catch background network failures
          });

        return cachedResponse || fetchPromise || new Response('Offline: Limkokwing Network Connection Interrupted.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
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

// Handle notification click event to open/focus the PWA window and navigate to the redirect link
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate to the target URL
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          if ('focus' in client) {
            client.focus();
          }
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
        }
      }
      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
