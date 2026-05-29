'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Plus, RefreshCw, Loader2, BookOpen, GraduationCap } from 'lucide-react'
import ThemeToggle from '@/app/components/ThemeToggle'

import ContentCard from './components/ContentCard'
import ContentModal from './components/ContentModal'
import StudentTab from './components/StudentTab'
import SettingsTab from './components/SettingsTab'
import AttendanceTab from './components/AttendanceTab'

export default function SubjectDetail() {
  const params = useParams()
  const router = useRouter()
  const subjectId = params?.id as string 

  const [subject, setSubject] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'curriculum' | 'students' | 'attendance' | 'settings'>('curriculum')
  const [assignments, setAssignments] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null) // State for Editing

  const fetchSubjectData = useCallback(async () => {
    if (!subjectId) return
    setLoading(true)
    
    try {
      // 1. Fetch Subject, Assignments, Materials, AND Submissions
      const [subRes, assignmentsRes, materialsRes, submissionsRes] = await Promise.all([
        supabase.from('subjects').select('*').eq('id', subjectId).single(),
        supabase.from('assignments').select('*').eq('class_id', subjectId).order('created_at', { ascending: false }),
        supabase.from('materials').select('*').eq('class_id', subjectId).order('created_at', { ascending: false }),
        supabase.from('submissions').select('assignment_name').eq('class_id', subjectId) // Get submissions to count
      ])

      // 2. Handle Student Roster Logic
      const { data: membership } = await supabase
        .from('student_classes')
        .select('student_id') 
        .eq('subject_id', subjectId)

      if (membership && membership.length > 0) {
        const studentIds = membership.map(m => m.student_id)
        const [profRes, studRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name').in('id', studentIds),
          supabase.from('students').select('id, email').in('id', studentIds)
        ])

        const resolvedProfiles = profRes.data || []
        const resolvedStudents = studRes.data || []

        const finalRoster = membership.map(m => {
          const p = resolvedProfiles.find(x => x.id === m.student_id)
          const s = resolvedStudents.find(x => x.id === m.student_id)
          return {
            student_id: m.student_id, 
            full_name: p?.full_name || "Unknown Student",
            email: s?.email || "No Email"
          }
        })
        setStudents(finalRoster)
      } else {
        setStudents([])
      }

      setSubject(subRes.data)

      // 3. Map Submission Counts to Assignments
      const enrichedAssignments = (assignmentsRes.data || []).map(asg => ({
        ...asg,
        turnedInCount: submissionsRes.data?.filter(s => s.assignment_name === asg.title).length || 0
      }))

      setAssignments(enrichedAssignments)
      setMaterials(materialsRes.data || [])

    } catch (err: any) {
      console.error("CRITICAL SYNC FAILURE:", err.message)
    } finally {
      setLoading(false)
    }
  }, [subjectId])

  useEffect(() => {
    fetchSubjectData()
  }, [fetchSubjectData])

  if (loading && !subject) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-indigo-600 mb-2" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Classroom Data...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20 font-sans select-none animate-in fade-in duration-300">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 md:px-12 py-8">
        
        {/* Header Section */}
        <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <button 
              onClick={() => router.push('/dashboard/teacher')} 
              className="flex items-center gap-2 text-slate-400 hover:text-slate-800 font-black text-[10px] uppercase tracking-widest transition duration-300 cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to dashboard
            </button>
            <h1 className="text-3xl font-black tracking-tight text-slate-800 uppercase leading-none mt-4 flex items-center gap-3">
              <GraduationCap className="text-indigo-600 shrink-0" size={28} />
              {subject?.name || 'Classroom'}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                Room {subject?.room || 'N/A'}
              </span>
              <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                Sem {subject?.semester || 'N/A'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button 
              onClick={fetchSubjectData} 
              disabled={loading}
              className="p-3.5 bg-white border border-slate-100 hover:border-slate-200 text-slate-400 hover:text-indigo-600 rounded-2xl shadow-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center"
            >
              <RefreshCw size={18} className={loading ? "animate-spin text-indigo-600" : ""} />
            </button>
          </div>
        </header>

        {/* Tab Navigation Pill Bar */}
        <nav className="flex w-full bg-white p-1 rounded-2xl border border-slate-100 shadow-sm mb-10 overflow-x-auto custom-scrollbar whitespace-nowrap">
          {['curriculum', 'students', 'attendance', 'settings'].map((t) => (
            <button 
              key={t} 
              onClick={() => setActiveTab(t as any)} 
              className={`shrink-0 flex-1 sm:flex-none py-3 px-4 sm:px-6 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all cursor-pointer ${
                activeTab === t 
                  ? 'bg-slate-900 text-white shadow' 
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>

        {/* Tab Contents */}
        {activeTab === 'curriculum' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <button 
              onClick={() => setShowItemModal(true)} 
              className="bg-indigo-600 text-white px-6 py-4 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/10 active:scale-95 transition-all duration-300 cursor-pointer"
            >
              <Plus size={14} /> Create Curriculum Log
            </button>
            
            <div className="grid gap-4">
              {[...assignments, ...materials].map((item: any) => (
                <ContentCard 
                  key={item.id} 
                  item={item} 
                  isAssignment={assignments.some(a => a.id === item.id)} 
                  onRefresh={fetchSubjectData} 
                  studentCount={students.length}
                  onEdit={() => setEditingItem(item)} 
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
            <StudentTab 
              students={students} 
              classId={subjectId} 
              onRefresh={fetchSubjectData} 
            />
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
            <AttendanceTab 
              classId={subjectId} 
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
            <SettingsTab 
              subject={subject} 
              onRefresh={fetchSubjectData} 
            />
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showItemModal && (
        <ContentModal 
          classId={subjectId} 
          subjectName={subject?.name} 
          onClose={() => setShowItemModal(false)} 
          onRefresh={fetchSubjectData} 
        />
      )}

      {/* EDIT MODAL */}
      {editingItem && (
        <ContentModal 
          classId={subjectId} 
          subjectName={subject?.name} 
          initialData={editingItem} 
          onClose={() => setEditingItem(null)} 
          onRefresh={fetchSubjectData} 
        />
      )}
    </div>
  )
}