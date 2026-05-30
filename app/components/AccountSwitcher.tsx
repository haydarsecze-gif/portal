'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { User, Users, LogOut, Loader2, Plus, Trash2, Check, Sparkles, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AccountSwitcher({ align = 'right' }: { align?: 'left' | 'right' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [savedAccounts, setSavedAccounts] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [currentProfile, setCurrentProfile] = useState<any>(null)
  const [isSwitching, setIsSwitching] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Premium Alert/Confirm Dialog Modal State
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'success' | 'warning';
    onConfirm?: () => void;
    onCancel?: () => void;
    isConfirm?: boolean;
  }>({ isOpen: false, title: '', message: '', type: 'info' })

  useEffect(() => {
    // 1. Fetch current session user
    const getUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentUser(user)
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          if (profile) {
            setCurrentProfile(profile)
          }
        }
      } catch (err) {
        console.error('Error fetching user data:', err)
      }
    }
    getUserData()

    // 2. Load saved accounts from localStorage
    try {
      let saved = JSON.parse(localStorage.getItem('portal_saved_accounts') || '[]')
      if (!Array.isArray(saved)) {
        saved = []
      }

      // Filter out invalid/corrupt entries
      saved = saved.filter((acc: any) => acc && typeof acc === 'object' && typeof acc.email === 'string' && acc.email.trim() !== '')

      setSavedAccounts(saved)
    } catch (e) {
      console.error('Failed to parse saved accounts:', e)
    }

    // 3. Set up click outside listener
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggle = () => setIsOpen(!isOpen)

  const handleSwitchAccount = async (targetAccount: any) => {
    setIsSwitching(true)
    setIsOpen(false)
    try {
      await supabase.auth.signOut()
      
      let loggedIn = false
      let loginError = null

      // 1. Try password login if password exists
      if (targetAccount.password) {
        let decPassword = ''
        try {
          decPassword = atob(targetAccount.password)
        } catch (e) {
          decPassword = targetAccount.password
        }

        if (decPassword && decPassword !== 'undefined') {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: targetAccount.email,
            password: decPassword
          })
          if (!error && data.user && data.session) {
            loggedIn = true
          } else {
            loginError = error
          }
        }
      }

      // 2. Fallback to setSession ONLY if no password exists in saved credentials (supports old token-only cache)
      if (!loggedIn && !targetAccount.password && targetAccount.access_token) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: targetAccount.access_token,
            refresh_token: targetAccount.refresh_token
          })
          if (!error && data.user && data.session) {
            loggedIn = true
          } else {
            if (!loginError) loginError = error
          }
        } catch (e) {
          console.warn('setSession fallback failed:', e)
        }
      }

      if (!loggedIn) {
        throw loginError || new Error('No valid session credentials found.')
      }

      // Successful login
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Assert email match to prevent hijacked / legacy token mismatch login
        if (user.email && targetAccount.email && user.email.toLowerCase() !== targetAccount.email.toLowerCase()) {
          console.error("Mismatch during switch login:", user.email, targetAccount.email)
          await supabase.auth.signOut()
          throw new Error("Mismatched session tokens. Please log in manually.")
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', user.id)
          .single()

        const role = profile?.role || targetAccount.role

        // Update name/role in localStorage
        const saved = JSON.parse(localStorage.getItem('portal_saved_accounts') || '[]')
        const idx = saved.findIndex((a: any) => a.email.toLowerCase() === targetAccount.email.toLowerCase())
        if (idx > -1) {
          saved[idx].role = role
          saved[idx].name = profile?.full_name || saved[idx].name
          localStorage.setItem('portal_saved_accounts', JSON.stringify(saved))
        }

        const targetUrl = role === 'admin'
          ? '/admin/students'
          : role === 'teacher'
            ? '/dashboard/lecturer'
            : '/dashboard/student'
        
        setTimeout(() => {
          window.location.href = targetUrl
        }, 150)
      }
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: 'Session Expired',
        message: 'Session expired. Please log in manually to re-establish this account.',
        type: 'error',
        onConfirm: () => {
          window.location.href = '/auth/login'
        }
      })
    } finally {
      setIsSwitching(false)
    }
  }

  const handleRemoveAccount = (emailToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = savedAccounts.filter(a => a?.email && emailToRemove && a.email.toLowerCase() !== emailToRemove.toLowerCase())
    setSavedAccounts(updated)
    localStorage.setItem('portal_saved_accounts', JSON.stringify(updated))
  }

  const handleAddNewAccount = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  // Get Initials for Avatar
  const getInitials = () => {
    try {
      if (currentProfile?.full_name) {
        const cleanName = currentProfile.full_name.trim().replace(/\s+/g, ' ')
        if (cleanName) {
          const parts = cleanName.split(' ')
          if (parts.length > 1 && parts[0]?.[0] && parts[1]?.[0]) {
            return (parts[0][0] + parts[1][0]).toUpperCase()
          }
          if (parts[0]) {
            return parts[0].substring(0, 2).toUpperCase()
          }
        }
      }
      if (currentUser?.email) {
        return currentUser.email.substring(0, 2).toUpperCase()
      }
    } catch (err) {
      console.error("Error getting initials:", err)
    }
    return 'U'
  }

  const getRoleLabel = (role?: string) => {
    if (!role) return 'Student'
    switch (role) {
      case 'admin': return 'Administrator'
      case 'teacher': return 'Lecturer'
      default: return 'Student'
    }
  }

  const getRoleBadgeStyle = (role?: string) => {
    if (!role) return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
    switch (role) {
      case 'admin': return 'bg-rose-500/10 border-rose-500/20 text-rose-500'
      case 'teacher': return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500'
      default: return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {isSwitching && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center z-[9999] animate-in fade-in duration-200">
          <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
          <p className="text-xs font-black uppercase tracking-widest text-slate-300">Switching Account Session...</p>
        </div>
      )}

      <button
        onClick={handleToggle}
        className="flex items-center gap-2 pl-3 pr-4 py-2 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/30 text-slate-700 dark:text-slate-200 rounded-2xl shadow-md hover:shadow-indigo-500/5 transition-all duration-300 active:scale-95 cursor-pointer backdrop-blur-md relative"
        title="Switch Account"
      >
        <div className="w-6 h-6 bg-gradient-to-tr from-indigo-600 to-blue-600 text-white rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm">
          {getInitials()}
        </div>
        <div className="text-left hidden md:block max-w-[80px]">
          <p className="text-[9px] font-black uppercase truncate leading-none">
            {currentProfile?.full_name || 'My Portal'}
          </p>
          <p className="text-[7.5px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate mt-0.5 leading-none">
            {getRoleLabel(currentProfile?.role)}
          </p>
        </div>
        <ChevronDown size={12} className="text-slate-400 dark:text-slate-650 shrink-0" />
      </button>

      {isOpen && (
        <div className={`fixed sm:absolute inset-x-4 sm:inset-x-auto top-20 sm:top-auto sm:mt-3 w-auto sm:w-80 bg-white/95 dark:bg-slate-950/95 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl shadow-2xl backdrop-blur-xl z-[999] p-4 flex flex-col gap-3 max-sm:max-h-[calc(100vh-7rem)] sm:max-h-[480px] overflow-hidden animate-in zoom-in-95 duration-200 ${
          align === 'left' ? 'sm:left-0 sm:right-auto' : 'sm:right-0 sm:left-auto'
        }`}>
          
          {/* Active Profile Info */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-blue-600 text-white rounded-xl flex items-center justify-center text-xs font-black shrink-0 shadow-md shadow-indigo-500/10">
              {getInitials()}
            </div>
            <div className="min-w-0 flex-1">
              <span className={`inline-flex px-2 py-0.5 border rounded-md text-[7px] font-black uppercase tracking-wider ${getRoleBadgeStyle(currentProfile?.role)}`}>
                {getRoleLabel(currentProfile?.role)}
              </span>
              <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase truncate mt-1 leading-none">
                {currentProfile?.full_name || 'Active Profile'}
              </h4>
              <p className="text-[8.5px] font-bold text-slate-450 dark:text-slate-500 truncate mt-0.5">
                {currentUser?.email}
              </p>
            </div>
            <div className="w-5 h-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center shrink-0" title="Active">
              <Check size={10} strokeWidth={3} />
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-900 my-1" />

          {/* Saved / Switchable Accounts */}
          <div>
            <h5 className="text-[8.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 mb-2">
              Switch Accounts
            </h5>

            <div className="overflow-y-auto custom-scrollbar max-h-[180px] flex flex-col gap-2 pr-1">
              {savedAccounts.filter(acc => acc?.email && acc.email.toLowerCase() !== currentUser?.email?.toLowerCase()).length > 0 ? (
                savedAccounts
                  .filter(acc => acc?.email && acc.email.toLowerCase() !== currentUser?.email?.toLowerCase())
                  .map((acc, index) => (
                    <div
                      key={index}
                      onClick={() => handleSwitchAccount(acc)}
                      className="flex items-center justify-between p-2.5 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900/40 border border-slate-100/30 dark:border-slate-900/30 hover:border-slate-200/50 dark:hover:border-slate-800/50 rounded-2xl cursor-pointer group transition-all duration-300"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-lg flex items-center justify-center text-[9px] font-black uppercase shrink-0">
                          {acc.name ? acc.name.substring(0, 2).toUpperCase() : (acc.email ? acc.email.substring(0, 2).toUpperCase() : 'US')}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase truncate leading-none">
                            {acc.name || acc.email}
                          </p>
                          <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 truncate mt-0.5 leading-none">
                            {acc.email} • {getRoleLabel(acc.role)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleRemoveAccount(acc.email || '', e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-350 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-all cursor-pointer shrink-0"
                        title="Remove Account"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
              ) : (
                <div className="py-6 text-center text-slate-400 dark:text-slate-655 flex flex-col items-center justify-center gap-1.5">
                  <Users size={18} className="opacity-30" />
                  <p className="text-[8px] font-black uppercase tracking-widest">No other saved accounts</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-900 my-1" />

          {/* Action buttons */}
          <div className="grid gap-2">
            <button
              onClick={handleAddNewAccount}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-md shadow-indigo-500/10 cursor-pointer"
            >
              <Plus size={12} strokeWidth={3} /> Add Account
            </button>
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-red-50 dark:bg-slate-900 dark:hover:bg-red-950/20 text-slate-600 hover:text-red-550 dark:text-slate-300 dark:hover:text-red-400 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all cursor-pointer"
            >
              <LogOut size={12} /> Sign Out
            </button>
          </div>

        </div>
      )}

      {/* Premium custom alert/confirm glassmorphic modal */}
      {alertConfig.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 relative flex flex-col gap-6 animate-in zoom-in-95 duration-300">
            <div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                alertConfig.type === 'error' 
                  ? 'bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400'
                  : alertConfig.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 text-amber-600 dark:text-amber-400'
                    : 'bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400'
              }`}>
                {alertConfig.type === 'error' ? 'System Alert' : alertConfig.type === 'warning' ? 'User Confirmation' : 'Notification'}
              </span>
              <h3 className="text-xl font-black text-slate-850 dark:text-white uppercase tracking-tight mt-2 leading-none">
                {alertConfig.title}
              </h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                {alertConfig.message}
              </p>
            </div>

            <div className="flex gap-3">
              {alertConfig.isConfirm ? (
                <>
                  <button
                    onClick={() => {
                      setAlertConfig(prev => ({ ...prev, isOpen: false }))
                      if (alertConfig.onCancel) alertConfig.onCancel()
                    }}
                    className="flex-1 py-3.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setAlertConfig(prev => ({ ...prev, isOpen: false }))
                      if (alertConfig.onConfirm) alertConfig.onConfirm()
                    }}
                    className={`flex-1 py-3.5 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer ${
                      alertConfig.type === 'error'
                        ? 'bg-rose-600 hover:bg-rose-500'
                        : 'bg-indigo-600 hover:bg-indigo-500'
                    }`}
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setAlertConfig(prev => ({ ...prev, isOpen: false }))
                    if (alertConfig.onConfirm) alertConfig.onConfirm()
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-950/10 active:scale-95 transition-all cursor-pointer"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
