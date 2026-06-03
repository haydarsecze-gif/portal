'use client'
import { useEffect } from 'react'

// Helper function to convert base64 VAPID public key to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PWAClient() {
  useEffect(() => {
    // 1. Register the PWA service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('PWA Service Worker registered successfully:', registration.scope);
            
            // 2. Perform global push subscription sync for all saved accounts if permission is granted
            if ('PushManager' in window && Notification.permission === 'granted') {
              const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
              if (publicVapidKey) {
                navigator.serviceWorker.ready.then(async (reg) => {
                  try {
                    let subscription = await reg.pushManager.getSubscription();
                    if (!subscription) {
                      const Uint8ArrayKey = urlBase64ToUint8Array(publicVapidKey);
                      subscription = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: Uint8ArrayKey
                      });
                    }

                    if (subscription) {
                      let savedAccs = [];
                      try {
                        savedAccs = JSON.parse(localStorage.getItem('portal_saved_accounts') || '[]');
                      } catch (e) {}

                      const savedUserIds = Array.isArray(savedAccs)
                        ? savedAccs.map((a: any) => a.userId).filter(Boolean)
                        : [];

                      if (savedUserIds.length > 0) {
                        await fetch('/api/notifications/subscribe', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({
                            userIds: savedUserIds,
                            subscription: subscription
                          })
                        });
                      }
                    }
                  } catch (err) {
                    console.warn('Global push subscription sync failed:', err);
                  }
                });
              }
            }
          })
          .catch((err) => {
            console.error('PWA Service Worker registration failed:', err);
          });
      });
    }

    // 3. Capture the PWA install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // Store the event on the window object so any page/component can trigger it
      (window as any).deferredPrompt = e;
      // Dispatch a custom event to notify components that the app is installable
      window.dispatchEvent(new Event('pwa-installable'));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  return null;
}

