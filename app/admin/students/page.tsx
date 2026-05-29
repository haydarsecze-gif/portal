'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Loader2, UserMinus, GraduationCap, AlertTriangle, RefreshCcw } from 'lucide-react'

export default function StudentDirectory() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debugInfo, setDebugInfo] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setDebugInfo(null)
    
    try {
      const [overviewRes, profilesRes, classesRes] = await Promise.all([
        supabase.from('admin_student_overview').select('*'),
        supabase.from('profiles').select('id, class_id, created_at').eq('role', 'student'),
        supabase.from('classes').select('id, name, semester')
      ])

      if (overviewRes.error) throw overviewRes.error

      const overview = overviewRes.data || []
      const profiles = profilesRes.data || []
      const classes = classesRes.data || []

      const combined = overview.map(o => {
        const prof = profiles.find(p => p.id === o.student_id)
        const cls = classes.find(c => c.id === prof?.class_id)
        return {
          ...o,
          created_at: prof?.created_at || o.created_at,
          semester: cls ? cls.semester : 'N/A',
          class_name: cls ? cls.name : (o.subject_name || 'Unassigned')
        }
      })

      setStudents(combined)
    } catch (error: any) {
      console.error("Fetch Data Error:", error)
      
      const { data: fallbackData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')

      if (profileError) {
        setDebugInfo(`Database Error: ${profileError.message}. Check if RLS policies allow Admin to read profiles.`)
      } else if (fallbackData?.length === 0) {
        setDebugInfo("Sync Issue: Found 0 users with role 'student'. Ensure the 'role' column values are exactly 'student'.")
      } else {
        const { data: classesData } = await supabase.from('classes').select('id, name, semester')
        const classes = classesData || []
        
        const mappedFallback = (fallbackData || []).map(p => {
          const cls = classes.find(c => c.id === p.class_id)
          return {
            id: p.id,
            student_id: p.id,
            full_name: p.full_name,
            email: 'No Email',
            created_at: p.created_at,
            semester: cls ? cls.semester : 'N/A',
            class_name: cls ? cls.name : 'Unassigned',
            days_present: 0
          }
        })
        setStudents(mappedFallback)
      }
    }
    setLoading(false)
  }

  useEffect(() => { 
    fetchData() 
  }, [])

  const deleteStudent = async (id: string) => {
    if(!confirm("Are you sure? This will delete the student's profile permanently.")) return
    
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) {
      alert("Delete failed: " + error.message)
    } else {
      fetchData()
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const filtered = students.filter(s => 
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-300">
      <Loader2 className="animate-spin mb-2" size={32} />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Student Directory...</p>
    </div>
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-300 font-sans select-none">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Student Directory</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {filtered.length} Total Records Cataloged
          </p>
        </div>
        
        <div className="flex gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
            <input 
              placeholder="Search student profile..." 
              value={search}
              onChange={e => setSearch(e.target.value)} 
              className="w-full pl-11 pr-6 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold outline-none shadow-sm focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all duration-300" 
            />
          </div>
          <button 
            onClick={fetchData}
            className="p-4 bg-white border border-slate-100 hover:border-slate-200 text-slate-400 hover:text-indigo-600 rounded-2xl shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            <RefreshCcw size={18} />
          </button>
        </div>
      </div>

      {/* DIAGNOSTIC ERROR BOX */}
      {debugInfo && (
        <div className="bg-red-50/50 border border-red-100 p-6 rounded-[2rem] flex items-start gap-4">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-[9px] font-black uppercase text-red-600 tracking-wider">System Diagnostic Alert</p>
            <p className="text-xs font-bold text-red-800 leading-relaxed mt-0.5">{debugInfo}</p>
          </div>
        </div>
      )}

      {/* TABLE SECTION */}
      {filtered.length === 0 && !debugInfo ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 py-20 text-center">
          <GraduationCap className="mx-auto text-slate-200 mb-4 animate-pulse" size={56} />
          <p className="font-black text-slate-400 uppercase text-xs tracking-widest">No matching student directories located.</p>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="p-6">Student Identity</th>
                  <th className="p-6">Date Registered</th>
                  <th className="p-6">Active Class Track</th>
                  <th className="p-6 text-center">Semester</th>
                  <th className="p-6 text-center">Engagement Log</th>
                  <th className="p-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm font-bold text-slate-700">
                {filtered.map(s => (
                  <tr key={s.student_id || s.id} className="group hover:bg-slate-50/20 transition-colors">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-sm uppercase group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300 shrink-0">
                          {s.full_name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <p className="text-base font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors duration-300">{s.full_name}</p>
                          <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider mt-0.5 leading-none">{s.email || 'No email provided'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="text-xs text-slate-500 font-bold leading-none">
                        {formatDate(s.created_at)}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className={`inline-block px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest leading-none ${
                        s.class_name && s.class_name !== 'Unassigned' 
                          ? 'bg-blue-50 border border-blue-100 text-blue-600' 
                          : 'bg-slate-50 border border-slate-100 text-slate-400'
                      }`}>
                        {s.class_name || 'Unassigned'}
                      </span>
                    </td>
                    <td className="p-6 text-center">
                      <span className={`inline-block px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest leading-none ${
                        s.semester && s.semester !== 'N/A' 
                          ? 'bg-purple-50 border border-purple-100 text-purple-600' 
                          : 'bg-slate-50 border border-slate-100 text-slate-400'
                      }`}>
                        {s.semester && s.semester !== 'N/A' ? `Sem ${s.semester}` : 'N/A'}
                      </span>
                    </td>
                    <td className="p-6 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="text-base font-black text-slate-800 leading-none">{s.days_present || 0}</span>
                        <span className="text-[8px] text-slate-400 uppercase font-black tracking-widest mt-1">Days Present</span>
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <button 
                        onClick={() => deleteStudent(s.student_id || s.id)} 
                        className="w-10 h-10 inline-flex items-center justify-center bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-100 text-slate-300 hover:text-red-500 rounded-xl transition-all cursor-pointer"
                      >
                        <UserMinus size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}