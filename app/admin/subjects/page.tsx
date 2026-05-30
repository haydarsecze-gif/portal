'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Plus, Trash2, X, Check, Calendar, Clock, BookOpen, Pencil, Users, UserCheck, Save, HelpCircle, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Sparkles, ShieldAlert, ArrowRight } from 'lucide-react'

// Institutional attendance status mapping matching requirements
const ATTENDANCE_STATUSES = [
  { code: '--', label: 'Unmarked', className: 'bg-slate-50 text-slate-400' },
  { code: 'P', label: 'Present', className: 'bg-emerald-50 text-emerald-700 font-black border border-emerald-200' },
  { code: 'X', label: 'Not Present (Absent)', className: 'bg-red-50 text-red-600 font-black border border-red-200' },
  { code: 'L', label: 'Late', className: 'bg-amber-50 text-amber-700 font-black border border-amber-200' },
  { code: 'M', label: 'Medical (MC)', className: 'bg-blue-50 text-blue-700 font-black border border-blue-200' },
  { code: 'V', label: 'Valid Reasons', className: 'bg-purple-50 text-purple-700 font-black border border-purple-200' },
  { code: 'H', label: 'Holiday / Break', className: 'bg-indigo-50 text-indigo-700 font-black border border-indigo-200' },
  { code: 'N', label: 'Not Applicable', className: 'bg-slate-100 text-slate-500 font-black border border-slate-300' }
]

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function AdminCurriculum() {
  const [subjects, setSubjects] = useState<any[]>([])
  const [allTeachers, setAllTeachers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Attendance Sheet Matrix States
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false)
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false) 
  const [isEditable, setIsEditable] = useState(false) 
  const [selectedSubject, setSelectedSubject] = useState<any>(null)
  const [activeRoster, setActiveRoster] = useState<any[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [isSavingAttendance, setIsSavingAttendance] = useState(false)

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

  // Local state changes staging buffer cache
  const [pendingChanges, setPendingChanges] = useState<{ [key: string]: string }>({})
  // Visibility toggle: when true, changes are hidden from student view
  const [hideFromStudent, setHideFromStudent] = useState(false)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  // Toast notification system
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Subject Modification states
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [room, setRoom] = useState('')
  const [semester, setSemester] = useState('1')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [selectedLecturers, setSelectedLecturers] = useState<string[]>([])
  const [teacherSearch, setTeacherSearch] = useState('')

  useEffect(() => { fetchSubjects(); }, [])

  useEffect(() => {
    const fetchTeachers = async () => {
      let query = supabase.from('profiles').select('full_name').eq('role', 'teacher').eq('is_approved', true)
      if (teacherSearch) query = query.ilike('full_name', `%${teacherSearch}%`)
      const { data } = await query.limit(50)
      setAllTeachers(data || [])
    }
    fetchTeachers()
  }, [teacherSearch])

  const fetchSubjects = async () => {
    setLoading(true)
    const { data: subjectData, error: subError } = await supabase
      .from('subjects')
      .select('*')
      .order('semester', { ascending: true })

    if (subError) {
      console.error("Error fetching subjects:", subError)
      setLoading(false)
      return
    }

    const { data: countData, error: countError } = await supabase.from('student_classes').select('subject_id')
    if (countError) console.error("Error calculating sizes:", countError)

    const formatted = subjectData?.map(sub => ({
      ...sub,
      student_count: countData?.filter(item => item.subject_id === sub.id).length || 0
    }))

    setSubjects(formatted || [])
    setLoading(false)
  }

  const refreshRosterData = async (subject: any) => {
    setLoadingRoster(true)
    try {
      const { data: mappings, error: mapErr } = await supabase
        .from('student_classes')
        .select('student_id')
        .eq('subject_id', subject.id)

      if (mapErr) throw mapErr

      if (!mappings || mappings.length === 0) {
        setActiveRoster([])
        setLoadingRoster(false)
        return
      }

      const studentIds = mappings.map(m => m.student_id)

      const [profRes, studRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', studentIds),
        supabase.from('students').select('id, email').in('id', studentIds)
      ])

      if (profRes.error) throw profRes.error
      const resolvedProfiles = profRes.data || []
      const resolvedStudents = studRes.data || []

      const { data: attendanceRecords, error: attErr } = await supabase
        .from('attendance')
        .select('student_id, week, status')
        .eq('class_id', subject.id)

      if (attErr) throw attErr

      const structuredMatrix = resolvedProfiles.map(p => {
        const s = resolvedStudents.find(x => x.id === p.id)
        const weeksMap: { [key: number]: string } = {}
        for (let w = 1; w <= 17; w++) { weeksMap[w] = '--' }
        
        attendanceRecords?.forEach(record => {
          if (record.student_id === p.id) {
            weeksMap[record.week] = record.status || '--'
          }
        })

        return {
          id: p.id,
          name: p.full_name || 'Enrolled Student',
          email: s?.email || 'N/A',
          weeks: weeksMap
        }
      })

      setActiveRoster(structuredMatrix)
    } catch (err) {
      console.error("Critical matrix data load error:", err)
      setActiveRoster([])
    } finally {
      setLoadingRoster(false)
    }
  }

  const openRosterSheet = async (subject: any) => {
    setSelectedSubject(subject)
    setIsRosterModalOpen(true)
    setIsEditable(false) 
    setPendingChanges({})
    setHideFromStudent(false)
    setShowSaveConfirm(false)
    await refreshRosterData(subject)
  }

  const handleLocalCellEdit = (studentId: string, weekNumber: number, newStatus: string) => {
    const changeKey = `${studentId}-${weekNumber}`
    setPendingChanges(prev => ({
      ...prev,
      [changeKey]: newStatus
    }))

    setActiveRoster(prev => prev.map(student => {
      if (student.id === studentId) {
        return {
          ...student,
          weeks: { ...student.weeks, [weekNumber]: newStatus }
        }
      }
      return student
    }))
  }

  const handleBatchSaveAttendance = async () => {
    setShowSaveConfirm(false)
    if (!selectedSubject || Object.keys(pendingChanges).length === 0) {
      setIsEditable(false)
      return
    }

    if (!uuidRegex.test(selectedSubject.id)) {
      setAlertConfig({
        isOpen: true,
        title: "Schema Protection",
        message: `Schema Protection Blocked: The subject identifier "${selectedSubject.id}" is an invalid UUID format.`,
        type: "error"
      })
      return;
    }

    setIsSavingAttendance(true)
    try {
      const upsertRows: any[] = []
      const deleteRows: { student_id: string; week: number }[] = []

      for (const [key, status] of Object.entries(pendingChanges)) {
        const lastDash = key.lastIndexOf('-')
        const studentId = key.substring(0, lastDash)
        const weekNumber = parseInt(key.substring(lastDash + 1))

        if (!uuidRegex.test(studentId)) continue

        if (status === '--') {
          deleteRows.push({ student_id: studentId, week: weekNumber })
        } else {
          upsertRows.push({
            class_id: selectedSubject.id,
            student_id: studentId,
            week: weekNumber,
            status: status,
            hidden_from_student: hideFromStudent
          })
        }
      }

      if (upsertRows.length > 0) {
        const { error: upsertError } = await supabase
          .from('attendance')
          .upsert(upsertRows, { onConflict: 'class_id,student_id,week' })
          
        if (upsertError) {
          console.error("Supabase Upsert Raw Error Log:", upsertError);
          throw new Error(`[Upsert Failed] ${upsertError.message}`);
        }
      }

      for (const row of deleteRows) {
        const { error: deleteError } = await supabase
          .from('attendance')
          .delete()
          .eq('class_id', selectedSubject.id)
          .eq('student_id', row.student_id)
          .eq('week', row.week)

        if (deleteError) {
          console.error("Supabase Delete Raw Error Log:", deleteError);
          throw new Error(`[Delete Failed] ${deleteError.message}`);
        }
      }

      setPendingChanges({})
      setIsEditable(false)
      setHideFromStudent(false)
      await refreshRosterData(selectedSubject)
      await fetchSubjects() 
      
      setNotification({
        message: hideFromStudent
          ? "Attendance saved! Changes are visible to admins & lecturers only — students will see their original check-in status."
          : "Attendance changes successfully saved! Students can now see the updated status.",
        type: 'success'
      })

    } catch (err: any) {
      console.error("Critical Failure inside Save Tracker:", err)
      setNotification({
        message: "Failed to save changes: " + err.message,
        type: 'error'
      })
    } finally {
      setIsSavingAttendance(false)
    }
  }

  const openCreateModal = () => {
    setEditingId(null); setName(''); setRoom(''); setSemester('1'); setStartDate(''); setStartTime(''); setEndTime(''); setSelectedLecturers([]); setIsModalOpen(true);
  }

  const openEditModal = (subject: any) => {
    setEditingId(subject.id); setName(subject.name || ''); setRoom(subject.room || ''); setSemester(String(subject.semester || '1')); setStartDate(subject.start_date || ''); setStartTime(subject.class_start_time || ''); setEndTime(subject.class_end_time || ''); setSelectedLecturers(subject.lecturer_names || []); setIsModalOpen(true);
  }

  const handleDeleteSubject = async (s: any) => {
    setAlertConfig({
      isOpen: true,
      title: "Delete Subject",
      message: `Are you sure you want to permanently delete subject completely from the system: "${s.name}"?`,
      type: "warning",
      isConfirm: true,
      onConfirm: async () => {
        setAlertConfig(prev => ({ ...prev, isOpen: false }))
        try {
          // 1. Delete dependent submissions
          const { error: subErr } = await supabase.from('submissions').delete().eq('class_id', s.id)
          if (subErr) throw subErr

          // 2. Delete dependent assignments
          const { error: assignErr } = await supabase.from('assignments').delete().eq('class_id', s.id)
          if (assignErr) throw assignErr

          // Delete dependent materials
          const { error: matErr } = await supabase.from('materials').delete().eq('class_id', s.id)
          if (matErr) throw matErr

          // 3. Delete dependent attendance records
          const { error: attErr } = await supabase.from('attendance').delete().eq('class_id', s.id)
          if (attErr) throw attErr

          // 4. Delete student enrollments
          const { error: scErr } = await supabase.from('student_classes').delete().eq('subject_id', s.id)
          if (scErr) throw scErr

          // 5. Delete matching class
          const { error: clsErr } = await supabase.from('classes').delete().eq('id', s.id)
          if (clsErr) throw clsErr

          // 6. Finally, delete the subject itself
          const { error } = await supabase.from('subjects').delete().eq('id', s.id)
          if (error) throw error

          try {
            let adminName = "Administrator"
            const { data: { user: adminUser } } = await supabase.auth.getUser()
            if (adminUser) {
              const { data: prof } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', adminUser.id)
                .single()
              if (prof?.full_name) adminName = prof.full_name
            }

            const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

            // Notify all admins
            const { data: adminProfiles } = await supabase
              .from('profiles')
              .select('id')
              .eq('role', 'admin')

            if (adminProfiles && adminProfiles.length > 0) {
              const adminNotifs = adminProfiles.map(adm => ({
                user_id: adm.id,
                title: "Subject Class Deleted",
                message: `${adminName} deleted subject class "${s.name}" at ${currentTime}.`,
                type: "approval",
                link: "/admin/subjects"
              }))
              await supabase.from('notifications').insert(adminNotifs)
            }
          } catch (err) {
            console.error("Error creating deletion notification:", err)
          }
          fetchSubjects()
        } catch (err: any) {
          setAlertConfig({
            isOpen: true,
            title: "Deletion Failed",
            message: "Failed to delete subject: " + err.message,
            type: "error"
          })
        }
      },
      onCancel: () => {
        setAlertConfig(prev => ({ ...prev, isOpen: false }))
      }
    })
  }

  const handleSaveSubject = async () => {
    if (!name || !semester) {
      setAlertConfig({
        isOpen: true,
        title: "Required Fields",
        message: "Please fill in the Subject Name and Semester!",
        type: "warning"
      })
      return
    }
    const payload = { name, room, semester: parseInt(semester), start_date: startDate || null, class_start_time: startTime || null, class_end_time: endTime || null, lecturer_names: selectedLecturers }
    try {
      let activeSubjectId = editingId
      if (editingId) {
        await supabase.from('subjects').update(payload).eq('id', editingId)
        await supabase.from('classes').update({
          name: name,
          subject_name: name,
          semester: parseInt(semester),
          room: room || 'Unassigned',
          start_time: startTime || '08:00:00',
          end_time: endTime || '11:30:00',
          class_date: startDate || new Date().toISOString().split('T')[0]
        }).eq('id', editingId)
      } else {
        const { data: insertedData, error: insertError } = await supabase.from('subjects').insert([payload]).select().single()
        if (insertError) throw insertError
        if (insertedData) {
          activeSubjectId = insertedData.id
          await supabase.from('classes').insert({
            id: insertedData.id,
            name: name,
            subject_name: name,
            semester: parseInt(semester),
            room: room || 'Unassigned',
            start_time: startTime || '08:00:00',
            end_time: endTime || '11:30:00',
            class_date: startDate || new Date().toISOString().split('T')[0]
          })
        }
      }

      // Dispatch audit and lecturer assignment notifications
      try {
        let adminName = "Administrator"
        const { data: { user: adminUser } } = await supabase.auth.getUser()
        if (adminUser) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', adminUser.id)
            .single()
          if (prof?.full_name) adminName = prof.full_name
        }

        const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

        // Notify assigned lecturers
        if (selectedLecturers && selectedLecturers.length > 0) {
          const { data: lecturerProfiles } = await supabase
            .from('profiles')
            .select('id')
            .in('full_name', selectedLecturers)

          if (lecturerProfiles && lecturerProfiles.length > 0) {
            const lecturerNotifs = lecturerProfiles.map(lec => ({
              user_id: lec.id,
              title: editingId ? "Subject Assignment Updated" : "Assigned to New Subject",
              message: `${adminName} assigned/updated your role to teach subject "${name}" at ${currentTime}.`,
              type: "approval",
              link: `/dashboard/lecturer/${activeSubjectId}`
            }))
            await supabase.from('notifications').insert(lecturerNotifs)
          }
        }

        // Notify all admins
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin')

        if (adminProfiles && adminProfiles.length > 0) {
          const adminNotifs = adminProfiles.map(adm => ({
            user_id: adm.id,
            title: editingId ? "Subject Class Updated" : "Subject Class Created",
            message: `${adminName} ${editingId ? 'updated' : 'created'} subject class "${name}" (assigned to: ${selectedLecturers.join(', ') || 'none'}) at ${currentTime}.`,
            type: "approval",
            link: "/admin/subjects"
          }))
          await supabase.from('notifications').insert(adminNotifs)
        }
      } catch (notifErr) {
        console.error("Error creating subject notifications:", notifErr)
      }

      setIsModalOpen(false); fetchSubjects()
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: "Save Failed",
        message: "Failed to save: " + err.message,
        type: "error"
      })
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-300">
      <Loader2 className="animate-spin mb-2" size={32} />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Curriculum...</p>
    </div>
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-350 font-sans select-none">
      
      {/* Header section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Curriculum Management</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure subjects, classrooms & rosters</p>
        </div>
        <button 
          onClick={openCreateModal} 
          className="w-full lg:w-auto bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/10 active:scale-95 transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
        >
          <Plus size={14} /> Add New Subject
        </button>
      </div>

      {/* Search matrix */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center group">
        <Search className="text-slate-300 ml-2 group-focus-within:text-indigo-500 transition-colors" size={18} />
        <input 
          placeholder="Search active subjects..." 
          className="w-full p-2 bg-transparent outline-none font-bold text-sm text-slate-700 placeholder:text-slate-300" 
          onChange={(e) => setSearch(e.target.value)} 
        />
      </div>

      {/* Subject rows listing */}
      <div className="grid gap-4">
        {subjects.filter(s => s.name?.toLowerCase().includes(search.toLowerCase())).map((s) => (
          <div 
            key={s.id} 
            className="group bg-white p-6 rounded-[2.5rem] border border-slate-100 hover:border-indigo-100 shadow-xs hover:shadow-xl hover:shadow-indigo-950/2 transition-all duration-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center w-full">
              <div className="bg-slate-900 group-hover:bg-indigo-600 text-white w-16 h-16 rounded-[2rem] flex flex-col items-center justify-center font-black transition-colors duration-300 shrink-0 select-none">
                <span className="text-[8px] opacity-75 tracking-wider font-mono">SEM</span>
                <span className="text-lg leading-none mt-0.5">{s.semester}</span>
              </div>
              
              <div className="space-y-1.5 w-full">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight leading-none group-hover:text-indigo-600 transition-colors duration-300">{s.name}</h3>
                  <button 
                    onClick={() => openRosterSheet(s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-100/50 text-[9px] font-black tracking-wider uppercase transition-all shadow-xs cursor-pointer shrink-0"
                  >
                    <Users size={11} />
                    {s.student_count} Enrolled Roster
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-4 mt-2 text-[10px] font-bold text-slate-405 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><BookOpen size={12} className="text-indigo-500" /> Room: {s.room}</span>
                  <span className="flex items-center gap-1.5"><Calendar size={12} className="text-indigo-500" /> Start: {s.start_date || 'No Date'}</span>
                  <span className="flex items-center gap-1.5"><Clock size={12} className="text-indigo-500" /> Timing: {s.class_start_time || '--'} - {s.class_end_time || '--'}</span>
                </div>
                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-wider">Lecturers: {s.lecturer_names?.join(', ') || 'Faculty Unassigned'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end md:justify-start border-t border-slate-50 md:border-none pt-4 md:pt-0">
              <button 
                onClick={() => openEditModal(s)} 
                className="p-3 text-slate-450 hover:text-slate-800 hover:bg-slate-50 rounded-2xl active:scale-95 transition-all cursor-pointer"
              >
                <Pencil size={16} />
              </button>
              <button 
                onClick={() => handleDeleteSubject(s)} 
                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl active:scale-95 transition-all cursor-pointer"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ROSTER SHEET GRID POPUP */}
      {isRosterModalOpen && selectedSubject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-[99] animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-7xl h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            
            {/* Roster Header */}
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black tracking-widest uppercase text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 leading-none">
                    Sem {selectedSubject.semester} Registry
                  </span>
                  <button 
                    onClick={() => setIsHelpModalOpen(true)}
                    className="text-slate-400 hover:text-indigo-600 p-0.5 rounded-full transition-colors cursor-pointer"
                    title="Legend Legend Abbreviations Guide"
                  >
                    <HelpCircle size={16} />
                  </button>
                </div>
                <h2 className="font-black text-2xl text-slate-800 uppercase tracking-tight mt-3 leading-none">{selectedSubject.name} Attendance Matrix</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                  {isEditable ? "⚠️ EDIT MODE ENABLED: Dropdown matrix cells unlocked for entry overrides." : "🔒 READ ONLY VIEW: Unlock editor below to make cell updates."}
                </p>
              </div>
              <button 
                onClick={() => { setIsRosterModalOpen(false); fetchSubjects(); }} 
                className="p-3 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-2xl active:scale-95 transition-all cursor-pointer"
              >
                <X size={22} />
              </button>
            </div>

            {/* Roster Workspace grid */}
            <div className="flex-1 overflow-auto p-8 custom-scrollbar bg-slate-50/30">
              {loadingRoster ? (
                <div className="h-full flex items-center justify-center flex-col gap-2 text-slate-400">
                  <Loader2 className="animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Assembling attendance log registry...</p>
                </div>
              ) : activeRoster.length > 0 ? (
                <div className="inline-block min-w-full align-middle border border-slate-150 rounded-[2rem] overflow-hidden shadow-sm bg-white">
                  <table className="min-w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-900 text-[9px] font-black tracking-widest text-white uppercase divide-x divide-slate-800 select-none">
                        <th className="p-4 w-32 min-w-[120px] sm:min-w-[240px] sticky left-0 bg-slate-900 z-20">Student Profile</th>
                        {[...Array(17)].map((_, idx) => (
                          <th key={idx} className="p-3 text-center min-w-[90px]">Week {idx + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-xs font-bold divide-y divide-slate-100 bg-white">
                      {activeRoster.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50/40 transition-colors divide-x divide-slate-100 group">
                          <td className="p-4 font-black text-slate-850 uppercase tracking-tight sticky left-0 bg-white shadow-[3px_0_10px_rgba(0,0,0,0.02)] z-10 w-32 min-w-[120px] sm:min-w-[240px] max-w-[120px] sm:max-w-none">
                            <div className="group-hover:text-indigo-600 transition-colors truncate">{student.name}</div>
                            <div className="hidden sm:block text-[9px] font-bold text-slate-400 normal-case tracking-normal mt-0.5 leading-none truncate">{student.email}</div>
                          </td>

                          {[...Array(17)].map((_, idx) => {
                            const wNumber = idx + 1
                            const status = student.weeks[wNumber]
                            const currentStyle = ATTENDANCE_STATUSES.find(opt => opt.code === status)?.className || 'bg-slate-50 text-slate-400'

                            return (
                              <td key={wNumber} className="p-1.5 text-center">
                                <select
                                  disabled={!isEditable} 
                                  value={status}
                                  onChange={(e) => handleLocalCellEdit(student.id, wNumber, e.target.value)}
                                  className={`w-[70px] h-[34px] px-1 rounded-xl text-[10px] font-black text-center transition-all outline-none border border-transparent ${
                                    isEditable ? 'cursor-pointer focus:border-slate-350 focus:ring-4 focus:ring-slate-100' : 'cursor-not-allowed opacity-90'
                                  } ${currentStyle}`}
                                >
                                  {ATTENDANCE_STATUSES.map(opt => (
                                    <option key={opt.code} value={opt.code} className="bg-white text-slate-800 font-black">
                                      {opt.code} ({opt.label})
                                    </option>
                                  ))}
                                </select>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-white">
                  <ShieldAlert className="mx-auto text-slate-200 mb-3" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No student enrollment logs assigned yet.</p>
                </div>
              )}
            </div>

            {/* Roster Footer Options */}
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <div>
                {!isEditable && (
                  <button 
                    type="button"
                    onClick={() => setIsEditable(true)}
                    className="flex items-center gap-1.5 bg-slate-900 text-white px-5 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <Pencil size={12} /> Unlock Edit Mode
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  type="button" 
                  onClick={() => { setIsRosterModalOpen(false); fetchSubjects(); }} 
                  className="px-6 py-3.5 border border-slate-200 hover:border-slate-300 text-slate-500 hover:bg-slate-50 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Close Matrix
                </button>
                <button 
                  type="button"
                  disabled={isSavingAttendance || !isEditable || Object.keys(pendingChanges).length === 0}
                  onClick={() => setShowSaveConfirm(true)}
                  className="flex items-center gap-2 bg-indigo-600 disabled:bg-slate-100 text-white disabled:text-slate-400 px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Save size={13} />
                  {isSavingAttendance ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SAVE CONFIRM POPUP with visibility toggle */}
      {showSaveConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[999] animate-in fade-in duration-150">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                  <Save size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none">Commit Attendance</h2>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Select portal visibility</p>
                </div>
              </div>

              {/* Visibility toggler */}
              <button
                type="button"
                onClick={() => setHideFromStudent(prev => !prev)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all mb-6 text-left cursor-pointer ${
                  hideFromStudent
                    ? 'border-amber-300 bg-amber-50/50'
                    : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  hideFromStudent ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-400'
                }`}>
                  {hideFromStudent ? <EyeOff size={18} /> : <Eye size={18} />}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black text-slate-850 uppercase tracking-tight">
                    Without update in the student portal
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 mt-1.5 normal-case tracking-normal leading-relaxed">
                    {hideFromStudent
                      ? 'Changes will be saved for admins & lecturers only. Students will see their original check-in status.'
                      : 'Changes will immediately update and be visible to students in their portal.'
                    }
                  </p>
                </div>
                <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  hideFromStudent ? 'border-amber-400 bg-amber-400' : 'border-slate-200 bg-white'
                }`}>
                  {hideFromStudent && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowSaveConfirm(false); setHideFromStudent(false); }}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-2xl font-black text-[10px] uppercase tracking-widest cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBatchSaveAttendance}
                  disabled={isSavingAttendance}
                  className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-755 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/10 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  {isSavingAttendance ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABBREVIATIONS GUIDE POPUP */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[999] animate-in fade-in duration-150">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 p-6 text-center text-white font-black text-base uppercase tracking-widest">
              Attendance System Key Legend
            </div>
            <div className="p-6 bg-white space-y-4">
              <div className="space-y-3 text-xs text-slate-800 font-bold max-h-96 overflow-y-auto custom-scrollbar pr-2 leading-relaxed">
                <div className="flex gap-4 p-2 rounded-xl hover:bg-slate-50"><span className="w-8 font-black text-slate-900 text-sm shrink-0">H</span> <p><span className="font-black uppercase tracking-wider block text-[10px] text-slate-400 mb-0.5">Holiday</span> public holidays or structural breaks.</p></div>
                <div className="flex gap-4 p-2 rounded-xl hover:bg-slate-50"><span className="w-8 font-black text-slate-900 text-sm shrink-0">L</span> <p><span className="font-black uppercase tracking-wider block text-[10px] text-slate-400 mb-0.5">Late</span> delayed entrance to lecturing room.</p></div>
                <div className="flex gap-4 p-2 rounded-xl hover:bg-slate-50"><span className="w-8 font-black text-slate-900 text-sm shrink-0">M</span> <p><span className="font-black uppercase tracking-wider block text-[10px] text-slate-400 mb-0.5">Medical</span> verified MC leave.</p></div>
                <div className="flex gap-4 p-2 rounded-xl hover:bg-slate-50"><span className="w-8 font-black text-slate-900 text-sm shrink-0">N</span> <p><span className="font-black uppercase tracking-wider block text-[10px] text-slate-400 mb-0.5">Not Applicable</span> week slot with no lecturing classes.</p></div>
                <div className="flex gap-4 p-2 rounded-xl hover:bg-slate-50"><span className="w-8 font-black text-slate-900 text-sm shrink-0">P</span> <p><span className="font-black uppercase tracking-wider block text-[10px] text-slate-400 mb-0.5">Present</span> prompt attendance log.</p></div>
                <div className="flex gap-4 p-2 rounded-xl hover:bg-slate-50"><span className="w-8 font-black text-slate-900 text-sm shrink-0">V</span> <p><span className="font-black uppercase tracking-wider block text-[10px] text-slate-400 mb-0.5">Valid Reasons</span> official administrative exemptions.</p></div>
                <div className="flex gap-4 p-2 rounded-xl hover:bg-slate-50"><span className="w-8 font-black text-slate-900 text-sm shrink-0">X</span> <p><span className="font-black uppercase tracking-wider block text-[10px] text-slate-400 mb-0.5">Absent</span> non-verified missed class log.</p></div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setIsHelpModalOpen(false)} 
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-colors cursor-pointer"
                >
                  Close Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC SUBJECT REGISTRATION POPUP */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[999] animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-[3rem] w-full max-w-xl shadow-2xl relative border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-850 cursor-pointer"><X size={24} /></button>
            <h2 className="font-black mb-8 uppercase text-xl text-slate-800 tracking-tight leading-none">
              {editingId ? 'Modify Subject Details' : 'Register New Subject'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <input value={name} placeholder="Subject Name" className="col-span-2 p-4.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500/50 focus:bg-white transition-colors" onChange={(e) => setName(e.target.value)} />
              <input value={room} placeholder="Room / Location" className="p-4.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500/50 focus:bg-white transition-colors" onChange={(e) => setRoom(e.target.value)} />
              <select value={semester} className="p-4.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500/50 focus:bg-white transition-colors cursor-pointer" onChange={(e) => setSemester(e.target.value)}>
                {[...Array(8)].map((_, i) => <option key={i} value={i+1} className="bg-white text-slate-800 font-bold">Semester {i+1}</option>)}
              </select>
              <input type="date" value={startDate} className="p-4.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500/50 focus:bg-white transition-colors" onChange={(e) => setStartDate(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input type="time" value={startTime} className="p-4.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500/50 focus:bg-white transition-colors" onChange={(e) => setStartTime(e.target.value)} />
                <input type="time" value={endTime} className="p-4.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500/50 focus:bg-white transition-colors" onChange={(e) => setEndTime(e.target.value)} />
              </div>
              <div className="col-span-2 mt-2">
                <input placeholder="Search lecturing faculty..." className="w-full p-4 bg-slate-100 rounded-2xl text-xs font-bold mb-3 outline-none focus:border-indigo-500 focus:bg-white" onChange={(e) => setTeacherSearch(e.target.value)} />
                <div className="max-h-32 overflow-y-auto grid grid-cols-2 gap-2 custom-scrollbar p-1">
                  {allTeachers.map((t) => (
                    <button key={t.full_name} onClick={() => setSelectedLecturers(prev => prev.includes(t.full_name) ? prev.filter(n => n !== t.full_name) : [...prev, t.full_name])} className={`p-3 rounded-xl text-[9px] font-black uppercase tracking-wider flex justify-between items-center transition-all cursor-pointer border ${selectedLecturers.includes(t.full_name) ? 'bg-slate-900 border-slate-950 text-white' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                      <span>{t.full_name}</span>
                      {selectedLecturers.includes(t.full_name) && <Check size={12} strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleSaveSubject} className="col-span-2 bg-indigo-600 hover:bg-indigo-755 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest mt-6 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-95 transition-all duration-300 cursor-pointer">{editingId ? 'Update Subject Info' : 'Save Subject Registry'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Confirmation/Alert Modal */}
      {alertConfig.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                alertConfig.type === 'warning' ? 'bg-amber-50 text-amber-500' :
                alertConfig.type === 'error' ? 'bg-red-50 text-red-500' :
                alertConfig.type === 'success' ? 'bg-emerald-50 text-emerald-500' :
                'bg-blue-50 text-blue-500'
              }`}>
                {alertConfig.type === 'warning' ? <ShieldAlert size={28} /> :
                 alertConfig.type === 'error' ? <AlertCircle size={28} /> :
                 alertConfig.type === 'success' ? <CheckCircle2 size={28} /> :
                 <BookOpen size={28} />}
              </div>
              
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{alertConfig.title}</h3>
                <p className="text-xs font-bold text-slate-500 mt-2 leading-relaxed">{alertConfig.message}</p>
              </div>

              <div className="flex gap-3 w-full mt-4">
                {alertConfig.isConfirm ? (
                  <>
                    <button 
                      onClick={() => {
                        if (alertConfig.onCancel) alertConfig.onCancel();
                        else setAlertConfig(prev => ({ ...prev, isOpen: false }));
                      }}
                      className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all cursor-pointer border border-slate-100"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => {
                        if (alertConfig.onConfirm) alertConfig.onConfirm();
                      }}
                      className={`flex-1 py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all cursor-pointer shadow-lg ${
                        alertConfig.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/10' :
                        alertConfig.type === 'error' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/10' :
                        'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/10'
                      }`}
                    >
                      Confirm
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => {
                      if (alertConfig.onConfirm) alertConfig.onConfirm();
                      else setAlertConfig(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all cursor-pointer"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern custom notification toast overlay */}
      {notification && (
        <div className="fixed bottom-8 right-8 z-[10000] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`backdrop-blur-md border px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 max-w-md ${
            notification.type === 'error'
              ? 'bg-red-955/95 border-red-800 text-white'
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
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}