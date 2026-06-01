'use client'
import { useEffect, useState } from 'react'
import { supabase, safeInsertNotifications } from '@/lib/supabase'
import { Search, Loader2, UserMinus, GraduationCap, AlertTriangle, RefreshCcw, Pencil, X, Save } from 'lucide-react'

// Relative time formatter: e.g. "1 day ago", "2 months ago", "1 year 2 months ago"
export function formatRelativeTime(dateStr?: string) {
  if (!dateStr) return 'N/A';
  try {
    const cleanStr = dateStr.replace(' ', 'T');
    const past = new Date(cleanStr);
    if (isNaN(past.getTime())) return 'N/A';
    
    const now = new Date();
    const diffMs = now.getTime() - past.getTime();
    if (diffMs < 0) return 'Just now';

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;

    const diffMonths = Math.floor(diffDays / 30.44); // average month length
    if (diffMonths < 12) {
      return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
    }

    const diffYears = Math.floor(diffMonths / 12);
    const remainingMonths = diffMonths % 12;

    if (remainingMonths === 0) {
      return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
    }

    const yearStr = diffYears === 1 ? '1 year' : `${diffYears} years`;
    const monthStr = remainingMonths === 1 ? '1 month' : `${remainingMonths} months`;
    return `${yearStr} ${monthStr} ago`;
  } catch (e) {
    console.error('Error formatting relative time:', e);
    return 'N/A';
  }
}

