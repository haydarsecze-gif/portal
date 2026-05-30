'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, ShieldAlert, LogOut } from 'lucide-react'

export default function LecturerDashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isApproved, setIsApproved] = useState<boolean | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const verifiedUserIdRef = useRef<string | null>(null)
  const isCheckingRef = useRef(false)

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      verifiedUserIdRef.current = null
      await supabase.auth.signOut()
      router.push('/auth/login')
    } catch (e) {
      console.error('Error signing out:', e)
      setIsSigningOut(false)
    }
  }

  const verifyLecturerSession = async (active = true) => {
    if (isCheckingRef.current) return verifiedUserIdRef.current
    isCheckingRef.current = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        verifiedUserIdRef.current = null
        if (active) {
          setIsApproved(null)
          setLoading(false)
          window.location.href = '/auth/login'
        }
        return null
      }

      const currentUserId = session.user.id

      // If we already verified this user, skip database fetch to prevent loop
      if (verifiedUserIdRef.current === currentUserId && isApproved !== null) {
        if (active) {
          setLoading(false)
        }
        return currentUserId
      }

      // Verify profile exists and check role & approval status
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('id, role, is_approved')
        .eq('id', currentUserId)
        .single()

      if (profErr || !profile) {
        console.warn('Access Denied or Profile Missing for Lecturer dashboard verification.', profErr)
        verifiedUserIdRef.current = null
        await supabase.auth.signOut()
        if (active) {
          setIsApproved(null)
          setLoading(false)
          window.location.href = '/auth/login?reason=deleted'
        }
        return null
      }

      // Redirect non-teacher roles to their correct panels immediately
      if (profile.role === 'admin') {
        verifiedUserIdRef.current = currentUserId
        if (active) {
          setIsApproved(null)
          setLoading(false)
          window.location.href = '/admin/students'
        }
        return currentUserId
      }
      if (profile.role === 'student') {
        verifiedUserIdRef.current = currentUserId
        if (active) {
          setIsApproved(null)
          setLoading(false)
          window.location.href = '/dashboard/student'
        }
        return currentUserId
      }

      if (active) {
        verifiedUserIdRef.current = currentUserId
        setIsApproved(!!profile.is_approved)
        setLoading(false)
      }
      return currentUserId
    } catch (err) {
      console.error('Lecturer layout auth check error:', err)
      if (active) {
        setLoading(false)
      }
      return null
    } finally {
      isCheckingRef.current = false
    }
  }

  useEffect(() => {
    let active = true
    let channel: any = null

    const initAuth = async () => {
      const userId = await verifyLecturerSession(active)
      if (!userId || !active) return

      // Subscribe to real-time updates and deletions of this lecturer's profile
      channel = supabase
        .channel(`lecturer_profile_${userId}`)
        .on('postgres_changes', {
          event: '*', // Listen to INSERT, UPDATE, and DELETE
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        }, async (payload) => {
          if (payload.eventType === 'DELETE') {
            console.log('Lecturer profile deleted in real-time!', payload)
            verifiedUserIdRef.current = null
            await supabase.auth.signOut()
            router.push('/auth/login?reason=deleted')
          } else if (payload.eventType === 'UPDATE') {
            const updatedProfile = payload.new
            console.log('Lecturer profile updated in real-time!', updatedProfile)
            if (updatedProfile && active) {
              // If role changed or no longer a teacher, redirect them out
              if (updatedProfile.role !== 'teacher') {
                verifiedUserIdRef.current = null
                if (updatedProfile.role === 'admin') router.push('/admin/students')
                else if (updatedProfile.role === 'student') router.push('/dashboard/student')
                else router.push('/auth/login')
                return
              }
              setIsApproved(!!updatedProfile.is_approved)
            }
          }
        })
        .subscribe((status: string, err: any) => {
          if (status === 'CHANNEL_ERROR' || err) {
            console.warn('Real-time Channel Status:', status, err)
          }
        })
    }

    initAuth()

    // Listen for auth state changes to dynamically catch switcher updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        const sessionUserId = session?.user?.id || null
        if (sessionUserId !== verifiedUserIdRef.current) {
          if (channel) {
            supabase.removeChannel(channel)
            channel = null
          }
          setLoading(true)
          const userId = await verifyLecturerSession(active)
          if (userId && active) {
            channel = supabase
              .channel(`lecturer_profile_${userId}`)
              .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${userId}`
              }, async (payload) => {
                if (payload.eventType === 'DELETE') {
                  verifiedUserIdRef.current = null
                  await supabase.auth.signOut()
                  router.push('/auth/login?reason=deleted')
                } else if (payload.eventType === 'UPDATE') {
                  const updatedProfile = payload.new
                  if (updatedProfile && active) {
                    if (updatedProfile.role !== 'teacher') {
                      verifiedUserIdRef.current = null
                      if (updatedProfile.role === 'admin') router.push('/admin/students')
                      else if (updatedProfile.role === 'student') router.push('/dashboard/student')
                      else router.push('/auth/login')
                      return
                    }
                    setIsApproved(!!updatedProfile.is_approved)
                  }
                }
              })
              .subscribe()
          }
        }
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [router])

  // 1. Loading State Screen
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
        <p className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Verifying Authorization...</p>
      </div>
    )
  }

  // 2. Approval Pending Screen (Premium Glassmorphic UI)
  if (isApproved === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 relative overflow-hidden font-sans">
        {/* Sleek Modern Abstract Glowing Orbs in Background */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-[100px] pointer-events-none animate-pulse duration-4000"></div>

        <div className="w-full max-w-md bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl relative z-10 text-center flex flex-col items-center">
          {/* Glassmorphic Icon Shield Container */}
          <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mb-6 text-amber-500 shadow-lg shadow-amber-500/5 animate-bounce">
            <ShieldAlert size={40} strokeWidth={2} />
          </div>

          <h2 className="text-2xl font-black tracking-tight text-white mb-2 uppercase">
            Approval Pending
          </h2>
          
          <div className="h-[2px] w-12 bg-gradient-to-r from-amber-500 to-indigo-500 rounded-full mb-6"></div>

          <p className="text-slate-300 text-sm leading-relaxed mb-8">
            Your lecturer account registration was received successfully! However, access is currently locked pending manual administrator approval.
          </p>

          <div className="bg-slate-950/50 border border-slate-900/50 px-4 py-3 rounded-2xl text-[11px] text-slate-400 font-medium tracking-wide uppercase mb-8 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            Checking approval status in real-time...
          </div>

          {/* Action Sign Out Button with Glassmorphism */}
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full py-4 bg-white/10 dark:bg-slate-900/40 border border-slate-700/50 dark:border-slate-800/80 hover:bg-white/15 dark:hover:bg-slate-800/50 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningOut ? (
              <Loader2 className="animate-spin text-white" size={16} />
            ) : (
              <>
                <LogOut size={16} strokeWidth={2.5} />
                Sign Out / Switch Account
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  // 3. Approved Dashboard State
  return <>{children}</>
}
