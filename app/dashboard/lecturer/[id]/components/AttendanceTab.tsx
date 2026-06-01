'use client'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { 
  User, 
  HelpCircle, 
  Loader2, 
  X, 
  Edit3, 
  Save, 
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  EyeOff,
  Eye
} from 'lucide-react'

// System Attendance Mapping matching exact structural specifications
const ATTENDANCE_KEYS = [
  { code: 'P', label: 'Present', color: 'bg-green-100 text-green-700 border-green-200' },
  { code: 'L', label: 'Late', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { code: 'X', label: 'Not Present', color: 'bg-red-100 text-red-700 border-red-200' },
  { code: 'M', label: 'Medical', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { code: 'V', label: 'Valid Reasons', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { code: 'H', label: 'Holiday', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { code: 'N', label: 'Not Applicable', color: 'bg-gray-50 text-gray-400 border-gray-100' },
]

interface ActiveDropdownState {
  studentId: string
  week: number
  rect: DOMRect | null
}

// Note: classId variable represents the Subject UUID parameter here 
export default function AttendanceTab({ classId }: { classId: string }) {
  const [students, setStudents] = useState<any[]>([])
  const [attendanceData, setAttendanceData] = useState<Record<string, any>>({})
  const [originalData, setOriginalData] = useState<Record<string, any>>({}) 
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdownState | null>(null)
  const [rawRecords, setRawRecords] = useState<any[]>([])
  const [mounted, setMounted] = useState(false)
  // Toggle: when true, changes will be hidden from student view
  const [hideFromStudent, setHideFromStudent] = useState(false)
  // Confirm save modal
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  // Toast notification system
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const weeks = Array.from({ length: 17 }, (_, i) => i + 1)

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])


  useEffect(() => {
    setMounted(true)
  }, [])

  // FIXED: Fetches roster from student_classes mapping to prevent out-of-sync loads
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch cross-reference student IDs enrolled in this subject track UUID
      const { data: mappings, error: mapErr } = await supabase
        .from('student_classes')
        .select('student_id')
        .eq('subject_id', classId)

      if (mapErr) throw mapErr

      let profileData: any[] = []
      
      if (mappings && mappings.length > 0) {
        const studentIds = mappings.map(m => m.student_id)
        
        // Resolve student names from profiles table first, matching email from students table if it exists
        const [profRes, studRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name').in('id', studentIds),
          supabase.from('students').select('id, email').in('id', studentIds)
        ])

        if (profRes.error) throw profRes.error
        
        const resolvedProfiles = profRes.data || []
        const resolvedStudents = studRes.data || []

        profileData = resolvedProfiles.map(p => {
          const s = resolvedStudents.find(x => x.id === p.id)
          return {
            id: p.id,
            name: p.full_name || 'Enrolled Student',
            email: s?.email || 'No Email'
          }
        }).sort((a, b) => a.name.localeCompare(b.name))
      }

      // 3. Fetch log rows where class_id equals our active subject track token
      const { data: attData, error: attErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('class_id', classId)

      if (attErr) throw attErr

      const attMap: Record<string, string> = {}
      attData?.forEach(r => { 
        attMap[`${r.student_id}-${r.week}`] = r.status 
      })

      setStudents(profileData)
      setAttendanceData(attMap)
      setOriginalData(attMap) 
      setRawRecords(attData || [])
    } catch (error) {
      console.error("Attendance grid resolution error summary:", error)
    } finally {
      setLoading(false)
    }
  }, [classId])

  useEffect(() => {
    if (classId) fetchData()
  }, [classId, fetchData])

  useEffect(() => {
    function handleScrollOrClickOutside(event: Event) {
      if (!activeDropdown) return

      // If it's a mousedown event, check if we clicked inside the portal dropdown
      if (event.type === 'mousedown') {
        const mouseEvent = event as MouseEvent
        const dropdownEl = document.getElementById('attendance-dropdown-portal')
        if (dropdownEl && dropdownEl.contains(mouseEvent.target as Node)) {
          return
        }
      }
      setActiveDropdown(null)
    }

    document.addEventListener("mousedown", handleScrollOrClickOutside)
    window.addEventListener("scroll", handleScrollOrClickOutside, true) // capture phase to catch horizontal table scroll too
    window.addEventListener("resize", handleScrollOrClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleScrollOrClickOutside)
      window.removeEventListener("scroll", handleScrollOrClickOutside, true)
      window.removeEventListener("resize", handleScrollOrClickOutside)
    }
  }, [activeDropdown])



  const handleStatusChange = (studentId: string, week: number, newStatus: string) => {
    setAttendanceData(prev => ({
      ...prev,
      [`${studentId}-${week}`]: newStatus
    }))
    setActiveDropdown(null)
  }

  const handleCancel = () => {
    setAttendanceData(originalData) 
    setIsEditing(false)
    setActiveDropdown(null)
    setHideFromStudent(false)
  }

  const saveToDatabase = async () => {
    setShowSaveConfirm(false)
    setSaving(true)
    try {
      const records = Object.entries(attendanceData)
        .filter(([key, status]) => originalData[key] !== status)
        .map(([key, status]) => {
          const lastHyphenIndex = key.lastIndexOf('-')
          const student_id = key.substring(0, lastHyphenIndex)
          const week = key.substring(lastHyphenIndex + 1)
          const weekNum = parseInt(week)
          const matched = rawRecords.find(r => r.student_id === student_id && r.week === weekNum)
          return {
            class_id: classId,
            student_id,
            week: weekNum,
            status,
            check_in_time: matched ? matched.check_in_time : null,
            hidden_from_student: hideFromStudent
          }
        })

      if (records.length === 0) {
        setIsEditing(false)
        setHideFromStudent(false)
        return
      }

      // Separate explicit updates from resets
      const upsertRows = records.filter(r => r.status !== '--' && r.status !== 'N')
      const deleteRows = records.filter(r => r.status === '--' || r.status === 'N')

      // Save valid attendance logs with hidden_from_student flag
      if (upsertRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from('attendance')
          .upsert(upsertRows, { onConflict: 'class_id,student_id,week' })
        if (upsertErr) throw upsertErr
      }

      // Delete unmarked logs to match Admin operations layout
      for (const row of deleteRows) {
        await supabase
          .from('attendance')
          .delete()
          .eq('class_id', classId)
          .eq('student_id', row.student_id)
          .eq('week', row.week)
      }
      
      await fetchData()
      setIsEditing(false)
      setHideFromStudent(false)
      
      setNotification({
        message: hideFromStudent 
          ? "Attendance saved! Changes are visible to lecturers & admins only — students will see their original status." 
          : "Attendance changes successfully committed! Students can now see the updated status.",
        type: 'success'
      })
    } catch (err: any) {
      console.error("Lecturer portal push error execution tracker:", err)
      setNotification({
        message: "Failed to save changes: " + err.message,
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-300">
      <Loader2 className="animate-spin mb-2" />
      <p className="text-[10px] font-black uppercase tracking-widest">Syncing Attendance Grid...</p>
    </div>
  )

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Attendance Record</h3>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-1.5 h-1.5 rounded-full ${isEditing ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {isEditing ? 'Unsaved Changes Present' : 'Database Synced'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button onClick={() => setShowHelp(true)} className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm flex items-center justify-center h-11 w-11 cursor-pointer shrink-0">
            <HelpCircle size={18} />
          </button>
          
          {!isEditing ? (
            <button 
              onClick={() => setIsEditing(true)}
              className="flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-900 dark:bg-slate-950 border border-slate-900 dark:border-slate-850 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md active:scale-95 transition-all h-11 cursor-pointer shrink-0"
            >
              <Edit3 size={12} /> Edit Mode
            </button>
          ) : (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-4 w-full sm:w-auto">
              <button 
                onClick={handleCancel} 
                disabled={saving}
                className="px-5 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-855 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all h-11 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => setShowSaveConfirm(true)}
                disabled={saving}
                className="flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md active:scale-95 transition-all h-11 cursor-pointer"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} 
                Commit
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-3 sm:p-4 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100 sticky left-0 bg-white z-40 w-32 min-w-[130px] sm:w-72 sm:min-w-[280px]">Student List</th>
                {weeks.map(w => (
                  <th key={w} className="p-4 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100 text-center min-w-[64px]">W{w}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.length > 0 ? (
                students.map((student) => (
                  <tr key={student.id} className="group">
                    <td className="p-3 sm:p-4 border-b border-slate-50 sticky left-0 bg-white group-hover:bg-slate-50/50 z-30 shadow-[5px_0_10px_-5px_rgba(0,0,0,0.05)] w-32 min-w-[130px] sm:w-72 sm:min-w-[280px] max-w-[130px] sm:max-w-none">
                      <div className="font-bold text-slate-700 text-sm truncate">{student.name}</div>
                      <div className="hidden sm:block text-[10px] text-slate-400 font-medium normal-case tracking-normal mt-0.5 truncate">{student.email || 'No Email'}</div>
                    </td>
                    {weeks.map(week => {
                      const cellKey = `${student.id}-${week}`
                      const status = attendanceData[cellKey] || '--'
                      const config = ATTENDANCE_KEYS.find(k => k.code === status) || { code: '--', color: 'bg-slate-50 text-slate-400 border-slate-200' }
                      const isDropdownOpen = activeDropdown?.studentId === student.id && activeDropdown?.week === week

                      // Show hidden badge if this cell is hidden from student
                      const rawRecord = rawRecords.find(r => r.student_id === student.id && r.week === week)
                      const isHidden = rawRecord?.hidden_from_student === true

                      const handleCellClick = (e: React.MouseEvent) => {
                        if (!isEditing) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        setActiveDropdown({
                          studentId: student.id,
                          week,
                          rect
                        })
                      }

                      return (
                        <td key={week} className="p-2 border-b border-slate-50 text-center relative">
                          {!isEditing ? (
                            <div className="relative inline-block">
                              <div
                                className={`
                                  w-11 h-11 rounded-2xl border-2 font-black text-xs flex items-center justify-center mx-auto
                                  ${config.color} opacity-90 grayscale-[0.2]
                                `}
                              >
                                {status}
                              </div>
                              {isHidden && (
                                <div className="absolute -top-1 -right-1 bg-amber-400 rounded-full p-0.5" title="Hidden from student">
                                  <EyeOff size={8} className="text-white" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={handleCellClick}
                              className={`
                                w-11 h-11 rounded-2xl border-2 font-black text-xs flex items-center justify-center mx-auto transition-all cursor-pointer relative outline-none focus:ring-2 focus:ring-blue-500/30
                                ${config.color} ${isDropdownOpen ? 'border-blue-500 scale-110 ring-2 ring-blue-100' : 'border-slate-200 hover:scale-105 active:scale-95'}
                              `}
                            >
                              {status}
                              <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 border border-slate-100 shadow-sm">
                                <ChevronDown size={8} className="text-slate-400" />
                              </div>
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={18} className="p-12 text-center text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                    No active student rosters assigned to this course path track.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Help / Abbreviations */}
      {showHelp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                <h2 className="text-xl font-black tracking-tight uppercase">Attendance System Help</h2>
                <button onClick={() => setShowHelp(false)} className="hover:rotate-90 transition-transform p-1"><X size={24}/></button>
             </div>
             <div className="p-8 space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Abbreviations</p>
                <div className="grid grid-cols-1 gap-3">
                  {ATTENDANCE_KEYS.map(k => (
                    <div key={k.code} className="flex items-center gap-4 p-2 rounded-2xl hover:bg-slate-50 transition-colors">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border-2 ${k.color}`}>{k.code}</div>
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase">{k.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowHelp(false)} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest mt-6">Close</button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL: Save Confirm with Hide from Student toggle */}
      {showSaveConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <Save size={22} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Commit Changes</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Choose visibility option</p>
                </div>
              </div>

              {/* Visibility toggle */}
              <button
                type="button"
                onClick={() => setHideFromStudent(prev => !prev)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all mb-6 text-left ${
                  hideFromStudent 
                    ? 'border-amber-300 bg-amber-50' 
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${hideFromStudent ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-400'}`}>
                  {hideFromStudent ? <EyeOff size={18} /> : <Eye size={18} />}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase tracking-tight">
                    Without update in the student portal
                  </p>
                  <p className="text-[10px] font-medium text-slate-500 mt-0.5 normal-case tracking-normal">
                    {hideFromStudent 
                      ? 'Changes will be saved for lecturers & admins only. Students will see their original check-in status.'
                      : 'Changes will immediately update and be visible to students in their portal.'
                    }
                  </p>
                </div>
                <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${hideFromStudent ? 'border-amber-400 bg-amber-400' : 'border-slate-300'}`}>
                  {hideFromStudent && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowSaveConfirm(false); setHideFromStudent(false); }}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveToDatabase}
                  disabled={saving}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PORTAL: Custom Attendance Dropdown Options (Dropbox) */}
      {mounted && activeDropdown && activeDropdown.rect && (() => {
        const dropdownHeight = 340 // max dropdown height approximation
        const spaceBelow = window.innerHeight - activeDropdown.rect.bottom
        const showAbove = spaceBelow < dropdownHeight && activeDropdown.rect.top > dropdownHeight

        const top = showAbove 
          ? activeDropdown.rect.top - 8 - dropdownHeight 
          : activeDropdown.rect.bottom + 8

        const left = Math.max(16, Math.min(window.innerWidth - 208, activeDropdown.rect.left + (activeDropdown.rect.width / 2) - 96))
        const activeStatus = attendanceData[`${activeDropdown.studentId}-${activeDropdown.week}`] || '--'

        return createPortal(
          <div 
            id="attendance-dropdown-portal"
            className="fixed bg-white border border-slate-100 rounded-3xl shadow-2xl z-[9999] p-2 animate-in zoom-in-95 duration-100 flex flex-col gap-1 overflow-y-auto"
            style={{
              top: `${top}px`,
              left: `${left}px`,
              width: '192px',
              maxHeight: `${dropdownHeight}px`
            }}
          >
            <button
              onClick={() => handleStatusChange(activeDropdown.studentId, activeDropdown.week, '--')}
              className={`flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 transition-colors w-full text-left cursor-pointer ${activeStatus === '--' ? 'bg-slate-50 border border-slate-200' : ''}`}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs border bg-slate-50 text-slate-400 border-slate-200">--</div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Reset (--)</span>
            </button>
            {ATTENDANCE_KEYS.map(k => (
              <button
                key={k.code}
                onClick={() => handleStatusChange(activeDropdown.studentId, activeDropdown.week, k.code)}
                className={`flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 transition-colors w-full text-left cursor-pointer ${activeStatus === k.code ? 'bg-slate-50 border border-slate-200' : ''}`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs border-2 ${k.color}`}>{k.code}</div>
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">{k.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )
      })()}

      {/* Modern custom notification toast overlay */}
      {notification && (
        <div className="fixed bottom-8 right-8 z-[10000] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`backdrop-blur-md border px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 max-w-md ${
            notification.type === 'error'
              ? 'bg-red-900/90 border-red-800 text-white'
              : 'bg-slate-900/90 border-slate-800 text-white'
          }`}>
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
              notification.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            </div>
            <div className="flex-1">
              <p className={`text-[10px] font-black uppercase tracking-widest ${
                notification.type === 'error' ? 'text-red-400' : 'text-blue-400'
              }`}>System Action</p>
              <p className="text-xs font-bold text-slate-100 mt-0.5 leading-relaxed">{notification.message}</p>
            </div>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white transition-colors shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}