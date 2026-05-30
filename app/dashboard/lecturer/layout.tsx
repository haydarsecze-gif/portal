'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

export default function LecturerDashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    let channel: any = null

    const checkAuthAndSubscribe = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          if (active) {
            router.push('/auth/login')
          }
          return
        }

        const currentUserId = session.user.id

        // Verify profile exists
        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', currentUserId)
          .single()

        if (profErr || !profile) {
          await supabase.auth.signOut()
          if (active) {
            router.push('/auth/login?reason=deleted')
          }
          return
        }

        if (active) {
          setLoading(false)
        }

        // Subscribe to real-time deletion of this lecturer's profile
        channel = supabase
          .channel(`lecturer_profile_${currentUserId}`)
          .on('postgres_changes', {
            event: 'DELETE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${currentUserId}`
          }, async (payload) => {
            console.log('Lecturer profile deleted in real-time!', payload)
            await supabase.auth.signOut()
            router.push('/auth/login?reason=deleted')
          })
          .subscribe((status: string, err: any) => {
            if (status === 'CHANNEL_ERROR' || err) {
              console.warn('Real-time Channel Status:', status, err)
            }
          })

      } catch (err) {
        console.error('Lecturer layout auth check error:', err)
        if (active) {
          setLoading(false)
        }
      }
    }

    checkAuthAndSubscribe()

    // Fallback 1: periodic verification every 15 seconds to ensure absolute robustness
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .single()
        if (!profile) {
          await supabase.auth.signOut()
          router.push('/auth/login?reason=deleted')
        }
      }
    }, 15000)

    // Fallback 2: check on window focus
    const handleFocus = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .single()
        if (!profile) {
          await supabase.auth.signOut()
          router.push('/auth/login?reason=deleted')
        }
      }
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      active = false
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [router])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
        <p className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Verifying Authorization...</p>
      </div>
    )
  }

  return <>{children}</>
}
