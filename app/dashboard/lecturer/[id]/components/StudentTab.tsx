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

  // Premium Alert/Confirm Dialog Modal State
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'success' | 'warning';
    onConfirm?: () => void;
    onCancel?: () => void;
    isConfirm?: boolean;
  }>({ isOpen: false, title: '', message: '', type: 'info' })

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

  const handleRemoveClick = (studentId: string, studentName: string) => {
    setAlertConfig({
      isOpen: true,
      title: 'Remove Student',
      message: `Are you sure you want to remove ${studentName || 'this student'} from the class roster?`,
      type: 'warning',
      isConfirm: true,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('student_classes').delete().eq('student_id', studentId).eq('subject_id', classId)
          if (error) throw error
          onRefresh()
        } catch (err: any) {
          setAlertConfig({
            isOpen: true,
            title: 'Action Failed',
            message: err.message || 'An error occurred while removing the student.',
            type: 'error'
          })
        }
      }
    })
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-8 md:p-10 shadow-sm transition-all duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight uppercase">Class Roster</h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{students?.length || 0} Students Enrolled</p>
        </div>
        <button onClick={() => setShowModal(true)} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer">
          <UserPlus size={14} /> Add Student
        </button>
      </div>

      <div className="space-y-3">
        {students && students.length > 0 ? students.map((s: any) => (
          <div key={s.student_id} className="group flex justify-between items-center p-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-slate-100/50 hover:border-indigo-100 dark:hover:border-indigo-950 hover:bg-white dark:hover:bg-slate-950 transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-center font-black text-indigo-600 text-lg uppercase shrink-0">
                {s.full_name?.charAt(0) || 'S'}
              </div>
              <div className="min-w-0">
                <p className="font-black text-slate-800 text-sm leading-tight truncate mb-0.5">{s.full_name}</p>
                <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                  <Mail size={11} className="shrink-0" />
                  <span className="text-[10px] font-semibold truncate max-w-[180px] sm:max-w-xs">{s.email || 'No Email'}</span>
                </div>
              </div>
            </div>
            <button onClick={() => handleRemoveClick(s.student_id, s.full_name)} className="sm:opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all opacity-100 shrink-0 cursor-pointer">
              <X size={18} />
            </button>
          </div>
        )) : (
          <div className="text-center py-16 bg-slate-50/30 rounded-[2rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
            <User size={40} className="mx-auto text-slate-200 dark:text-slate-700 mb-3" />
            <p className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">No active students found</p>
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

      {/* Premium custom alert/confirm glassmorphic modal */}
      {alertConfig.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 relative flex flex-col gap-6 animate-in zoom-in-95 duration-300">
            <div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                alertConfig.type === 'error' 
                  ? 'bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400'
                  : alertConfig.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 text-amber-600 dark:text-amber-400'
                    : 'bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400'
              }`}>
                {alertConfig.type === 'error' ? 'System Alert' : alertConfig.type === 'warning' ? 'User Confirmation' : 'Notification'}
              </span>
              <h3 className="text-xl font-black text-slate-850 dark:text-white uppercase tracking-tight mt-2 leading-none">
                {alertConfig.title}
              </h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                {alertConfig.message}
              </p>
            </div>

            <div className="flex gap-3">
              {alertConfig.isConfirm ? (
                <>
                  <button
                    onClick={() => {
                      setAlertConfig(prev => ({ ...prev, isOpen: false }))
                      if (alertConfig.onCancel) alertConfig.onCancel()
                    }}
                    className="flex-1 py-3.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setAlertConfig(prev => ({ ...prev, isOpen: false }))
                      if (alertConfig.onConfirm) alertConfig.onConfirm()
                    }}
                    className={`flex-1 py-3.5 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer ${
                      alertConfig.type === 'error'
                        ? 'bg-rose-600 hover:bg-rose-500'
                        : 'bg-indigo-600 hover:bg-indigo-500'
                    }`}
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setAlertConfig(prev => ({ ...prev, isOpen: false }))
                    if (alertConfig.onConfirm) alertConfig.onConfirm()
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-950/10 active:scale-95 transition-all cursor-pointer"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}