'use client'
import { useState, useEffect } from 'react'
import { supabase, nukeSession } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, Lock, LogIn, ArrowLeft, RefreshCw, Trash2 } from 'lucide-react'
import ThemeToggle from '@/app/components/ThemeToggle'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [savedAccounts, setSavedAccounts] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    // 1. Switch Account Intercept Route Check
    const switchEmail = sessionStorage.getItem('switch_account_email')
    const switchPasswordEncoded = sessionStorage.getItem('switch_account_password')

    if (switchEmail && switchPasswordEncoded) {
      setLoading(true)
      sessionStorage.removeItem('switch_account_email')
      sessionStorage.removeItem('switch_account_password')

      const performSwitch = async () => {
        try {
          nukeSession()

          let decPassword = ''
          try {
            decPassword = decodeURIComponent(escape(atob(switchPasswordEncoded)))
          } catch (e) {
            try {
              decPassword = atob(switchPasswordEncoded)
            } catch (err) {
              decPassword = switchPasswordEncoded
            }
          }

          const { data, error } = await supabase.auth.signInWithPassword({
            email: switchEmail,
            password: decPassword
          })

          if (error || !data.user) {
            throw error || new Error('Switch authentication failed.')
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', data.user.id)
            .single()

          const role = profile?.role || 'student'
          
          // Update name/role in localStorage
          const saved = JSON.parse(localStorage.getItem('portal_saved_accounts') || '[]')
          const idx = saved.findIndex((a: any) => a.email.toLowerCase() === switchEmail.toLowerCase())
          if (idx > -1) {
            saved[idx].role = role
            saved[idx].name = profile?.full_name || saved[idx].name
            delete saved[idx].access_token
            delete saved[idx].refresh_token
            localStorage.setItem('portal_saved_accounts', JSON.stringify(saved))
          }

          const targetUrl = role === 'admin'
            ? '/admin/students'
            : role === 'teacher'
              ? '/dashboard/lecturer'
              : '/dashboard/student'

          window.location.replace(targetUrl)
        } catch (err: any) {
          console.error("Auto-switch error:", err)
          setMessage('❌ Auto-switch failed: Please log in manually.')
          setLoading(false)
        }
      }
      performSwitch()
      return
    }

    nukeSession() // Nuke any stale session cookies/tokens immediately upon visiting the login screen!
    
    // Force clear any browser autofill after a small delay to keep fields pristine
    const clearTimer = setTimeout(() => {
      setEmail('')
      setPassword('')
    }, 150)

    try {
      let saved = JSON.parse(localStorage.getItem('portal_saved_accounts') || '[]')
      if (!Array.isArray(saved)) {
        saved = []
      }

      // Sanitize every entry: strip legacy tokens and heal corrupt passwords
      saved = saved.map((acc: any) => {
        if (acc && typeof acc === 'object') {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { access_token, refresh_token, ...rest } = acc as any
          let decPassword = ''
          if (rest.password) {
            try { 
              decPassword = decodeURIComponent(escape(atob(rest.password)))
            } catch (e) { 
              try { decPassword = atob(rest.password) } catch (err) { decPassword = rest.password }
            }
          }
          if (decPassword === 'undefined' || decPassword === 'null' || !decPassword) {
            const { password: _pw, ...noPass } = rest
            return noPass
          }
          return rest
        }
        return acc
      }).filter((acc: any) => acc && typeof acc === 'object' && typeof acc.email === 'string' && acc.email.trim() !== '')

      setSavedAccounts(saved)
      localStorage.setItem('portal_saved_accounts', JSON.stringify(saved))
    } catch (e) {
      console.error(e)
    }

    // Check URL parameters for account deletion warning safely on client
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('reason') === 'deleted') {
        setMessage('⚠️ Your lecturer account has been deleted by an administrator.')
        // Clean URL to prevent warning persisting on manual refresh
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    } catch (err) {
      console.error('Error reading URL parameters:', err)
    }
    return () => clearTimeout(clearTimer)
  }, [])

  const handleLogin = async () => {
    setLoading(true)
    setMessage('')
    
    nukeSession() // Completely nuke leftover cookies/tokens BEFORE signing in as a different user!
    const cleanEmail = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
    
    if (error) {
      setMessage('❌ ' + error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', data.user.id)
        .single()

      // Save account details securely for switching (obfuscating password to protect it from plain text display)
      try {
        const saved = JSON.parse(localStorage.getItem('portal_saved_accounts') || '[]')
        const index = saved.findIndex((a: any) => a.email.toLowerCase() === cleanEmail.toLowerCase())
        const newAcc: any = {
          email: cleanEmail,
          role: profile?.role || 'student',
          name: profile?.full_name || cleanEmail
        }
        if (password) {
          try {
            newAcc.password = btoa(unescape(encodeURIComponent(password)))
          } catch (e) {
            newAcc.password = btoa(password)
          }
        }
        if (index > -1) {
          saved[index] = newAcc
        } else {
          saved.push(newAcc)
        }
        localStorage.setItem('portal_saved_accounts', JSON.stringify(saved))
      } catch (e) {
        console.error('Error saving account to switcher:', e)
      }

      const targetUrl = profile?.role === 'admin'
        ? '/admin/students'
        : profile?.role === 'teacher'
          ? '/dashboard/lecturer'
          : '/dashboard/student'
      
      setEmail('')
      setPassword('')
      setTimeout(() => {
        window.location.replace(targetUrl)
      }, 500)
    }
  }

  const handleQuickLogin = async (acc: any) => {
    setLoading(true)
    setMessage('')
    
    try {
      // Password-only — token fallback removed (it causes cross-account session contamination)
      if (!acc.password) {
        throw new Error('No saved password for this account. Please log in manually.')
      }

      let decPassword = ''
      try {
        decPassword = decodeURIComponent(escape(atob(acc.password)))
      } catch (e) {
        try {
          decPassword = atob(acc.password)
        } catch (err) {
          decPassword = acc.password
        }
      }

      if (!decPassword || decPassword === 'undefined' || decPassword === 'null') {
        throw new Error('Saved password is invalid. Please type your password below to log in.')
      }

      nukeSession() // Completely nuke leftover cookies/tokens BEFORE signing in as a different user!
      const { data, error } = await supabase.auth.signInWithPassword({
        email: acc.email,
        password: decPassword
      })

      if (error || !data.user || !data.session) {
        throw error || new Error('Authentication failed. Please enter your password below.')
      }

      // Successful login — verify the resolved user matches
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', user.id)
          .single()

        // Keep metadata updated — never store tokens
        const saved = JSON.parse(localStorage.getItem('portal_saved_accounts') || '[]')
        const idx = saved.findIndex((a: any) => a.email.toLowerCase() === acc.email.toLowerCase())
        if (idx > -1) {
          saved[idx].name = profile?.full_name || acc.email
          saved[idx].role = profile?.role || acc.role
          delete saved[idx].access_token
          delete saved[idx].refresh_token
          localStorage.setItem('portal_saved_accounts', JSON.stringify(saved))
        }

        const targetUrl = profile?.role === 'admin'
          ? '/admin/students'
          : profile?.role === 'teacher'
            ? '/dashboard/lecturer'
            : '/dashboard/student'
        
        setEmail('')
        setPassword('')
        setTimeout(() => {
          window.location.replace(targetUrl)
        }, 500)
      }
    } catch (err: any) {
      setMessage('❌ Quick login failed: ' + (err.message || 'Please log in manually.'))
      setLoading(false)
    }
  }

  const handleRemoveAccount = (emailToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = savedAccounts.filter(a => a?.email && emailToRemove && a.email.toLowerCase() !== emailToRemove.toLowerCase())
    setSavedAccounts(updated)
    localStorage.setItem('portal_saved_accounts', JSON.stringify(updated))
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#f3f4f6] via-[#e5e7eb] to-[#f5f3ff] dark:from-[#05070e] dark:via-[#0b0e1e] dark:to-[#040508] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      
      {/* Theme and Refresh Controls */}
      <div className="absolute top-6 right-6 flex items-center gap-2 z-50">
        <ThemeToggle />
        <button 
          onClick={() => window.location.reload()}
          className="p-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl shadow-md hover:shadow-indigo-500/5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center backdrop-blur-md"
          title="Refresh Page"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* Background glow blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Back button */}
      <button 
        onClick={() => router.push('/')}
        className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2.5 bg-white/40 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-900 hover:border-slate-300 dark:hover:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-2xl shadow-lg transition-all duration-300 backdrop-blur-md cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span className="text-[9px] font-black uppercase tracking-widest">Back</span>
      </button>

      {/* Auth card */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
        className="bg-bg-card border border-border-card p-10 md:p-12 rounded-[3rem] shadow-[0_30px_70px_rgba(0,0,0,0.1)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.5)] dark:shadow-indigo-950/10 w-full max-w-md relative z-10 hover:border-slate-350 dark:hover:border-slate-800 transition-all duration-500 animate-in zoom-in-95 duration-300"
      >
        {/* Dummy hidden inputs to absorb browser autofill and keep visible fields clean */}
        <input type="text" name="prevent_autofill_username" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
        <input type="password" name="prevent_autofill_password" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
        
        <h1 className="text-3xl font-black text-center uppercase tracking-tighter text-slate-800 dark:text-slate-100 mb-1">
          Login
        </h1>
        <p className="text-center text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.25em] mb-10">
          Access Authorized Gateway
        </p>

        <div className="space-y-4">
          {/* Email input field */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
              <Mail size={16} />
            </div>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              className="w-full pl-12 pr-6 py-4.5 bg-slate-100/50 dark:bg-slate-900/30 group-hover:bg-slate-150/50 dark:group-hover:bg-slate-900/50 border border-slate-200/50 dark:border-slate-900 group-focus-within:border-indigo-500/50 rounded-2xl text-slate-800 dark:text-slate-200 text-sm font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/5 transition-all duration-300"
            />
          </div>
          
          {/* Password input field */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
              <Lock size={16} />
            </div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full pl-12 pr-6 py-4.5 bg-slate-100/50 dark:bg-slate-900/30 group-hover:bg-slate-150/50 dark:group-hover:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 group-focus-within:border-indigo-500/50 rounded-2xl text-slate-800 dark:text-slate-200 text-sm font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/5 transition-all duration-300"
            />
          </div>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full relative group overflow-hidden bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:from-slate-800 disabled:to-slate-800 text-white disabled:text-slate-500 py-4.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.25em] active:scale-98 transition-all duration-300 mt-8 shadow-xl shadow-indigo-950/20 hover:shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <>
              <span>Sign In</span>
              <LogIn size={13} />
            </>
          )}
        </button>

        {message && (
          <p className="mt-6 text-center text-xs font-black text-red-400 bg-red-950/30 border border-red-900/50 py-3 px-4 rounded-xl animate-in fade-in duration-300 leading-tight uppercase tracking-wide">
            {message}
          </p>
        )}

        <div className="mt-10 flex flex-col items-center gap-2">
          <p className="text-[10px] font-bold text-slate-550 dark:text-slate-500 uppercase tracking-widest">
            New here? <a href="/auth/register" className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-400 hover:underline transition-colors ml-1 font-black">Create Account</a>
          </p>
          <a href="/auth/reset-password" className="text-[9px] font-black text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 uppercase tracking-widest transition-colors mt-2">
            Forgot Password?
          </a>
          {savedAccounts.length > 0 && (
          <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-900/60 w-full">
            <p className="text-center text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-4">
              Saved Accounts
            </p>
            <div className="grid gap-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
              {savedAccounts.map((acc, index) => (
                <div
                  key={index}
                  className="w-full flex items-center justify-between p-3 bg-slate-100/50 dark:bg-slate-900/20 border border-slate-200/60 dark:border-slate-900 hover:border-indigo-500/20 text-left rounded-2xl transition-all duration-300 group"
                >
                  <div
                    onClick={() => handleQuickLogin(acc)}
                    className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                  >
                    <div className="w-8 h-8 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-650 dark:text-slate-400 text-[10px] font-black uppercase rounded-xl flex items-center justify-center group-hover:border-indigo-500/10 transition-colors">
                      {acc.name ? acc.name.substring(0, 2).toUpperCase() : acc.email.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase truncate leading-none group-hover:text-indigo-500 transition-colors">
                        {acc.name}
                      </p>
                      <p className="text-[8px] font-bold text-slate-500 dark:text-slate-500 truncate mt-1.5 leading-none">
                        {acc.email} • {acc.role === 'admin' ? 'Admin' : acc.role === 'teacher' ? 'Lecturer' : 'Student'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div 
                      onClick={() => handleQuickLogin(acc)}
                      className="hidden md:inline text-[7.5px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity pr-1 cursor-pointer"
                    >
                      Switch →
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveAccount(acc.email, e)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 rounded-xl transition-all cursor-pointer"
                      title="Remove Account"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </form>
    </div>
  )
}