'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Bell, BookOpen, FileText, CheckSquare, ShieldAlert, Trash2, X } from 'lucide-react'

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 1. Get current logged in user profile
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
        fetchNotifications(session.user.id)
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
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!userId) return

    // 3. Set up real-time listener for incoming notifications
    const channel = supabase
      .channel(`realtime_notifications_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications'
      }, (payload) => {
        const newNotif = payload.new
        if (newNotif.user_id === userId || !newNotif.user_id) {
          setNotifications(prev => [newNotif, ...prev])
          setUnreadCount(c => c + 1)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const fetchNotifications = async (uId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${uId},user_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setNotifications(data || [])
      setUnreadCount((data || []).filter((n: any) => !n.is_read).length)
    } catch (err) {
      console.error('Error fetching notifications:', err)
    }
  }

  const handleToggle = () => {
    setIsOpen(!isOpen)
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
        className="p-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl shadow-md hover:shadow-indigo-500/5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center backdrop-blur-md relative"
        title="Notifications"
      >
        <Bell size={20} className={unreadCount > 0 ? "animate-pulse" : ""} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 border-2 border-white dark:border-slate-900 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 bg-white/95 dark:bg-slate-950/95 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl shadow-2xl backdrop-blur-xl z-[999] p-4 flex flex-col gap-3 max-h-[420px] overflow-hidden animate-in zoom-in-95 duration-200">
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
                  <div className="flex-1 min-w-0" onClick={() => !n.is_read && markAsRead(n.id)}>
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
    </div>
  )
}
