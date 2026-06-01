'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, nukeSession } from '@/lib/supabase'
import { Loader2, Database, ArrowRight, LogOut, RefreshCw, Share, PlusSquare, Smartphone, X } from 'lucide-react'
import ThemeToggle from '@/app/components/ThemeToggle'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null)
  const [showIosInstructions, setShowIosInstructions] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      // Safety timeout of 1.5 seconds to prevent launch hangs in slow/webview environments
      const timer = setTimeout(() => {
        setChecking(false)
      }, 1500)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) { 
          clearTimeout(timer)
          setProfile(null)
          setChecking(false)
          return
        }

        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        setProfile(prof)
      } catch { 
        setProfile(null) 
      } finally {
        clearTimeout(timer)
        setChecking(false)
      }
    }
    checkUser()
  }, [])

  const handleGoToPortal = () => {
    if (!profile) return
    if (profile.role === 'admin') router.push('/admin/students')
    else if (profile.role === 'teacher') router.push('/dashboard/lecturer')
    else router.push('/dashboard/student')
  }

  const handleSignOut = async () => {
    setChecking(true)
    try {
      await supabase.auth.signOut()
      nukeSession() // Completely nuke leftover cookies/tokens
      setProfile(null)
    } catch (e) {
      console.error("Sign out error:", e)
    } finally {
      setChecking(false)
    }
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-[#05070f]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin text-indigo-500" size={36} />
        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">Syncing Network Connection...</p>
      </div>
    </div>
  )

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

      {/* Dynamic Background Glow Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Glassmorphic Portal Gateway Container */}
      <div className="bg-bg-card border border-border-card p-10 md:p-12 rounded-[3.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.1)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.45)] w-full max-w-[380px] text-center relative z-10 hover:border-slate-300 dark:hover:border-slate-800/80 transition-all duration-500 animate-in zoom-in-95 duration-300">
        
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-none mb-1">
          Limkokwing
        </h1>
        <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.25em] mb-1">
          Student Portal
        </p>
        <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-1.5">
          by Ratha Nit
        </p>
        <div className="w-10 h-[2px] bg-indigo-500/30 mx-auto mt-3 mb-8 rounded-full" />

        {profile ? (
          /* Stored active session details and action buttons */
          <div className="space-y-4">
            <div className="bg-slate-100/50 dark:bg-indigo-500/5 border border-slate-200/50 dark:border-indigo-500/10 p-4 rounded-2xl text-left">
              <p className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none mb-2">Active Session</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-[10px] font-black uppercase shrink-0">
                  {profile.full_name?.charAt(0) || 'U'}
                </div>
                <div className="overflow-hidden">
                  <p className="text-slate-800 dark:text-slate-200 text-[11px] font-black uppercase tracking-tight truncate leading-tight">{profile.full_name}</p>
                  <p className="text-indigo-600 dark:text-indigo-400 text-[9px] font-bold uppercase tracking-widest mt-0.5 leading-none">
                    {profile.role === 'teacher' ? 'lecturer' : profile.role}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <button 
                onClick={handleGoToPortal}
                className="w-full relative group overflow-hidden bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white py-4.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-950/20 hover:shadow-indigo-500/20 active:scale-98 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Enter Portal</span>
                <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button 
                onClick={handleSignOut}
                className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-500 hover:text-red-400 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-98 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut size={12} />
                <span>Switch Account</span>
              </button>
            </div>
          </div>
        ) : (
          /* Fresh login or registration options */
          <div className="space-y-3">
            <button 
              onClick={() => router.push('/auth/login')}
              className="w-full relative group overflow-hidden bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white py-4.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-950/20 hover:shadow-indigo-500/20 active:scale-98 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Enter Portal</span>
              <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
            </button>
            
            <button 
              onClick={() => router.push('/auth/register')}
              className="w-full bg-slate-100/50 hover:bg-slate-200/50 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.04] dark:hover:border-white/[0.08] text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-98 transition-all duration-300 cursor-pointer"
            >
              Create Account
            </button>
          </div>
        )}

        <p className="mt-10 text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Secured Campus Network System
        </p>

        <button
          onClick={() => setShowIosInstructions(true)}
          className="mt-6 text-[9px] font-black text-indigo-400/80 hover:text-indigo-300 uppercase tracking-widest cursor-pointer underline decoration-indigo-500/20 hover:decoration-indigo-500 transition duration-300 block mx-auto"
        >
          Want it as an app on iOS?
        </button>
      </div>

      {showIosInstructions && (
        <div 
          className="fixed inset-0 bg-[#020308]/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200" 
          onClick={() => setShowIosInstructions(false)}
        >
          <div 
            className="bg-slate-950/90 border border-slate-900/60 backdrop-blur-2xl p-8 rounded-[2.5rem] w-full max-w-sm relative text-center shadow-2xl shadow-indigo-950/20 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowIosInstructions(false)}
              className="absolute top-5 right-5 text-slate-500 hover:text-slate-200 p-2 rounded-xl transition duration-200 cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/5">
              <Smartphone size={22} />
            </div>

            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider mb-1">Install on iOS (iPhone)</h3>
            <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-6">Run as a Standalone App</p>

            <div className="space-y-4 text-left mb-6">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 font-black text-[10px] flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-200 uppercase tracking-wide">Open in Safari Browser</p>
                  <p className="text-[9px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider mt-0.5 leading-normal">Ensure you are visiting this portal in Apple&apos;s native Safari browser.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 font-black text-[10px] flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                    Tap the Share Button <Share size={12} className="text-indigo-400 shrink-0" />
                  </p>
                  <p className="text-[9px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider mt-0.5 leading-normal">Tap the Share icon at the bottom of the screen (or top on iPad).</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 font-black text-[10px] flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                    Select Add to Home Screen <PlusSquare size={12} className="text-indigo-400 shrink-0" />
                  </p>
                  <p className="text-[9px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider mt-0.5 leading-normal">Scroll down the share list and select &quot;Add to Home Screen&quot;.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 font-black text-[10px] flex items-center justify-center shrink-0">
                  4
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-200 uppercase tracking-wide">Tap &quot;Add&quot; in the Corner</p>
                  <p className="text-[9px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider mt-0.5 leading-normal">Confirm the app name and tap Add in the top-right corner to install.</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowIosInstructions(false)}
              className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition shadow-md cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  )
}