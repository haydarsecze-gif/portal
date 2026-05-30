'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, ArrowLeft, KeyRound, Mail, RefreshCw } from 'lucide-react'
import ThemeToggle from '@/app/components/ThemeToggle'

export default function ResetPassword() {
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    // 1. Verify if we came from a recovery link (via URL search query or hash fragment)
    const hasParams = typeof window !== 'undefined' && (
      window.location.search.includes('code=') ||
      window.location.hash.includes('type=recovery') ||
      window.location.hash.includes('access_token=')
    )

    if (hasParams) {
      setIsRecoveryFlow(true)
    }

    // 2. Listen specifically to the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryFlow(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setMessage("❌ Please enter your email address!")
      return
    }

    setLoading(true)
    setMessage('')

    try {
      // 1. Pre-validate if the email exists in the system
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })

      if (!checkRes.ok) {
        throw new Error('Failed to verify email address')
      }

      const { exists, error: checkError } = await checkRes.json()
      if (checkError) {
        throw new Error(checkError)
      }

      if (!exists) {
        setMessage("❌ This email address does not exist in our system!")
        setLoading(false)
        return
      }

      // 2. If it exists, trigger recovery link
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/reset-password`
      })

      if (error) {
        throw error
      }
      setMessage("✅ Password reset link successfully sent to your email!")
    } catch (err: any) {
      setMessage("❌ Error: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setMessage("❌ Passwords do not match!")
      return
    }
    if (password.length < 6) {
      setMessage("❌ Password must be at least 6 characters")
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      setMessage("✅ Password updated successfully! Redirecting to login...")
      setTimeout(() => router.push('/auth/login'), 2000)
    } catch (err: any) {
      setMessage("❌ Error: " + err.message)
    } finally {
      setLoading(false)
    }
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
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Back button */}
      <button 
        onClick={() => router.push('/auth/login')}
        className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2.5 bg-white/40 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-900 hover:border-slate-300 dark:hover:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-2xl shadow-lg transition-all duration-300 backdrop-blur-md cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span className="text-[9px] font-black uppercase tracking-widest">Back</span>
      </button>

      {/* Auth card */}
      {isRecoveryFlow ? (
        /* STAGE 2: Password Update Form */
        <form 
          onSubmit={handleReset}
          className="bg-bg-card border border-border-card p-10 md:p-12 rounded-[3rem] shadow-[0_30px_70px_rgba(0,0,0,0.1)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.5)] dark:shadow-indigo-950/10 w-full max-w-md relative z-10 hover:border-slate-350 dark:hover:border-slate-800 transition-all duration-500 animate-in zoom-in-95 duration-300"
        >
          <h1 className="text-3xl font-black text-center uppercase tracking-tighter text-slate-800 dark:text-slate-100 mb-1">
            Reset Pass
          </h1>
          <p className="text-center text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.25em] mb-10">
            Establish New Credentials
          </p>
   
          <div className="space-y-4">
            {/* Password field */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                <Lock size={16} />
              </div>
              <input
                type="password"
                required
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-6 py-4.5 bg-slate-100/50 dark:bg-slate-900/30 group-hover:bg-slate-150/50 dark:group-hover:bg-slate-900/50 border border-slate-200/50 dark:border-slate-900 group-focus-within:border-indigo-500/50 rounded-2xl text-slate-800 dark:text-slate-200 text-sm font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/5 transition-all duration-300"
              />
            </div>
   
            {/* Confirm Password field */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                <Lock size={16} />
              </div>
              <input
                type="password"
                required
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-12 pr-6 py-4.5 bg-slate-100/50 dark:bg-slate-900/30 group-hover:bg-slate-150/50 dark:group-hover:bg-slate-900/50 border border-slate-200/50 dark:border-slate-900 group-focus-within:border-indigo-500/50 rounded-2xl text-slate-800 dark:text-slate-200 text-sm font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/5 transition-all duration-300"
              />
            </div>
          </div>
   
          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full relative group overflow-hidden bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:from-slate-200 dark:disabled:from-slate-800 disabled:to-slate-200 dark:disabled:to-slate-800 text-white disabled:text-slate-400 dark:disabled:text-slate-500 py-4.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.25em] active:scale-98 transition-all duration-300 mt-8 shadow-xl shadow-indigo-950/20 hover:shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <>
                <span>Update Password</span>
                <KeyRound size={13} />
              </>
            )}
          </button>
   
          {message && (
            <p className={`mt-6 text-center text-xs font-black py-3 px-4 rounded-xl animate-in fade-in duration-300 leading-tight uppercase tracking-wide border ${
              message.includes('✅') 
                ? 'text-emerald-555 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50' 
                : 'text-red-555 dark:text-red-400 bg-red-50/50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50'
            }`}>
              {message}
            </p>
          )}
        </form>
      ) : (
        /* STAGE 1: Request Recovery Link Form */
        <form 
          onSubmit={handleSendResetLink}
          className="bg-bg-card border border-border-card p-10 md:p-12 rounded-[3rem] shadow-[0_30px_70px_rgba(0,0,0,0.1)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.5)] dark:shadow-indigo-950/10 w-full max-w-md relative z-10 hover:border-slate-350 dark:hover:border-slate-800 transition-all duration-500 animate-in zoom-in-95 duration-300"
        >
          <h1 className="text-3xl font-black text-center uppercase tracking-tighter text-slate-800 dark:text-slate-100 mb-1">
            Recovery
          </h1>
          <p className="text-center text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.25em] mb-10">
            Send Password Reset Link
          </p>
   
          <div className="space-y-4">
            {/* Email input field */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                <Mail size={16} />
              </div>
              <input
                type="email"
                required
                placeholder="Your Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-6 py-4.5 bg-slate-100/50 dark:bg-slate-900/30 group-hover:bg-slate-150/50 dark:group-hover:bg-slate-900/50 border border-slate-200/50 dark:border-slate-900 group-focus-within:border-indigo-500/50 rounded-2xl text-slate-800 dark:text-slate-200 text-sm font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/5 transition-all duration-300"
              />
            </div>
          </div>
   
          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full relative group overflow-hidden bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:from-slate-200 dark:disabled:from-slate-800 disabled:to-slate-200 dark:disabled:to-slate-800 text-white disabled:text-slate-400 dark:disabled:text-slate-500 py-4.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.25em] active:scale-98 transition-all duration-300 mt-8 shadow-xl shadow-indigo-950/20 hover:shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <>
                <span>Send Reset Link</span>
                <Mail size={13} />
              </>
            )}
          </button>
   
          {message && (
            <p className={`mt-6 text-center text-xs font-black py-3 px-4 rounded-xl animate-in fade-in duration-300 leading-tight uppercase tracking-wide border ${
              message.includes('✅') 
                ? 'text-emerald-555 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50' 
                : 'text-red-555 dark:text-red-400 bg-red-50/50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50'
            }`}>
              {message}
            </p>
          )}
        </form>
      )}
    </div>
  )
}