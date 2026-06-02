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

  // Bypass service worker caching entirely in local development (localhost)
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    return;
  }

  const url = new URL(e.request.url);

  // 2. Only cache static public assets (icons, manifest)
  const isStaticAsset = url.pathname === '/icon.svg' || 
                        url.pathname === '/manifest.json' || 
                        url.pathname === '/favicon.ico' || 
                        url.pathname.startsWith('/icons/');

  if (isStaticAsset) {
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
    return;
  }

  // 3. For all other files (Next.js scripts, API routes, Supabase, page HTML, etc.), 
  // do a clean, direct network pass-through to prevent any stale cache or loading hangs!
  // This guarantees that the app always loads the fresh live version when reopened.
  return;
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

// Listen to push events dispatched from the server
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || 'Student Portal Alert';
    
    const options = {
      body: payload.message || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      vibrate: [100, 50, 100], // Double-buzz to alert the user
      tag: payload.id || 'student-portal-alert',
      renotify: true,
      data: {
        url: payload.link || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('Error handling Web Push event in Service Worker:', err);
  }
});
