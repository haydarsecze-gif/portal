'use client'
import { useState, useEffect } from 'react'
import { Bell, ShieldAlert, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function NotificationPermissionPrompt() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSecure, setIsSecure] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check secure context
    setIsSecure(window.isSecureContext)

    // Only show if Web Push / Notification is supported
    if ('Notification' in window) {
      setPermission(Notification.permission)
      
      // Show prompt if permission is 'default' or 'denied' (or if not secure, to warn them)
      if (Notification.permission !== 'granted' || !window.isSecureContext) {
        setIsVisible(true)
      }
    }
  }, [])

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm === 'granted') {
        // Sync push subscription
        const reg = await navigator.serviceWorker.ready
        const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (publicVapidKey) {
          // Helper to convert base64 VAPID public key
          const padding = '='.repeat((4 - (publicVapidKey.length % 4)) % 4);
          const base64 = (publicVapidKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }

          let subscription = await reg.pushManager.getSubscription()
          if (!subscription) {
            subscription = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: outputArray
            })
          }

          if (subscription) {
            // Get user IDs
            let savedAccs = []
            try {
              savedAccs = JSON.parse(localStorage.getItem('portal_saved_accounts') || '[]')
            } catch (e) {}
            
            const savedUserIds = Array.isArray(savedAccs)
              ? savedAccs.map((a: any) => a.userId).filter(Boolean)
              : []

            const { data: { session } } = await supabase.auth.getSession()
            const currentUserId = session?.user?.id
            const allUserIds = [...new Set([currentUserId, ...savedUserIds])].filter(Boolean)

            await fetch('/api/notifications/subscribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                userIds: allUserIds,
                subscription: subscription
              })
            })
          }
        }
        setIsVisible(false)
      }
    } catch (err) {
      console.warn('Failed to enable push notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isVisible) return null

  return (
    <div className="w-full mb-5 animate-in slide-in-from-top duration-300 z-30 relative">
      {!isSecure ? (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-3xl p-4 sm:p-5 flex items-start sm:items-center justify-between gap-3 text-amber-600 dark:text-amber-400">
          <div className="flex items-start gap-3.5">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-left">
              <h5 className="text-[10px] font-black uppercase tracking-wider">Insecure Context: Push Blocked on Mobile</h5>
              <p className="text-[9px] font-bold mt-1 leading-relaxed opacity-90 max-w-[90%]">
                You are accessing the portal over HTTP. Modern mobile browsers block Service Workers & Web Push notifications on insecure connections. To enable push alerts on your phone, deploy to HTTPS (Vercel) or use an Ngrok tunnel (`npx ngrok http 3000`).
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsVisible(false)}
            className="p-2 hover:bg-amber-500/20 rounded-xl text-amber-500 shrink-0 cursor-pointer self-start sm:self-center"
          >
            <X size={16} />
          </button>
        </div>
      ) : permission === 'denied' ? (
        <div className="bg-red-500/10 border border-red-500/25 rounded-3xl p-4 sm:p-5 flex items-start sm:items-center justify-between gap-3 text-red-600 dark:text-red-400">
          <div className="flex items-start gap-3.5">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-left">
              <h5 className="text-[10px] font-black uppercase tracking-wider">System Notifications Blocked</h5>
              <p className="text-[9px] font-bold mt-1 leading-relaxed opacity-90 max-w-[90%]">
                Notifications have been blocked in your browser settings. To receive lock screen alerts when coursework or assignments are uploaded, reset your site permissions by clicking the lock/settings icon in your browser's URL bar and select "Allow".
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsVisible(false)}
            className="p-2 hover:bg-red-500/20 rounded-xl text-red-500 shrink-0 cursor-pointer self-start sm:self-center"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="bg-indigo-500/5 border border-indigo-550/15 dark:border-indigo-500/20 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-indigo-600 dark:text-indigo-400">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
              <Bell size={20} className="animate-bounce" />
            </div>
            <div className="text-left min-w-0">
              <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Activate Lock Screen Alerts</h5>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                Don't miss out on important updates. Enable system notifications to get immediate push alerts when course materials, classes, or grades are posted.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 max-sm:w-full">
            <button
              onClick={handleRequestPermission}
              disabled={loading}
              className="flex-1 sm:flex-none px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all cursor-pointer shadow-md shadow-indigo-500/15"
            >
              {loading ? 'Activating...' : 'Enable Alerts'}
            </button>
            <button 
              onClick={() => setIsVisible(false)}
              className="p-2 sm:p-3 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 text-slate-500 rounded-2xl transition-all cursor-pointer flex items-center justify-center"
              title="Dismiss prompt"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
