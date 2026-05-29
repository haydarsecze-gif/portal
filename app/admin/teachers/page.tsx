'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Check, X, Trash2, Mail, Clock, ShieldAlert, Loader2, Sparkles, UserCheck } from 'lucide-react'

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchTeachers() }, [])

  const fetchTeachers = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*')
    if (!error) {
      setTeachers(data.filter(p => p.role === 'teacher') || [])
    }
    setLoading(false)
  }

  const updateStatus = async (id: string, approved: boolean) => {
    await supabase.from('profiles').update({ is_approved: approved }).eq('id', id)
    fetchTeachers()
  }

  const deleteTeacher = async (id: string) => {
    if (confirm("Delete this teacher account?")) {
      await supabase.from('profiles').delete().eq('id', id)
      fetchTeachers()
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-300">
      <Loader2 className="animate-spin mb-2" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Teacher Approvals...</p>
    </div>
  )

  const pending = teachers.filter(t => !t.is_approved)
  const approved = teachers.filter(t => t.is_approved)

  return (
    <div className="space-y-12 animate-in fade-in duration-300 font-sans select-none">
      
      {/* Pending Approvals Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Clock className="text-amber-500" size={18} />
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Pending Teacher Approvals</h2>
          <span className="bg-amber-50 border border-amber-100 text-amber-600 px-3 py-1 rounded-lg text-[10px] font-black tracking-widest">{pending.length}</span>
        </div>
        
        <div className="grid gap-4">
          {pending.length > 0 ? (
            pending.map(t => (
              <div key={t.id} className="bg-white border border-slate-100 p-6 rounded-[2rem] flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-sm uppercase">
                    {t.full_name?.[0] || 'T'}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-850 uppercase tracking-tight">{t.full_name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{t.email || 'No email provided'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => updateStatus(t.id, true)} 
                    className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-500/10 active:scale-95 transition-all cursor-pointer"
                  >
                    <Check size={16} strokeWidth={3} />
                  </button>
                  <button 
                    onClick={() => deleteTeacher(t.id)} 
                    className="bg-slate-50 border border-slate-150 hover:bg-red-50 text-slate-400 hover:text-red-500 hover:border-red-100 p-3 rounded-2xl active:scale-95 transition-all cursor-pointer"
                  >
                    <X size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
              <Sparkles size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No pending teacher registration logs found.</p>
            </div>
          )}
        </div>
      </section>

      {/* Verified Faculty Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <UserCheck className="text-indigo-600" size={18} />
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Verified Faculty Directory</h2>
          <span className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-black tracking-widest">{approved.length}</span>
        </div>
        
        <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Teacher Profile Details</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Account Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {approved.length > 0 ? (
                  approved.map(t => (
                    <tr key={t.id} className="group hover:bg-slate-50/20 transition-colors">
                      <td className="p-6">
                        <div className="font-bold text-sm text-slate-800 uppercase tracking-tight">{t.full_name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{t.email || 'No email provided'}</div>
                      </td>
                      <td className="p-6 text-right">
                        <button 
                          onClick={() => deleteTeacher(t.id)} 
                          className="text-slate-300 hover:text-red-500 p-2.5 hover:bg-red-50 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="p-12 text-center text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50/30">
                      No verified lecturing faculty found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}