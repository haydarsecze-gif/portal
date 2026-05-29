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

      // Purge stale hardcoded demo accounts from previous builds
      saved = saved.filter((acc: any) => {
        if (!acc || typeof acc !== 'object') return false
        const email = (acc.email || '').toLowerCase()
        const password = acc.password || ''
        const isDemo = (
          (email === 'theweirdone719@gmail.com' || email === 'nit.ratha01@gmail.com' || email === 'godchan22@gmail.com') &&
          password === 'password123'
        )
        return !isDemo
      })
      localStorage.setItem('portal_saved_accounts', JSON.stringify(saved))

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
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetAccount.email,
        password: targetAccount.password
      })

      if (error) throw error

      if (data.user) {
        // Refresh page and route accordingly
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

        const role = profile?.role || targetAccount.role

        // Update the account name and metadata if it changed
        const saved = JSON.parse(localStorage.getItem('portal_saved_accounts') || '[]')
        const idx = saved.findIndex((a: any) => a.email.toLowerCase() === targetAccount.email.toLowerCase())
        if (idx > -1) {
          saved[idx].role = role
          localStorage.setItem('portal_saved_accounts', JSON.stringify(saved))
        }

        const targetUrl = role === 'admin'
          ? '/admin/students'
          : role === 'teacher'
            ? '/dashboard/lecturer'
            : '/dashboard/student'
        
        window.location.href = targetUrl
      }
    } catch (err: any) {
      alert('Failed to switch account: ' + err.message)
      router.push('/auth/login')
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
    </div>
  )
}
