'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { BookOpen, Clock, LogOut, Loader2, Sparkles, ArrowRight, RefreshCw } from 'lucide-react'
import ThemeToggle from '@/app/components/ThemeToggle'
import NotificationBell from '@/app/components/NotificationBell'
import AccountSwitcher from '@/app/components/AccountSwitcher'

// Helper function to format time (e.g., 08:00 -> 8:00 AM)
const formatTime = (time: string) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const formattedH = h % 12 || 12;
  return `${formattedH}:${minutes} ${ampm}`;
};

export default function LecturerDashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()

  const fetchData = useCallback(async (showFullLoader = false) => {
    if (showFullLoader) setLoading(true)
    else setIsSyncing(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/auth/login')

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)

      // Querying the single source of truth: 'subjects' table
      const { data: s } = await supabase
        .from('subjects')
        .select('*')
        .contains('lecturer_names', [p.full_name])
      
      setSubjects(s || [])
    } catch (err) {
      console.error("Dashboard Load Error:", err)
    } finally {
      setLoading(false)
      setIsSyncing(false)
    }
  }, [router])

  useEffect(() => { 
    fetchData(true) 
  }, [fetchData])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-indigo-600 mb-2" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Lecturer Dashboard...</p>
    </div>
  )

  return (
    <div className="p-4 sm:p-8 md:p-12 bg-[#F8FAFC] min-h-screen font-sans select-none animate-in fade-in duration-300">
      <div className="w-full max-w-[1600px] mx-auto">
        
        {/* Modern radial gradient heading block */}
        <div className="relative z-30 bg-gradient-to-br from-slate-900 via-[#10142d] to-slate-900 rounded-[2.5rem] p-8 md:p-12 mb-12 shadow-xl shadow-slate-900/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          {/* Absolute Background Wrapper to safely clip the glow blobs without clipping dropdowns */}
          <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[-30%] right-[-10%] w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-[-30%] left-[-10%] w-[250px] h-[250px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
          </div>
          
          <div className="relative z-10 space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest">
              <Sparkles size={10} /> Lecturer Session Active
            </span>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase leading-none mt-2">
              Lecturer Portal
            </h1>
            <p className="text-slate-400 text-sm font-bold">
              Welcome back, <span className="text-indigo-400">{profile?.full_name || 'Lecturer'}</span>
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3 w-full md:w-auto justify-end">
            <AccountSwitcher />
            <NotificationBell />
            <ThemeToggle />
            <button 
              onClick={() => fetchData(false)} 
              disabled={isSyncing}
              className="p-3.5 bg-white/5 border border-white/10 hover:border-white/20 text-slate-300 hover:text-indigo-400 rounded-2xl shadow-lg active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer flex items-center justify-center"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin text-indigo-400" : ""} />
            </button>
            <button 
              onClick={handleLogout} 
              className="flex items-center gap-2 px-5 py-3.5 bg-white/5 border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 text-slate-300 hover:text-red-400 rounded-2xl shadow-lg active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer text-xs font-black uppercase tracking-widest"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>

        {/* Section Title */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Active Lecturing Matrix</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Manage attendance logs & subject materials</p>
          </div>
        </div>

        {/* Subjects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {subjects.map((s) => (
            <div 
              key={s.id} 
              className="group bg-white p-8 rounded-[2.5rem] border border-slate-100/80 shadow-sm hover:shadow-xl hover:shadow-indigo-950/5 hover:-translate-y-1 hover:border-indigo-200 transition-all duration-300 flex flex-col justify-between min-h-[240px]"
            >
              <div>
                <span className="inline-block px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest mb-4">
                  Semester {s.semester} Track
                </span>
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors duration-300">{s.name}</h2>
                
                <div className="flex flex-wrap gap-4 mt-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                    <BookOpen size={12} className="text-indigo-500"/> Room: {s.room}
                  </span>
                  <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                    <Clock size={12} className="text-indigo-500"/> 
                    {s.class_start_time ? formatTime(s.class_start_time) : 'N/A'} 
                    {s.class_end_time ? ` - ${formatTime(s.class_end_time)}` : ''}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => router.push(`/dashboard/lecturer/${s.id}`)}
                className="w-full mt-8 bg-slate-900 group-hover:bg-indigo-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md hover:shadow-lg hover:shadow-indigo-500/10 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>View Classroom</span>
                <ArrowRight size={12} />
              </button>
            </div>
          ))}
          
          {subjects.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
              <BookOpen size={48} className="mx-auto text-slate-200 mb-4 animate-pulse" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No assigned academic matrix courses located.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}