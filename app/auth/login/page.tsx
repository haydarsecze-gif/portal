'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, Lock, LogIn, ArrowLeft } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

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
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profile?.role === 'admin') {
        router.push('/admin/students')
      } else if (profile?.role === 'teacher') {
        router.push('/dashboard/teacher')
      } else {
        router.push('/dashboard/student')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#05070e] via-[#0b0e1e] to-[#040508] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      
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
      </form>
    </div>
  )
}