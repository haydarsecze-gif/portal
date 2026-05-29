'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { UserPlus, X, Search, Mail, User, Loader2, AlertCircle } from 'lucide-react'

export default function StudentTab({ students, classId, onRefresh }: any) {
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [allProfiles, setAllProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (showModal) {
      setErrorMessage(null)
      Promise.all([
        supabase.from('profiles').select('id, full_name').eq('role', 'student'),
        supabase.from('students').select('id, email')
      ]).then(([profRes, studRes]) => {
        const profs = profRes.data || []
        const studs = studRes.data || []
        const combined = profs.map(p => {
          const s = studs.find(x => x.id === p.id)
          return {
            id: p.id,
            full_name: p.full_name,
            email: s?.email || 'No Email'
          }
        })
        setAllProfiles(combined)
      }).catch(err => {
        console.error("Error loading profiles/students for enroll list:", err)
      })
    }
  }, [showModal])

  const addStudent = async (studentId: string) => {
    setLoading(true)
    try {
      const { error } = await supabase.from('student_classes').insert({ student_id: studentId, subject_id: classId })
      if (error) throw error
      await onRefresh()
      setShowModal(false)
    } catch (err: any) {
      setErrorMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  const removeStudent = async (studentId: string) => {
    if (!confirm("Remove student?")) return
    try {
      await supabase.from('student_classes').delete().eq('student_id', studentId).eq('subject_id', classId)
      onRefresh()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 p-10 shadow-sm">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Class Roster</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{students?.length || 0} Students Found</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-lg">
          <UserPlus size={16} /> Add Student
        </button>
      </div>

      <div className="space-y-3">
        {students && students.length > 0 ? students.map((s: any) => (
          <div key={s.student_id} className="group flex justify-between items-center p-5 bg-gray-50/50 rounded-[2rem] border border-transparent hover:border-blue-100 hover:bg-white transition-all">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-white border-2 border-gray-100 rounded-2xl flex items-center justify-center font-black text-blue-600 text-xl uppercase">
                {s.full_name?.charAt(0) || 'S'}
              </div>
              <div>
                <p className="font-black text-slate-800 text-lg leading-none mb-1">{s.full_name}</p>
                <div className="flex items-center gap-2 text-gray-400">
                  <Mail size={12} />
                  <span className="text-xs font-semibold normal-case tracking-normal text-slate-500">{s.email || 'No Email'}</span>
                </div>
              </div>
            </div>
            <button onClick={() => removeStudent(s.student_id)} className="opacity-0 group-hover:opacity-100 p-3 text-gray-300 hover:text-red-500 transition-all">
              <X size={20} />
            </button>
          </div>
        )) : (
          <div className="text-center py-20 bg-gray-50/30 rounded-[3rem] border-2 border-dashed border-gray-100">
            <User size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No active students found</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl animate-in zoom-in-95">
             <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black uppercase tracking-widest text-slate-800">Enroll Student</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400"><X size={24}/></button>
            </div>
            <input 
              placeholder="Search student profile name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full p-4 mb-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
            <div className="max-h-72 overflow-y-auto space-y-2 pr-2">
              {allProfiles.filter(p => 
                p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
                p.email?.toLowerCase().includes(search.toLowerCase())
              ).map((p) => {
                const isAlreadyIn = students?.some((s: any) => s.student_id === p.id);
                return (
                  <div key={p.id} className="flex justify-between items-center p-4 hover:bg-slate-50 rounded-[1.5rem] transition-colors">
                    <div>
                      <p className="text-sm font-black text-slate-700">{p.full_name}</p>
                      <p className="text-[10px] text-slate-400 font-bold leading-none mt-0.5">{p.email}</p>
                    </div>
                    <button disabled={loading || isAlreadyIn} onClick={() => addStudent(p.id)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase ${isAlreadyIn ? 'bg-gray-100 text-gray-300' : 'bg-blue-600 text-white'}`}>
                      {isAlreadyIn ? 'Joined' : 'Add'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}