export default function StudentDirectory() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  
  // Class/Semester assignment states
  const [classesList, setClassesList] = useState<any[]>([])
  const [editingStudent, setEditingStudent] = useState<any>(null)
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editEmail, setEditEmail] = useState('')
  const [editBirthday, setEditBirthday] = useState('')
  const [editMoreDetail, setEditMoreDetail] = useState('')
  const [editSemester, setEditSemester] = useState<string>('')

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

  const fetchData = async () => {
    setLoading(true)
    setDebugInfo(null)
    
    try {
      let profiles: any[] = []
      const { data: profs, error: profErr } = await supabase
        .from('profiles')
        .select('id, class_id, created_at, birthday, more_detail, semester, email')
        .eq('role', 'student')

      if (profErr) {
        // Fallback to select without the new columns if they don't exist yet
        const { data: fallbackProfs, error: fallbackErr } = await supabase
          .from('profiles')
          .select('id, class_id, created_at, email')
          .eq('role', 'student')
        if (fallbackErr) throw fallbackErr
        profiles = (fallbackProfs || []).map(p => ({
          ...p,
          birthday: null,
          more_detail: '',
          semester: null
        }))
      } else {
        profiles = profs || []
      }

      const [overviewRes, classesRes] = await Promise.all([
        supabase.from('admin_student_overview').select('*'),
        supabase.from('classes').select('id, name, semester')
      ])

      if (overviewRes.error) throw overviewRes.error

      const overview = overviewRes.data || []
      const classes = classesRes.data || []

      const combined = overview.map(o => {
        const prof = profiles.find(p => p.id === o.student_id)
        const cls = classes.find(c => c.id === prof?.class_id)
        return {
          ...o,
          email: prof?.email || o.email || 'No email provided',
          birthday: prof?.birthday || null,
          more_detail: prof?.more_detail || '',
          semester: prof?.semester !== undefined && prof?.semester !== null ? prof.semester : (cls ? cls.semester : 'N/A'),
          class_name: cls ? cls.name : (o.subject_name || 'Unassigned'),
          created_at: prof?.created_at || o.created_at
        }
      })

      setStudents(combined)
      setClassesList(classes)
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
        setClassesList(classes)
        
        const mappedFallback = (fallbackData || []).map(p => {
          const cls = classes.find(c => c.id === p.class_id)
          return {
            id: p.id,
            student_id: p.id,
            full_name: p.full_name,
            email: p.email || 'No Email',
            created_at: p.created_at,
            semester: p.semester !== undefined && p.semester !== null ? p.semester : (cls ? cls.semester : 'N/A'),
            class_name: cls ? cls.name : 'Unassigned',
            birthday: p.birthday || null,
            more_detail: p.more_detail || '',
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
    const targetStudent = students.find(s => (s.student_id || s.id) === id)
    const studentName = targetStudent?.full_name || "Student"

    setAlertConfig({
      isOpen: true,
      title: "Delete Student Profile",
      message: `Are you sure you want to permanently delete student account "${studentName}"? This will erase all their class track enrollments, grades, and attendance logs.`,
      type: "warning",
      isConfirm: true,
      onConfirm: async () => {
        setAlertConfig(prev => ({ ...prev, isOpen: false }))
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
            setAlertConfig({
              isOpen: true,
              title: "Session Expired",
              message: "Unauthorized: No active session.",
              type: "error"
            })
            return
          }

          const res = await fetch('/api/auth/delete-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ userId: id })
          })

          const resData = await res.json()
          if (!res.ok) {
            setAlertConfig({
              isOpen: true,
              title: "Deletion Failed",
              message: "Failed to delete student: " + (resData.error || "Unknown serverless exception."),
              type: "error"
            })
            return
          }

          fetchData()
        } catch (err: any) {
          setAlertConfig({
            isOpen: true,
            title: "Database Error",
            message: err.message,
            type: "error"
          })
        }
      },
      onCancel: () => {
        setAlertConfig(prev => ({ ...prev, isOpen: false }))
      }
    })
  }

  const handleSaveStudentClass = async () => {
    if (!editingStudent) return
    const studentId = editingStudent.student_id || editingStudent.id
    try {
      const updatePayload: any = {
        email: editEmail.trim() || null,
        birthday: editBirthday || null,
        more_detail: editMoreDetail.trim() || null,
        semester: editSemester ? parseInt(editSemester) : null
      }

      // Update profiles table
      const { error: profileErr } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', studentId)

      if (profileErr) {
        // Fallback in case columns birthday/more_detail/semester don't exist yet in the database
        const isColumnErr = profileErr.code === '42703' || profileErr.message?.toLowerCase().includes("column")
        if (isColumnErr) {
          // Attempt update with email only
          const { error: retryErr } = await supabase
            .from('profiles')
            .update({ email: editEmail.trim() || null })
            .eq('id', studentId)
          if (retryErr) throw retryErr

          setAlertConfig({
            isOpen: true,
            title: "Partial Save Success",
            message: "Student email was successfully updated! However, birthday, semester, and details were not saved because the columns do not exist in your database yet. Please run the migration script in database.sql to add them.",
            type: "warning"
          })
        } else {
          throw profileErr
        }
      } else {
        // Update students table as well
        const studentPayload: any = {
          email: editEmail.trim() || null,
          birthday: editBirthday || null,
          more_detail: editMoreDetail.trim() || null,
          semester: editSemester ? parseInt(editSemester) : null
        }
        
        await supabase
          .from('students')
          .update(studentPayload)
          .eq('id', studentId)
      }

      // Resolve metadata and dispatch notifications
      try {
        let adminName = "Administrator"
        const { data: { session } } = await supabase.auth.getSession()
        const adminUser = session?.user
        if (adminUser) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', adminUser.id)
            .single()
          if (prof?.full_name) adminName = prof.full_name
        }

        const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

        // Notify the target student
        await safeInsertNotifications({
          user_id: studentId,
          title: "Profile Information Updated",
          message: `Your profile details were updated by admin ${adminName} at ${currentTime}.`,
          type: "system",
          link: "/dashboard/student"
        })

        // Notify all admins
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin')

        if (adminProfiles && adminProfiles.length > 0) {
          const adminNotifs = adminProfiles.map(adm => ({
            user_id: adm.id,
            title: "Student Profile Details Updated",
            message: `${adminName} updated student ${editingStudent.full_name}'s profile details at ${currentTime}.`,
            type: "approval",
            link: "/admin/students"
          }))
          await safeInsertNotifications(adminNotifs)
        }
      } catch (notifErr) {
        console.error("Error creating student profile change notifications:", notifErr)
      }

      setIsEditModalOpen(false)
      fetchData()
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: "Update Failed",
        message: "Failed to update student details: " + err.message,
        type: "error"
      })
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    try {
      const safeDateStr = dateStr.includes(' ') && !dateStr.includes('T') 
        ? dateStr.replace(' ', 'T') 
        : dateStr
      const d = new Date(safeDateStr)
      if (isNaN(d.getTime())) {
        return 'N/A'
      }
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch (e) {
      console.error("formatDate error:", e)
      return 'N/A'
    }
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
    <div className="space-y-5 animate-in fade-in duration-300 font-sans select-none">
      
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
        <div className="bg-white rounded-3xl border border-slate-100 py-20 text-center">
          <GraduationCap className="mx-auto text-slate-200 mb-4 animate-pulse" size={56} />
          <p className="font-black text-slate-400 uppercase text-xs tracking-widest">No matching student directories located.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="p-4 sm:p-5">Student Identity</th>
                  <th className="p-4 sm:p-5">Date Registered</th>
                  <th className="p-4 sm:p-5 text-center">Semester</th>
                  <th className="p-4 sm:p-5">Birthday</th>
                  <th className="p-4 sm:p-5">Details</th>
                  <th className="p-4 sm:p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm font-bold text-slate-700">
                {filtered.map(s => (
                  <tr key={s.student_id || s.id} className="group hover:bg-slate-50/20 transition-colors">
                    <td className="p-4 sm:p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-sm uppercase group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300 shrink-0">
                          {s.full_name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <p className="text-base font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors duration-300">{s.full_name}</p>
                          <p className="text-[10px] text-slate-455 font-bold uppercase tracking-wider mt-0.5 leading-none">{s.email || 'No email provided'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 sm:p-5">
                      <div className="text-xs text-slate-800 dark:text-slate-200 font-black leading-none">
                        {formatDate(s.created_at)}
                      </div>
                      {s.created_at && (
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1.5 leading-none">
                          Registered: {formatRelativeTime(s.created_at)}
                        </div>
                      )}
                    </td>
                    <td className="p-4 sm:p-5 text-center">
                      <span className={`inline-block px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest leading-none ${
                        s.semester && s.semester !== 'N/A' 
                          ? 'bg-purple-50 border border-purple-100 text-purple-600' 
                          : 'bg-slate-50 border border-slate-100 text-slate-400'
                      }`}>
                        {s.semester && s.semester !== 'N/A' ? `Sem ${s.semester}` : 'N/A'}
                      </span>
                    </td>
                    <td className="p-4 sm:p-5">
                      <div className="text-xs text-slate-850 dark:text-slate-200 font-black leading-none">
                        {s.birthday ? formatDate(s.birthday) : 'Not set'}
                      </div>
                    </td>
                    <td className="p-4 sm:p-5">
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate font-medium normal-case tracking-normal">
                        {s.more_detail || 'No details added'}
                      </p>
                    </td>
                    <td className="p-4 sm:p-5 text-right flex justify-end gap-2">
                      <button 
                        onClick={() => {
                          setEditingStudent(s)
                          setEditEmail(s.email || '')
                          setEditBirthday(s.birthday ? s.birthday.substring(0, 10) : '')
                          setEditMoreDetail(s.more_detail || '')
                          setEditSemester(s.semester && s.semester !== 'N/A' ? s.semester.toString() : '')
                          setIsEditModalOpen(true)
                        }}
                        className="w-10 h-10 inline-flex items-center justify-center bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 text-slate-400 hover:text-indigo-600 rounded-xl transition-all cursor-pointer active:scale-95"
                        title="Edit Student Details"
                      >
                        <Pencil size={16} />
                      </button>
                      <button 
                        onClick={() => deleteStudent(s.student_id || s.id)} 
                        className="w-10 h-10 inline-flex items-center justify-center bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-100 text-slate-350 hover:text-red-500 rounded-xl transition-all cursor-pointer active:scale-95"
                        title="Delete Student"
                      >
                        <UserMinus size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Stack View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filtered.map(s => (
              <div key={s.student_id || s.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-black text-xs uppercase shrink-0">
                    {s.full_name?.charAt(0) || 'S'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight truncate leading-tight">{s.full_name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1 leading-none truncate">{s.email || 'No email provided'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <div className="min-w-0">
                    <span className="block text-[8px] font-black text-slate-350 tracking-wider leading-none mb-1">Registered</span>
                    <span className="text-slate-700 block truncate">{formatDate(s.created_at)}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[8px] font-black text-slate-350 tracking-wider leading-none mb-1">Semester</span>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black ${
                      s.semester && s.semester !== 'N/A' 
                        ? 'bg-purple-50 border border-purple-100 text-purple-600' 
                        : 'bg-slate-100 border border-slate-200 text-slate-400'
                    }`}>
                      {s.semester && s.semester !== 'N/A' ? `Sem ${s.semester}` : 'N/A'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[8px] font-black text-slate-350 tracking-wider leading-none mb-1">Birthday</span>
                    <span className="text-slate-700 block truncate">{s.birthday ? formatDate(s.birthday) : 'Not set'}</span>
                  </div>
                  <div className="min-w-0 col-span-2">
                    <span className="block text-[8px] font-black text-slate-350 tracking-wider leading-none mb-1">Details</span>
                    <span className="text-slate-600 block truncate normal-case tracking-normal font-medium">{s.more_detail || 'No details added'}</span>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <button 
                    onClick={() => {
                      setEditingStudent(s)
                      setEditEmail(s.email || '')
                      setEditBirthday(s.birthday ? s.birthday.substring(0, 10) : '')
                      setEditMoreDetail(s.more_detail || '')
                      setEditSemester(s.semester && s.semester !== 'N/A' ? s.semester.toString() : '')
                      setIsEditModalOpen(true)
                    }}
                    className="flex-1 py-3 inline-flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 text-slate-500 hover:text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer active:scale-95"
                    title="Edit Student Details"
                  >
                    <Pencil size={12} /> Edit Profile
                  </button>
                  <button 
                    onClick={() => deleteStudent(s.student_id || s.id)} 
                    className="flex-1 py-3 inline-flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-100 text-slate-500 hover:text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer active:scale-95"
                    title="Delete Student"
                  >
                    <UserMinus size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Student Details Modal */}
      {isEditModalOpen && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 relative flex flex-col gap-6 animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-6 right-6 p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-350 hover:text-slate-600 dark:hover:text-slate-100 rounded-xl transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest">
                Student Profile Configuration
              </span>
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight mt-2 leading-none">
                Edit Student Details
              </h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest mt-1">
                Configure academic and personal details for student
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-900/50 p-4 rounded-2xl">
                <p className="text-[8px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest leading-none mb-1.5">Student Identity</p>
                <p className="text-slate-800 dark:text-slate-200 text-sm font-black uppercase tracking-tight">{editingStudent.full_name}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest leading-none block">
                  Student Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  placeholder="e.g. student@domain.com"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all duration-300"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest leading-none block">
                  Student Birthday
                </label>
                <input
                  type="date"
                  value={editBirthday}
                  onChange={e => setEditBirthday(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all duration-300"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest leading-none block">
                  Academic Semester
                </label>
                <select
                  value={editSemester}
                  onChange={e => setEditSemester(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-bold outline-none cursor-pointer focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all duration-300"
                >
                  <option value="">Unassigned (N/A)</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                    <option key={sem} value={sem}>
                      Semester {sem}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest leading-none block">
                  More Details
                </label>
                <textarea
                  value={editMoreDetail}
                  onChange={e => setEditMoreDetail(e.target.value)}
                  placeholder="Enter any additional student info or special notes..."
                  rows={3}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all duration-300 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 py-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStudentClass}
                className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-950/10 active:scale-95 transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save size={12} />
                <span>Save Profile</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Alert/Confirm Dialog Modal */}
      {alertConfig.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 relative flex flex-col gap-6 animate-in zoom-in-95 duration-300 font-sans">
            <div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                alertConfig.type === 'error' 
                  ? 'bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-450'
                  : alertConfig.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 text-amber-600 dark:text-amber-450'
                    : 'bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400'
              }`}>
                {alertConfig.type === 'error' ? 'System Alert' : alertConfig.type === 'warning' ? 'User Confirmation' : 'Notification'}
              </span>
              <h3 className="text-xl font-black text-slate-850 dark:text-white uppercase tracking-tight mt-2 leading-none">
                {alertConfig.title}
              </h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-450 mt-3 leading-relaxed">
                {alertConfig.message}
              </p>
            </div>

            <div className="flex gap-3">
              {alertConfig.isConfirm ? (
                <>
                  <button
                    onClick={alertConfig.onCancel}
                    className="flex-1 py-3.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-350 rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={alertConfig.onConfirm}
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
                  onClick={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
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