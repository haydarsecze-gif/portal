'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Hash, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Clock, 
  Copy, 
  Check, 
  Save, 
  Loader2, 
  Link, 
  CheckCircle,
  AlertCircle,
  MapPin
} from 'lucide-react'

export default function SettingsTab({ subject, onRefresh }: any) {
  const [subjectName, setSubjectName] = useState(subject?.name || '')
  const [semester, setSemester] = useState(subject?.semester?.toString() || '1')
  const [startDate, setStartDate] = useState(subject?.start_date || '')
  const [startTime, setStartTime] = useState(subject?.class_start_time || '')
  const [endTime, setEndTime] = useState(subject?.class_end_time || '')
  const [room, setRoom] = useState(subject?.room || '')
  
  const [lecturerName, setLecturerName] = useState('')
  const [lecturerEmail, setLecturerEmail] = useState('')
  const [lecturerPhone, setLecturerPhone] = useState('')

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [inviteCode, setInviteCode] = useState<string>('')
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [copied, setCopied] = useState(false)

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
    if (subject) {
      setSubjectName(subject.name || '')
      setSemester(subject.semester?.toString() || '1')
      setStartDate(subject.start_date || '')
      setStartTime(subject.class_start_time || '')
      setEndTime(subject.class_end_time || '')
      setRoom(subject.room || '')

      let lName = ''
      let lEmail = ''
      let lPhone = ''
      
      if (Array.isArray(subject.lecturer_names)) {
        subject.lecturer_names.forEach((item: string) => {
          if (item.startsWith('email:')) {
            lEmail = item.substring(6)
          } else if (item.startsWith('phone:')) {
            lPhone = item.substring(6)
          } else {
            lName = item
          }
        })
      } else if (typeof subject.lecturer_names === 'string') {
        lName = subject.lecturer_names
      }

      setLecturerName(lName)
      setLecturerEmail(lEmail)
      setLecturerPhone(lPhone)
    }
  }, [subject])

  useEffect(() => {
    async function fetchInviteCode() {
      if (!subject?.id) return
      setLoadingInvite(true)
      try {
        const { data, error } = await supabase
          .from('invite_codes')
          .select('code')
          .eq('class_id', subject.id)
          .maybeSingle()
        if (data) {
          setInviteCode(data.code)
        } else {
          setInviteCode('')
        }
      } catch (err) {
        console.error("Error fetching invite code:", err)
      } finally {
        setLoadingInvite(false)
      }
    }
    fetchInviteCode()
  }, [subject?.id])

  const handleGenerateInvite = async () => {
    if (!subject?.id) return
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const numbers = '0123456789'
    let code = ''
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
    for (let i = 0; i < 3; i++) code += numbers.charAt(Math.floor(Math.random() * numbers.length))

    try {
      const { error } = await supabase
        .from('invite_codes')
        .insert({ 
          code, 
          class_id: subject.id,
          used: false
        })

      if (error) {
        if (error.code === '23505') {
          // Retry on primary key collision
          return handleGenerateInvite()
        }
        throw error
      }
      setInviteCode(code)
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: 'Invite Code Error',
        message: "Failed to generate invite code: " + err.message,
        type: 'error'
      })
    }
  }

  const handleCopyLink = () => {
    if (!inviteCode) return
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const link = `${origin}/auth/register?code=${inviteCode}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      // Get the authenticated session token from Supabase Client
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Unauthorized: No active session located.")

      // Call the server-side API endpoint to perform the updates securely bypassing client RLS
      const response = await fetch('/api/subjects/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          subjectId: subject.id,
          subjectName,
          semester: parseInt(semester),
          startDate: startDate || null,
          startTime: startTime || null,
          endTime: endTime || null,
          room,
          lecturerName,
          lecturerEmail: lecturerEmail || '',
          lecturerPhone: lecturerPhone || ''
        })
      })

      const resData = await response.json()
      if (!response.ok) {
        throw new Error(resData.error || "Failed to write classroom settings to database.")
      }

      setSuccess(true)
      if (onRefresh) await onRefresh()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = () => {
    setAlertConfig({
      isOpen: true,
      title: 'Delete Subject Completely',
      message: `Are you sure you want to permanently delete "${subjectName || 'this subject'}"? This will erase all curriculum files, student submissions, and roster data. This action cannot be undone.`,
      type: 'warning',
      isConfirm: true,
      onConfirm: async () => {
        setDeleting(true);
        setError(null);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("Unauthorized: No active session located.");

          const response = await fetch(`/api/subjects/settings?subjectId=${subject.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });

          const resData = await response.json();
          if (!response.ok) {
            throw new Error(resData.error || "Failed to delete classroom from institutional database.");
          }

          setAlertConfig({
            isOpen: true,
            title: 'Subject Deleted',
            message: 'Classroom has been successfully removed. Redirecting to lecturer dashboard...',
            type: 'success',
            onConfirm: () => {
              window.location.href = '/dashboard/lecturer';
            }
          });
        } catch (err: any) {
          setError(err.message);
          setAlertConfig({
            isOpen: true,
            title: 'Deletion Failed',
            message: err.message || 'An error occurred during deletion.',
            type: 'error'
          });
        } finally {
          setDeleting(false);
        }
      }
    });
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Invite Code & Share Card */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-y-10 translate-x-10 opacity-5 pointer-events-none">
          <Link size={300} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
              Class Registration Code
            </span>
            <h3 className="text-2xl font-black tracking-tight">Invite Enrolled Students</h3>
            <p className="text-slate-400 text-xs max-w-md font-medium leading-relaxed">
              Share the registration link containing the unique invite code to allow students to enroll in this specific subject.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
            {loadingInvite ? (
              <div className="flex items-center gap-2 p-4 text-slate-400">
                <Loader2 className="animate-spin" size={16} />
                <span className="text-xs uppercase font-black tracking-widest">Resolving Link...</span>
              </div>
            ) : inviteCode ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-slate-800/80 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden p-1.5 w-full sm:w-auto">
                <span className="font-mono font-black text-xl px-5 py-2 text-center text-blue-400 uppercase tracking-widest">
                  {inviteCode}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-900/40"
                >
                  {copied ? (
                    <><Check size={14} strokeWidth={3} /> Copied!</>
                  ) : (
                    <><Copy size={14} /> Copy Invite Link</>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerateInvite}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-950/55"
              >
                <Link size={14} /> Generate Code
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="bg-white rounded-[2.5rem] border border-gray-100 p-8 md:p-10 shadow-sm space-y-8">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Classroom Settings</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Configure general metadata & schedule</p>
        </div>

        {error && (
          <div className="p-5 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider mb-0.5">Configuration Error</p>
              <p className="text-xs font-semibold leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3 text-emerald-600 animate-in fade-in duration-200">
            <CheckCircle className="shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider mb-0.5">Settings Saved</p>
              <p className="text-xs font-semibold leading-relaxed">Classroom details have been successfully written to institutional databases.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* General Details */}
          <div className="space-y-5">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Course Information</h3>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Hash size={14} className="text-blue-500" /> Subject Name
              </label>
              <input
                type="text"
                required
                value={subjectName}
                onChange={e => setSubjectName(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-100/50 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all text-slate-800"
                placeholder="Enter subject name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={14} className="text-purple-500" /> Semester
                </label>
                <select
                  value={semester}
                  onChange={e => setSemester(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-100/50 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all text-slate-800 appearance-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={14} className="text-red-500" /> Room
                </label>
                <input
                  type="text"
                  required
                  value={room}
                  onChange={e => setRoom(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-100/50 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all text-slate-800"
                  placeholder="e.g. Room 611"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} className="text-emerald-500" /> Semester Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-100/50 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all text-slate-800"
              />
            </div>
          </div>

          {/* Lecturer Info & Times */}
          <div className="space-y-5">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Lecturer & Schedule</h3>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <User size={14} className="text-indigo-500" /> Lecturer Name
              </label>
              <input
                type="text"
                required
                value={lecturerName}
                onChange={e => setLecturerName(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-100/50 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all text-slate-800"
                placeholder="Dr. Lecturer Name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail size={14} className="text-pink-500" /> Lecturer Email (Optional)
                </label>
                <input
                  type="email"
                  value={lecturerEmail}
                  onChange={e => setLecturerEmail(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-100/50 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all text-slate-800"
                  placeholder="lecturer@university.edu"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone size={14} className="text-teal-500" /> Lecturer Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={lecturerPhone}
                  onChange={e => setLecturerPhone(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-100/50 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all text-slate-800"
                  placeholder="+855 123 4567"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-500" /> Class Start Time
                </label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-100/50 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all text-slate-800"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-600" /> Class End Time
                </label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-100/50 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="pt-6 border-t border-gray-50 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-100 disabled:text-slate-400 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-100"
          >
            {saving ? (
              <><Loader2 className="animate-spin" size={14} /> Saving Settings...</>
            ) : (
              <><Save size={14} /> Save Classroom Settings</>
            )}
          </button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="bg-red-50/50 dark:bg-rose-950/10 border border-red-100 dark:border-rose-900/30 rounded-[2.5rem] p-8 md:p-10 space-y-6">
        <div>
          <h2 className="text-xl font-black text-rose-600 tracking-tight uppercase">Danger Zone</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Critical operations that cannot be undone</p>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-red-100/50 dark:border-rose-950/20">
          <div className="space-y-1">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Delete Classroom / Subject</h4>
            <p className="text-xs font-bold text-slate-450 dark:text-slate-500 leading-relaxed max-w-md">
              Permanently delete this classroom and all of its associated assignments, materials, student enrollment mappings, and attendance logs. This action is irreversible.
            </p>
          </div>
          
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={deleting}
            className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white disabled:bg-slate-100 disabled:text-slate-400 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-100/20 cursor-pointer flex items-center justify-center gap-2 shrink-0"
          >
            {deleting ? (
              <><Loader2 className="animate-spin" size={14} /> Deleting Subject...</>
            ) : (
              'Delete Subject'
            )}
          </button>
        </div>
      </div>

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