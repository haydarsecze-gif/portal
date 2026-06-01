'use client'
import { useEffect } from 'react'

export default function PWAClient() {
  useEffect(() => {
    // 1. Register the PWA service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('PWA Service Worker registered successfully:', registration.scope);
          })
          .catch((err) => {
            console.error('PWA Service Worker registration failed:', err);
          });
      });
    }

    // 2. Capture the PWA install prompt event
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
