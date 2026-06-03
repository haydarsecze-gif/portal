'use client'
import { useState, useEffect } from 'react'
import { Bell, ShieldAlert, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function NotificationPermissionPrompt() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSecure, setIsSecure] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showBlockedModal, setShowBlockedModal] = useState(false)

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return
    
    // If already denied, show instructions modal immediately
    if (Notification.permission === 'denied') {
      setShowBlockedModal(true)
      return
    }

    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      
      if (perm === 'denied') {
        setShowBlockedModal(true)
      } else if (perm === 'granted') {
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

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check secure context
    setIsSecure(window.isSecureContext)

    // Only show if Web Push / Notification is supported
    if ('Notification' in window) {
      setPermission(Notification.permission)
      
      const dismissed = localStorage.getItem('portal_dismissed_notif_prompt') === 'true'
      
      // Show prompt if permission is 'default' or 'denied' (or if not secure, to warn them)
      // and they haven't explicitly dismissed it (unless it is insecure)
      if ((Notification.permission !== 'granted' && !dismissed) || !window.isSecureContext) {
        setIsVisible(true)
      }
    }

    // Set up global listener so other components can trigger the prompt/modal
    const handleTriggerPrompt = () => {
      setIsVisible(true)
      if ('Notification' in window) {
        if (Notification.permission === 'denied') {
          setShowBlockedModal(true)
        } else {
          handleRequestPermission()
        }
      }
    }

    window.addEventListener('trigger-notification-prompt', handleTriggerPrompt)
    return () => {
      window.removeEventListener('trigger-notification-prompt', handleTriggerPrompt)
    }
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem('portal_dismissed_notif_prompt', 'true')
    }
  }

  if (!isVisible && !showBlockedModal) return null

  return (
    <>
      {isVisible && (
        <div className="fixed bottom-6 right-6 left-6 sm:left-auto sm:w-96 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-[2rem] shadow-2xl z-[999] animate-in slide-in-from-bottom-12 duration-300">
          {!isSecure ? (
            <div className="flex flex-col gap-3 text-amber-600 dark:text-amber-400">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div className="text-left">
                  <h5 className="text-[11px] font-black uppercase tracking-wider">Insecure Connection</h5>
                  <p className="text-[10px] font-bold mt-1 leading-normal opacity-90">
                    Push notifications are blocked on HTTP. Deploy to HTTPS or use Ngrok to test alerts on mobile.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-1">
                <button 
                  onClick={handleDismiss}
                  className="px-4 py-2 border border-amber-500/20 hover:bg-amber-500/15 text-amber-500 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : permission === 'denied' ? (
            <div className="flex flex-col gap-3 text-red-600 dark:text-red-400">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                  <ShieldAlert size={20} className="animate-pulse" />
                </div>
                <div className="text-left">
                  <h5 className="text-[11px] font-black uppercase tracking-wider">System Alerts Blocked</h5>
                  <p className="text-[10px] font-bold mt-1 leading-normal opacity-90">
                    Notifications are disabled in your browser settings. You must manually unblock them to receive alerts.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => setShowBlockedModal(true)}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all cursor-pointer text-center shadow-md shadow-red-550/15"
                >
                  Unblock Alerts
                </button>
                <button 
                  onClick={handleDismiss}
                  className="px-4 py-3 border border-red-500/20 hover:bg-red-500/15 text-red-500 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                  <Bell size={20} className="animate-bounce" />
                </div>
                <div className="text-left">
                  <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Activate Lock Screen Alerts</h5>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                    Enable system notifications to receive instant updates when course materials, classes, or grades are posted.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleRequestPermission}
                  disabled={loading}
                  className="flex-1 py-3 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all cursor-pointer text-center shadow-md shadow-indigo-500/15"
                >
                  {loading ? 'Activating...' : 'Enable Alerts'}
                </button>
                <button 
                  onClick={handleDismiss}
                  className="px-4 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                >
                  Later
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Centered Instructions Modal for Blocked Permissions */}
      {showBlockedModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 relative flex flex-col gap-6 animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setShowBlockedModal(false)}
              className="absolute top-6 right-6 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-450 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col gap-4 text-center">
              <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-sm">
                <ShieldAlert size={28} className="animate-pulse" />
              </div>
              <div>
                <span className="inline-flex px-3 py-1 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 rounded-full">
                  System Blocked
                </span>
                <h3 className="text-xl font-black text-slate-850 dark:text-white uppercase tracking-tight mt-3">
                  Permissions Blocked
                </h3>
                <p className="text-xs font-bold text-slate-550 dark:text-slate-400 mt-2 leading-relaxed">
                  Your device or browser settings have blocked notification alerts for this portal. You must manually unblock them.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800/80 my-1" />

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Follow these simple steps:
              </h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900 p-3.5 rounded-2xl">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600/10 text-indigo-500 flex items-center justify-center text-xs font-black shrink-0">
                    1
                  </div>
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-350 leading-relaxed uppercase tracking-tight">
                    Look at the <span className="font-extrabold text-indigo-600 dark:text-indigo-400">URL bar</span> at the bottom of your browser screen.
                  </p>
                </div>
                
                <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900 p-3.5 rounded-2xl">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600/10 text-indigo-500 flex items-center justify-center text-xs font-black shrink-0">
                    2
                  </div>
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-350 leading-relaxed uppercase tracking-tight">
                    Tap the <span className="font-extrabold text-indigo-600 dark:text-indigo-400">bell icon (🚫 🔔)</span> on the left of the website domain.
                  </p>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900 p-3.5 rounded-2xl">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600/10 text-indigo-500 flex items-center justify-center text-xs font-black shrink-0">
                    3
                  </div>
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-350 leading-relaxed uppercase tracking-tight">
                    Change notifications from <span className="font-extrabold text-red-500">Blocked</span> to <span className="font-extrabold text-emerald-500">ALLOWED</span> (or slide the switch ON).
                  </p>
                </div>

                <div className="flex items-start gap-3 bg-amber-500/5 dark:bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-2xl">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center text-[10px] font-black shrink-0">
                    💡
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] font-black uppercase text-amber-700 dark:text-amber-500 tracking-wider">Android Background Settings</p>
                    <p className="text-[9px] font-bold text-amber-600 dark:text-amber-500/90 leading-normal mt-0.5 uppercase tracking-tight">
                      If you swipe close the app, Android may block background notifications. Go to Phone Settings → Apps → Student Portal → Battery, and choose &quot;Unrestricted&quot; (No Restrictions).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowBlockedModal(false)}
              className="w-full py-4 bg-gradient-to-r from-red-650 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-98 transition-all shadow-md shadow-red-950/10 cursor-pointer text-center"
            >
              I Understand, Got It
            </button>
          </div>
        </div>
      )}
    </>
  )
}
