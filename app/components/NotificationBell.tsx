'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, supabaseRaw } from '@/lib/supabase'
import { Bell, BookOpen, FileText, CheckSquare, ShieldAlert, Trash2, X } from 'lucide-react'

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

export default function NotificationBell({ align = 'right' }: { align?: 'left' | 'right' }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [activeToast, setActiveToast] = useState<any | null>(null)
  
  const dropdownRef = useRef<HTMLDivElement>(null)
  const knownNotifIds = useRef<Set<string>>(new Set())
  const isFirstLoad = useRef(true)
  const toastTimeoutRef = useRef<any>(null)

  const triggerNotification = useCallback((newNotif: any) => {
    // 1. Show native browser notification if allowed and granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const title = newNotif.title || 'Student Portal Alert'
      const options = {
        body: newNotif.message || '',
        icon: '/icon.svg',
        badge: '/icon.svg',
        data: {
          url: newNotif.link || '/'
        }
      }

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, options).catch((err) => {
            console.warn('SW showNotification failed, falling back to window.Notification:', err)
            new Notification(title, options)
          })
        }).catch(() => {
          new Notification(title, options)
        })
      } else {
        new Notification(title, options)
      }
    }

    // 2. Show beautiful in-app toast notification
    setActiveToast(newNotif)
    
    // Clear old timeout
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => {
      setActiveToast(null)
    }, 6000)
  }, [])

  const fetchNotifications = useCallback(async (uId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${uId},user_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      
      const newNotifs = data || []
      
      if (isFirstLoad.current) {
        // First load, just record existing IDs to prevent historical popup spam
        newNotifs.forEach((n: any) => knownNotifIds.current.add(n.id))
        isFirstLoad.current = false
      } else {
        // Find any notifications that are new (not in knownNotifIds) and unread
        const freshUnread = newNotifs.filter((n: any) => !knownNotifIds.current.has(n.id) && !n.is_read)
        
        // Show native + in-app notification for each fresh unread
        freshUnread.forEach((n: any) => {
          triggerNotification(n)
          knownNotifIds.current.add(n.id)
        })
        
        // Ensure all currently fetched IDs are marked as known
        newNotifs.forEach((n: any) => knownNotifIds.current.add(n.id))
      }

      setNotifications(newNotifs)
      setUnreadCount(newNotifs.filter((n: any) => !n.is_read).length)
    } catch (err) {
      console.error('Error fetching notifications:', err)
    }
  }, [triggerNotification])

  const syncPushSubscription = useCallback(async (uId: string) => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission !== 'granted') return

    try {
      const reg = await navigator.serviceWorker.ready
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!publicVapidKey) return

      let subscription = await reg.pushManager.getSubscription()
      
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        })
      }

      // Gather other saved account userIds to enable push notifications on multiple accounts on the same device
      let savedAccs = []
      try {
        savedAccs = JSON.parse(localStorage.getItem('portal_saved_accounts') || '[]')
      } catch (e) {}
      
      const savedUserIds = Array.isArray(savedAccs)
        ? savedAccs.map((a: any) => a.userId).filter(Boolean)
        : []

      const allUserIds = [...new Set([uId, ...savedUserIds])]

      const sessionRes = await supabase.auth.getSession()
      const token = sessionRes.data.session?.access_token

      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          userId: uId,
          userIds: allUserIds,
          subscription: subscription
        })
      })
    } catch (err) {
      console.warn('Background push subscription sync failed:', err)
    }
  }, [])

  useEffect(() => {
    // 1. Get current logged in user profile
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
        fetchNotifications(session.user.id)
        syncPushSubscription(session.user.id)

        // Request browser permission for system notifications (PWA / Android / Phone app shortcut)
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'default') {
            Notification.requestPermission().then((perm) => {
              if (perm === 'granted') {
                syncPushSubscription(session.user.id)
              }
            }).catch((err) => {
              console.warn('Notification permission request rejected/failed:', err)
            })
          }
        }
      }
    }
    getSession()

    // 2. Set up click outside to close listener
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    }
  }, [fetchNotifications, syncPushSubscription])

  useEffect(() => {
    if (!userId) return

    let channel: any;
    try {
      // 3. Set up real-time listener for incoming notifications (using raw Supabase URL for WebSockets)
      channel = supabaseRaw
        .channel(`realtime_notifications_${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        }, (payload) => {
          try {
            const newNotif = payload.new
            if (newNotif && (newNotif.user_id === userId || !newNotif.user_id)) {
              if (knownNotifIds.current.has(newNotif.id)) return // Already handled by polling or previous event
              knownNotifIds.current.add(newNotif.id)
              
              setNotifications(prev => [newNotif, ...prev])
              setUnreadCount(c => c + 1)
              triggerNotification(newNotif)
            }
          } catch (e) {
            console.error('Error handling realtime notification insert:', e)
          }
        })
      
      // Defensively handle subscription statuses and reject logs to prevent WebKit bubbles
      channel.subscribe((status: string, err: any) => {
        if (status === 'CHANNEL_ERROR' || err) {
          console.warn('NotificationBell Realtime Channel Status:', status, err)
        }
      })
    } catch (e) {
      console.error('Failed to initialize Supabase Realtime channel:', e)
    }

    return () => {
      if (channel) {
        try {
          supabaseRaw.removeChannel(channel)
        } catch (e) {
          console.error('Error removing channel:', e)
        }
      }
    }
  }, [userId, triggerNotification])

  // 4. Setup resilient background fallback polling mechanism to bypass private DNS
  // blocks or WebSocket failures. Polls every 3 seconds when active for instant notifications.
  useEffect(() => {
    if (!userId) return

    const runPolling = () => {
      fetchNotifications(userId)
    }

    runPolling()

    let intervalId: any;
    const startInterval = (delay: number) => {
      if (intervalId) clearInterval(intervalId)
      intervalId = setInterval(runPolling, delay)
    }

    // Dynamic throttling: fast polling (3s) when active, slow (20s) in background
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startInterval(3000)
      } else {
        startInterval(20000)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Initial start
    startInterval(document.visibilityState === 'visible' ? 3000 : 20000)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [userId, fetchNotifications])

  const handleToggle = () => {
    setIsOpen(!isOpen)
    // Request permission on direct user interaction to satisfy iOS strict PWA rules
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        console.log('Notification permission status on click:', permission)
      }).catch((err) => {
        console.warn('Notification permission request failed:', err)
      })
    }
  }

  const markAllAsRead = async () => {
    if (!userId) return
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)

      if (error) throw error
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Error marking read:', err)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)

      if (error) throw error
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(c => Math.max(0, c - 1))
    } catch (err) {
      console.error('Error marking single read:', err)
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)

      if (error) throw error
      const target = notifications.find(n => n.id === id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      if (target && !target.is_read) {
        setUnreadCount(c => Math.max(0, c - 1))
      }
    } catch (err) {
      console.error('Error deleting notification:', err)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'assignment':
        return <FileText className="text-amber-500" size={16} />
      case 'material':
        return <BookOpen className="text-indigo-500" size={16} />
      case 'submission':
        return <CheckSquare className="text-emerald-500" size={16} />
      case 'approval':
        return <ShieldAlert className="text-blue-500" size={16} />
      default:
        return <Bell className="text-slate-400" size={16} />
    }
  }

  const formatTimeElapsed = (dateStr: string) => {
    if (!dateStr) return 'Just now'
    try {
      const safeDateStr = dateStr.includes(' ') && !dateStr.includes('T') 
        ? dateStr.replace(' ', 'T') 
        : dateStr
      const parsedTime = new Date(safeDateStr).getTime()
      if (isNaN(parsedTime)) return 'Just now'
      const elapsed = Date.now() - parsedTime
      const minutes = Math.floor(elapsed / 60000)
      if (isNaN(minutes) || minutes < 1) return 'Just now'
      if (minutes < 60) return `${minutes}m ago`
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return `${hours}h ago`
      const days = Math.floor(hours / 24)
      return `${days}d ago`
    } catch (e) {
      console.error("formatTimeElapsed error:", e)
      return 'Just now'
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="p-2 sm:p-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl shadow-md hover:shadow-indigo-500/5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center backdrop-blur-md relative"
        title="Notifications"
      >
        <Bell className={`w-[18px] h-[18px] sm:w-5 sm:h-5 ${unreadCount > 0 ? "animate-pulse" : ""}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 min-w-4 sm:min-w-5 h-4 sm:h-5 px-1 bg-red-500 border-2 border-white dark:border-slate-900 text-white text-[8px] sm:text-[9px] font-black rounded-full flex items-center justify-center animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`fixed sm:absolute inset-x-4 sm:inset-x-auto top-20 sm:top-auto sm:mt-3 w-auto sm:w-80 h-fit bg-white dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl shadow-2xl z-[999] p-4 flex flex-col gap-3 max-sm:max-h-[80vh] sm:max-h-[420px] overflow-hidden animate-in zoom-in-95 duration-200 ${
          align === 'left' ? 'sm:left-0 sm:right-auto' : 'sm:right-0 sm:left-auto'
        }`}>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-2">
            <div>
              <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Inbox Notifications</h4>
              <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                {unreadCount} Unread alerts
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 uppercase tracking-widest cursor-pointer bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg"
              >
                Mark Read
              </button>
            )}
          </div>

          {/* System Notification Permission Request Banner */}
          {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100/30 dark:border-indigo-900/30 p-3.5 rounded-2xl flex flex-col gap-2 mb-1 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                <Bell size={12} className="animate-bounce" /> Enable Lock Screen Alerts
              </div>
              <p className="text-[8px] font-bold text-slate-500 dark:text-slate-450 leading-normal uppercase tracking-wide">
                Get instant notifications on your system & lock screen when coursework is uploaded!
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const permission = await Notification.requestPermission()
                    if (permission === 'granted' && userId) {
                      await syncPushSubscription(userId)
                      triggerNotification({
                        title: 'System Alerts Activated! 🎉',
                        message: 'You will now receive lock screen and instant device notifications.',
                        type: 'system'
                      })
                    }
                  } catch (err) {
                    console.error('Error enabling lock screen alerts:', err)
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 rounded-xl font-black text-[8px] uppercase tracking-widest transition-all cursor-pointer text-center shadow-sm"
              >
                Allow Lock Screen Alerts
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 max-h-[320px] pr-1">
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-3 rounded-2xl border transition-all relative group ${
                    n.is_read
                      ? 'bg-transparent border-slate-100/50 dark:border-slate-900/50 opacity-70'
                      : 'bg-indigo-50/30 dark:bg-indigo-950/10 border-indigo-100/30 dark:border-indigo-900/10 shadow-xs'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    n.is_read ? 'bg-slate-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-900 shadow-xs'
                  }`}>
                    {getIcon(n.type)}
                  </div>
                  <div 
                    className="flex-1 min-w-0 cursor-pointer" 
                    onClick={() => {
                      if (!n.is_read) markAsRead(n.id)
                      if (n.link) {
                        router.push(n.link)
                        setIsOpen(false)
                      } else if (n.type === 'assignment' || n.type === 'material') {
                        router.push('/dashboard/student')
                        setIsOpen(false)
                      }
                    }}
                  >
                    <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight leading-tight truncate">{n.title}</p>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-1 font-bold leading-normal truncate-2-lines">{n.message}</p>
                    <p className="text-[7px] text-slate-400 dark:text-slate-650 mt-1.5 uppercase font-black tracking-widest leading-none">
                      {formatTimeElapsed(n.created_at)}
                    </p>
                  </div>

                  <button
                    onClick={() => deleteNotification(n.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-350 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-all cursor-pointer shrink-0"
                    title="Delete notification"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400 dark:text-slate-600 flex flex-col items-center justify-center gap-2">
                <Bell size={24} className="opacity-30" />
                <p className="text-[9px] font-black uppercase tracking-widest">No notifications found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* In-App Slide-down Toast Notification Banner */}
      {activeToast && (
        <div 
          onClick={() => {
            if (!activeToast.is_read) markAsRead(activeToast.id)
            if (activeToast.link) {
              router.push(activeToast.link)
            } else if (activeToast.type === 'assignment' || activeToast.type === 'material') {
              router.push('/dashboard/student')
            }
            setActiveToast(null)
          }}
          className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-3xl shadow-2xl z-[99999] flex gap-3 cursor-pointer items-start animate-in slide-in-from-top-12 duration-300 hover:shadow-indigo-500/5 select-none"
        >
          <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-850 flex items-center justify-center shrink-0 shadow-sm">
            {getIcon(activeToast.type)}
          </div>
          <div className="flex-1 min-w-0 pr-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-[8px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 rounded-md mb-1 border border-indigo-100/30">
              ⚡ Alert
            </span>
            <h5 className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight">{activeToast.title}</h5>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 leading-normal break-words">{activeToast.message}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setActiveToast(null)
            }}
            className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-450 dark:text-slate-400 rounded-xl transition-all cursor-pointer shrink-0 border border-transparent hover:border-slate-200/50"
            title="Dismiss Alert"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
