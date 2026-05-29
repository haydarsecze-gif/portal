'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BookOpen, Clock, User, LogOut, Loader2, ArrowRight, Sparkles, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/app/components/ThemeToggle'
import NotificationBell from '@/app/components/NotificationBell'
import AccountSwitcher from '@/app/components/AccountSwitcher'

export default function StudentDashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [myClasses, setMyClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()

  const loadDashboard = useCallback(async (showFullLoader = false) => {
    if (showFullLoader) setLoading(true)
    else setIsSyncing(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/auth/login')

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(prof)

      if (prof && prof.role === 'student') {
        const { data: existingStudent } = await supabase
          .from('students')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        if (!existingStudent) {
          await supabase.from('students').insert({
            id: user.id,
            name: prof.full_name,
            email: user.email,
            class_id: prof.class_id
          })
        }
      }

      const { data: enrollments, error } = await supabase
        .from('student_classes')
        .select(`
          subject_id,
          subjects (
            id,
            name,
            room,
            lecturer_names
          )
        `)
        .eq('student_id', user.id)

      if (error) throw error

      const classes = (enrollments || [])
        .map((e: any) => e.subjects)
        .filter(Boolean)
        
      setMyClasses(classes)
    } catch (err) {
      console.error("Dashboard Load Error:", err)
    } finally {
      setLoading(false)
      setIsSyncing(false)
    }
  }, [router])

  useEffect(() => {
    loadDashboard(true)
  }, [loadDashboard])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-indigo-600 mb-2" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Student Dashboard...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-8 md:p-12 font-sans select-none animate-in fade-in duration-300">
      <div className="w-full max-w-[1600px] mx-auto">
        
        {/* Modern radial gradient greeting block */}
        <div className="relative z-30 bg-gradient-to-br from-slate-900 via-[#10142d] to-slate-900 rounded-[2.5rem] p-8 md:p-12 mb-12 shadow-xl shadow-slate-900/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          {/* Absolute Background Wrapper to safely clip the glow blobs without clipping dropdowns */}
          <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[-30%] right-[-10%] w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-[-30%] left-[-10%] w-[250px] h-[250px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
          </div>
          
          <div className="relative z-10 space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest">
              <Sparkles size={10} /> Authorized Session Active
            </span>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase leading-none mt-2">
              Student Dashboard
            </h1>
            <p className="text-slate-400 text-sm font-bold">
              Welcome back, <span className="text-indigo-400">{profile?.full_name || 'Student'}</span>
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3 w-full md:w-auto justify-end">
            <AccountSwitcher />
            <NotificationBell />
            <ThemeToggle />
            <button 
              onClick={() => loadDashboard(false)} 
              disabled={isSyncing}
              className="p-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl shadow-md active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer flex items-center justify-center"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin text-indigo-400" : ""} />
            </button>
            <button 
              onClick={handleLogout} 
              className="flex items-center gap-2 px-5 py-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-red-500/30 text-slate-700 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 rounded-2xl shadow-md active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer text-xs font-black uppercase tracking-widest"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>

        {/* Section Title */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Enrolled Classrooms</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Explore active curriculum lists</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {myClasses.length > 0 ? (
            myClasses.map((cls) => (
              <div 
                key={cls.id} 
                onClick={() => router.push(`/dashboard/student/class/${cls.id}`)} 
                className="group bg-white p-8 rounded-[2rem] border border-slate-100/80 shadow-sm hover:shadow-xl hover:shadow-indigo-950/5 hover:-translate-y-1 hover:border-indigo-200 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[220px]"
              >
                <div>
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                    <BookOpen size={20} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-tight group-hover:text-indigo-600 transition-colors duration-300 mb-3">{cls.name}</h3>
                  
                  <div className="flex flex-col gap-1.5 mt-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <Clock size={12} className="text-slate-300" /> Room {cls.room}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <User size={12} className="text-slate-300" /> {cls.lecturer_names?.join(', ') || 'Lecturer Unassigned'}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-slate-50 flex justify-between items-center shrink-0">
                  <span className="text-[9px] text-slate-300 font-mono">TRACK: {cls.id.substring(0, 8).toUpperCase()}</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Enter <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
              <BookOpen size={48} className="mx-auto text-slate-200 mb-4" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No classes assigned yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}