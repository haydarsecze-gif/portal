'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, Database, ArrowRight } from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setChecking(false); return; }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role === 'admin') router.push('/admin/students')
        else if (profile?.role === 'teacher') router.push('/dashboard/teacher')
        else router.push('/dashboard/student')
      } catch (e) { setChecking(false); }
    }
    checkUser()
  }, [router])

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-[#05070f]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin text-indigo-500" size={36} />
        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">Syncing Network Connection...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#05070e] via-[#0b0e1e] to-[#040508] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      
      {/* Dynamic Background Glow Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Glassmorphic Portal Gateway Container */}
      <div className="bg-slate-950/40 border border-slate-900 backdrop-blur-2xl p-10 md:p-12 rounded-[3.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.4)] shadow-indigo-950/10 w-full max-w-[380px] text-center relative z-10 hover:border-slate-800/80 transition-all duration-500 animate-in zoom-in-95 duration-300">
        
        {/* Glow behind logo */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-indigo-600/25 rounded-full blur-xl pointer-events-none" />
        
        {/* Premium database logo */}
        <div className="relative w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/20 group hover:rotate-6 transition-transform duration-300">
          <Database size={26} className="text-slate-100" />
        </div>

        <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight leading-none mb-1">
          Limkokwing
        </h1>
        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.25em] mb-1">
          Student Portal
        </p>
        <div className="w-10 h-[2px] bg-indigo-500/30 mx-auto mt-3 mb-8 rounded-full" />

        <div className="space-y-3">
          <button 
            onClick={() => router.push('/auth/login')}
            className="w-full relative group overflow-hidden bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white py-4.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-950/20 hover:shadow-indigo-500/20 active:scale-98 transition-all duration-300 flex items-center justify-center gap-2"
          >
            <span>Enter Portal</span>
            <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button 
            onClick={() => router.push('/auth/register')}
            className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.08] text-slate-400 hover:text-slate-200 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-98 transition-all duration-300"
          >
            Create Account
          </button>
        </div>

        <p className="mt-10 text-[8px] font-bold text-slate-500 uppercase tracking-widest">
          Secured Campus Network System
        </p>
      </div>
    </div>
  )
}