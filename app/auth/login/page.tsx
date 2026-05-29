'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, Lock, LogIn, ArrowLeft, RefreshCw } from 'lucide-react'
import ThemeToggle from '@/app/components/ThemeToggle'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [savedAccounts, setSavedAccounts] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
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
      console.error(e)
    }
  }, [])

  const handleLogin = async () => {
    setLoading(true)
    setMessage('')
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    
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

      // Save session tokens securely for switching (NEVER store password in plain text!)
      if (data.session) {
        try {
          const saved = JSON.parse(localStorage.getItem('portal_saved_accounts') || '[]')
          const index = saved.findIndex((a: any) => a.email.toLowerCase() === email.toLowerCase())
          const newAcc = {
            email: email.toLowerCase(),
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            role: profile?.role || 'student',
            name: profile?.full_name || email
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
      }

      const targetUrl = profile?.role === 'admin'
        ? '/admin/students'
        : profile?.role === 'teacher'
          ? '/dashboard/lecturer'
          : '/dashboard/student'
      
      window.location.href = targetUrl
    }
  }

  const handleQuickLogin = async (acc: any) => {
    setLoading(true)
    setMessage('')
    
    try {
      // Securely log in using the cached session tokens (no password required!)
      const { data, error } = await supabase.auth.setSession({
        access_token: acc.access_token || '',
        refresh_token: acc.refresh_token
      })
      
      if (error) throw error

      if (data.user && data.session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', data.user.id)
          .single()

        // Keep metadata and refresh token updated
        const saved = JSON.parse(localStorage.getItem('portal_saved_accounts') || '[]')
        const idx = saved.findIndex((a: any) => a.email.toLowerCase() === acc.email.toLowerCase())
        if (idx > -1) {
          saved[idx].name = profile?.full_name || acc.email
          saved[idx].role = profile?.role || acc.role
          saved[idx].access_token = data.session.access_token
          saved[idx].refresh_token = data.session.refresh_token
          localStorage.setItem('portal_saved_accounts', JSON.stringify(saved))
        }

        const targetUrl = profile?.role === 'admin'
          ? '/admin/students'
          : profile?.role === 'teacher'
            ? '/dashboard/lecturer'
            : '/dashboard/student'
        
        window.location.href = targetUrl
      }
    } catch (err: any) {
      setMessage('❌ Session expired. Please log in manually.')
      // Clean up the expired account
      const updated = savedAccounts.filter(a => a?.email && acc?.email && a.email.toLowerCase() !== acc.email.toLowerCase())
      setSavedAccounts(updated)
      localStorage.setItem('portal_saved_accounts', JSON.stringify(updated))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#05070e] via-[#0b0e1e] to-[#040508] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      
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
        className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2.5 bg-slate-950/40 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-slate-200 rounded-2xl shadow-lg transition-all duration-300 backdrop-blur-md cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span className="text-[9px] font-black uppercase tracking-widest">Back</span>
      </button>

      {/* Auth card */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
        className="bg-slate-950/40 border border-slate-900 backdrop-blur-2xl p-10 md:p-12 rounded-[3rem] shadow-[0_30px_70px_rgba(0,0,0,0.5)] shadow-indigo-950/10 w-full max-w-md relative z-10 hover:border-slate-800/80 transition-all duration-500 animate-in zoom-in-95 duration-300"
      >
        
        <h1 className="text-3xl font-black text-center uppercase tracking-tighter text-slate-100 mb-1">
          Login
        </h1>
        <p className="text-center text-[9px] font-black text-indigo-400 uppercase tracking-[0.25em] mb-10">
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
              className="w-full pl-12 pr-6 py-4.5 bg-slate-900/30 group-hover:bg-slate-900/50 border border-slate-900 group-focus-within:border-indigo-500/50 rounded-2xl text-slate-200 text-sm font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/5 transition-all duration-300"
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
              className="w-full pl-12 pr-6 py-4.5 bg-slate-900/30 group-hover:bg-slate-900/50 border border-slate-900 group-focus-within:border-indigo-500/50 rounded-2xl text-slate-200 text-sm font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/5 transition-all duration-300"
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
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            New here? <a href="/auth/register" className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors ml-1 font-black">Create Account</a>
          </p>
          <a href="/auth/reset-password" className="text-[9px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors mt-2">
            Forgot Password?
          </a>
        </div>

        {savedAccounts.length > 0 && (
          <div className="mt-8 pt-8 border-t border-slate-900/60">
            <p className="text-center text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-4">
              Saved Accounts
            </p>
            <div className="grid gap-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
              {savedAccounts.map((acc, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleQuickLogin(acc)}
                  className="w-full flex items-center justify-between p-3 bg-slate-900/20 hover:bg-slate-900/50 border border-slate-900 hover:border-indigo-500/20 text-left rounded-2xl cursor-pointer active:scale-98 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-black uppercase rounded-xl flex items-center justify-center group-hover:border-indigo-500/10 transition-colors">
                      {acc.name ? acc.name.substring(0, 2).toUpperCase() : acc.email.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-200 uppercase truncate leading-none">
                        {acc.name}
                      </p>
                      <p className="text-[8px] font-bold text-slate-500 truncate mt-1.5 leading-none">
                        {acc.email} • {acc.role === 'admin' ? 'Admin' : acc.role === 'teacher' ? 'Lecturer' : 'Student'}
                      </p>
                    </div>
                  </div>
                  <div className="text-[7.5px] font-black uppercase tracking-widest text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                    Switch →
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}