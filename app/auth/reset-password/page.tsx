'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, ArrowLeft, KeyRound } from 'lucide-react'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setMessage("Invalid or expired reset link. Please request a new one.")
      }
    })
  }, [])

  const handleReset = async () => {
    if (password !== confirmPassword) {
      setMessage("Passwords do not match!")
      return
    }
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters")
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      setMessage("Error: " + error.message)
    } else {
      setMessage("✅ Password updated successfully! Redirecting to login...")
      setTimeout(() => router.push('/auth/login'), 2000)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#05070e] via-[#0b0e1e] to-[#040508] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      
      {/* Background glow blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Back button */}
      <button 
        onClick={() => router.push('/auth/login')}
        className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2.5 bg-slate-950/40 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-slate-200 rounded-2xl shadow-lg transition-all duration-300 backdrop-blur-md cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span className="text-[9px] font-black uppercase tracking-widest">Back</span>
      </button>

      {/* Auth card */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleReset(); }}
        className="bg-slate-950/40 border border-slate-900 backdrop-blur-2xl p-10 md:p-12 rounded-[3rem] shadow-[0_30px_70px_rgba(0,0,0,0.5)] shadow-indigo-950/10 w-full max-w-md relative z-10 hover:border-slate-800/80 transition-all duration-500 animate-in zoom-in-95 duration-300"
      >
        
        <h1 className="text-3xl font-black text-center uppercase tracking-tighter text-slate-100 mb-1">
          Reset Pass
        </h1>
        <p className="text-center text-[9px] font-black text-indigo-400 uppercase tracking-[0.25em] mb-10">
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
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-6 py-4.5 bg-slate-900/30 group-hover:bg-slate-900/50 border border-slate-900 group-focus-within:border-indigo-500/50 rounded-2xl text-slate-200 text-sm font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/5 transition-all duration-300"
            />
          </div>

          {/* Confirm Password field */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
              <Lock size={16} />
            </div>
            <input
              type="password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-12 pr-6 py-4.5 bg-slate-900/30 group-hover:bg-slate-900/50 border border-slate-900 group-focus-within:border-indigo-500/50 rounded-2xl text-slate-200 text-sm font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/5 transition-all duration-300"
            />
          </div>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full relative group overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 text-white disabled:text-slate-500 py-4.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.25em] active:scale-98 transition-all duration-300 mt-8 shadow-xl shadow-emerald-950/10 hover:shadow-emerald-500/15 flex items-center justify-center gap-2 cursor-pointer"
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
              ? 'text-emerald-400 bg-emerald-950/30 border-emerald-900/50' 
              : 'text-red-400 bg-red-950/30 border-red-900/50'
          }`}>
            {message}
          </p>
        )}
      </form>
    </div>
  )
}