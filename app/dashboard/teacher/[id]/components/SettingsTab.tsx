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
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [inviteCode, setInviteCode] = useState<string>('')
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [copied, setCopied] = useState(false)

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
      alert("Failed to generate invite code: " + err.message)
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
      // 1. Construct lecturer names array containing serialized contact details
      const lecturerNamesArray = [
        lecturerName.trim(),
        `email:${lecturerEmail.trim()}`,
        `phone:${lecturerPhone.trim()}`
      ].filter(Boolean)

      // 2. Update classes table first (so that database sync triggers run first)
      const { error: classErr } = await supabase
        .from('classes')
        .update({
          name: subjectName,
          subject_name: subjectName,
          semester: parseInt(semester),
          class_date: startDate || null,
          start_time: startTime || null,
          end_time: endTime || null,
          lecture_name: lecturerName.trim(),
          room: room
        })
        .eq('id', subject.id)

      if (classErr) throw classErr

      // 3. Update subjects table second (preserving our rich lecturer_names details)
      const { error: subjectErr } = await supabase
        .from('subjects')
        .update({
          name: subjectName,
          semester: parseInt(semester),
          start_date: startDate || null,
          class_start_time: startTime || null,
          class_end_time: endTime || null,
          lecturer_names: lecturerNamesArray,
          room: room
        })
        .eq('id', subject.id)

      if (subjectErr) throw subjectErr

      setSuccess(true)
      if (onRefresh) await onRefresh()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
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
                  <Mail size={14} className="text-pink-500" /> Lecturer Email
                </label>
                <input
                  type="email"
                  required
                  value={lecturerEmail}
                  onChange={e => setLecturerEmail(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-100/50 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all text-slate-800"
                  placeholder="lecturer@university.edu"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone size={14} className="text-teal-500" /> Lecturer Phone
                </label>
                <input
                  type="tel"
                  required
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

    </div>
  )
}