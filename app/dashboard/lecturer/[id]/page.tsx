'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Plus, RefreshCw, Loader2, BookOpen, GraduationCap, FileText, Check } from 'lucide-react'
import ThemeToggle from '@/app/components/ThemeToggle'
import NotificationBell from '@/app/components/NotificationBell'
import AccountSwitcher from '@/app/components/AccountSwitcher'

import ContentCard from './components/ContentCard'
import ContentModal from './components/ContentModal'
import StudentTab from './components/StudentTab'
import SettingsTab from './components/SettingsTab'
import AttendanceTab from './components/AttendanceTab'

const parseSafeDate = (dateStr?: string) => {
  if (!dateStr) return null
  try {
    const safeStr = dateStr.includes(' ') && !dateStr.includes('T')
      ? dateStr.replace(' ', 'T')
      : dateStr
    const d = new Date(safeStr)
    if (isNaN(d.getTime())) return null
    return d
  } catch (e) {
    return null
  }
}

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
  const [uploadProgress, setUploadProgress] = useState<{ [tempId: string]: { title: string; type: 'assignment' | 'material'; progress: number; status: 'uploading' | 'success' | 'failed'; error?: string } }>({});
  const [selectId, setSelectId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      const sid = searchParams.get('select') || searchParams.get('assignment') || searchParams.get('material')
      if (sid) setSelectId(sid)
    }
  }, [])

  const startCourseworkUpload = async (formData: any, files: File[], type: 'assignment' | 'material', initialData?: any) => {
    const tempId = initialData?.id || Date.now().toString();
    const assignmentTitle = formData.title;

    // Initialize progress tracking state
    setUploadProgress(prev => ({
      ...prev,
      [tempId]: { title: assignmentTitle, type, progress: 0, status: 'uploading' }
    }));

    // Start background execution
    (async () => {
      try {
        const links: string[] = []
        let capturedFolderId = initialData?.folder_id || null

        if (files.length > 0) {
          // 1. Fetch OAuth2 access token and root folder ID
          const tokenRes = await fetch('/api/drive/token')
          const tokenData = await tokenRes.json()
          if (!tokenRes.ok || tokenData.error) {
            throw new Error(tokenData.error || 'Failed to retrieve Google Drive upload session.')
          }
          const { accessToken, parentFolderId } = tokenData

          // Query the lecturer's own drive folder ID if defined
          let targetParentId = parentFolderId
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('drive_folder_id')
              .eq('id', user.id)
              .single()
            if (prof?.drive_folder_id) {
              targetParentId = prof.drive_folder_id
            }
          }

          // A. Search/Create the Subject/Class Folder inside targetParentId dynamically
          let subjectFolderId = null
          try {
            const searchQ = `mimeType = 'application/vnd.google-apps.folder' and name = '${subject?.name?.replace(/'/g, "\\'")}' and '${targetParentId}' in parents and trashed = false`
            const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQ)}&fields=files(id,name)`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            })
            if (searchRes.ok) {
              const searchData = await searchRes.json()
              if (searchData.files && searchData.files.length > 0) {
                subjectFolderId = searchData.files[0].id
              }
            }
          } catch (e) {
            console.warn("Failed to search for subject folder, will attempt to create:", e)
          }

          if (!subjectFolderId) {
            try {
              // Create the Subject/Class Folder
              const createSubRes = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  name: subject?.name?.trim(),
                  mimeType: 'application/vnd.google-apps.folder',
                  parents: [targetParentId]
                })
              })
              if (createSubRes.ok) {
                const subFolderData = await createSubRes.json()
                subjectFolderId = subFolderData.id

                // Grant anyone reader permission to the subject folder so students can access assignments/materials inside
                await fetch(`https://www.googleapis.com/drive/v3/files/${subjectFolderId}/permissions`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    role: 'reader',
                    type: 'anyone'
                  })
                })
              }
            } catch (e) {
              console.error("Error creating subject folder:", e)
            }
          }

          if (subjectFolderId) {
            targetParentId = subjectFolderId
          }

          // 2. Create coursework folder if it doesn't exist yet
          if (!capturedFolderId) {
            const folderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                name: `${type}: ${formData.title.trim()}`,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [targetParentId]
              })
            })

            if (!folderRes.ok) {
              const errText = await folderRes.text()
              throw new Error(`Failed to create coursework folder in Google Drive: ${errText}`)
            }

            const folderData = await folderRes.json()
            capturedFolderId = folderData.id
          }

          // 3. Upload attached files with progress tracking!
          const totalSize = files.reduce((sum, f) => sum + f.size, 0)
          let totalUploaded = 0

          for (const f of files) {
            const metadata = {
              name: f.name,
              parents: [capturedFolderId]
            }

            const formDataPayload = new FormData()
            formDataPayload.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
            formDataPayload.append('file', f)

            const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`
              },
              body: formDataPayload
            })

            if (!uploadRes.ok) {
              const errText = await uploadRes.text()
              throw new Error(`File upload failed for "${f.name}": ${errText}`)
            }

            const uploadData = await uploadRes.json()
            const fileId = uploadData.id

            // Set anyone reader permission
            await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                role: 'reader',
                type: 'anyone'
              })
            })

            // Fetch webViewLink
            const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            })

            if (!metaRes.ok) {
              throw new Error("Failed to retrieve file web link from Google Drive.")
            }

            const metaData = await metaRes.json()
            links.push(metaData.webViewLink)

            totalUploaded += f.size
            const pct = Math.round((totalUploaded / totalSize) * 98)
            setUploadProgress(prev => ({
              ...prev,
              [tempId]: { ...prev[tempId], progress: pct }
            }))
          }
        }

        let dbError
        let insertedId = ""
        if (initialData) {
          // Update existing item
          const updatePayload: any = {
            title: formData.title,
            description: formData.description || null,
          }
          if (links.length > 0) {
            updatePayload.file_url = initialData.file_url
              ? `${initialData.file_url}, ${links.join(', ')}`
              : links.join(', ')
          }
          if (type === 'assignment') {
            updatePayload.deadline = new Date(formData.deadline).toISOString()
            updatePayload.allow_late = formData.allowLate
          }

          const { error } = await supabase
            .from(type === 'assignment' ? 'assignments' : 'materials')
            .update(updatePayload)
            .eq('id', initialData.id)
          dbError = error
        } else {
          // Insert new item
          const payload: any = {
            class_id: subjectId,
            title: formData.title,
            description: formData.description || null,
            file_url: links.join(', '),
            folder_id: capturedFolderId
          }

          if (type === 'assignment') {
            payload.deadline = new Date(formData.deadline).toISOString()
            payload.allow_late = formData.allowLate
          }

          const { data: insertedData, error } = await supabase
            .from(type === 'assignment' ? 'assignments' : 'materials')
            .insert([payload])
            .select()
            .single()
          
          dbError = error
          if (insertedData) {
            insertedId = insertedData.id
          }
        }

        if (dbError) throw dbError

        // Notify all students in this class if it's a new coursework item (not editing)
        if (!initialData) {
          try {
            const { data: mappings } = await supabase
              .from('student_classes')
              .select('student_id')
              .eq('subject_id', subjectId)

            if (mappings && mappings.length > 0) {
              const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
              
              // Resolve Lecturer Name
              let lecturerName = "Lecturer"
              const { data: { user } } = await supabase.auth.getUser()
              if (user) {
                const { data: prof } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('id', user.id)
                  .single()
                if (prof?.full_name) {
                  lecturerName = prof.full_name
                }
              }

              const formattedDeadline = type === 'assignment'
                ? new Date(formData.deadline).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                : ''

              const message = type === 'assignment'
                ? `${lecturerName} added a new assignment: "${formData.title}" in ${subject?.name || 'Classroom'} at ${currentTime}. Due: ${formattedDeadline}.`
                : `${lecturerName} added a new material: "${formData.title}" in ${subject?.name || 'Classroom'} at ${currentTime}.`

              const linkPath = `/dashboard/student/class/${subjectId}?select=${insertedId}`

              const notificationsToInsert = mappings.map(m => ({
                user_id: m.student_id,
                title: type === 'assignment' ? "New Assignment Added" : "New Material Added",
                message: message,
                type: type,
                link: linkPath
              }))

              await supabase.from('notifications').insert(notificationsToInsert)
            }
          } catch (err) {
            console.error("Error creating coursework notifications:", err)
          }
        }

        // Complete successfully
        setUploadProgress(prev => ({
          ...prev,
          [tempId]: { ...prev[tempId], progress: 100, status: 'success' }
        }))

        // Refresh dynamic list
        fetchSubjectData()

        // Clear successfully completed item after 5 seconds
        setTimeout(() => {
          setUploadProgress(prev => {
            const copy = { ...prev };
            delete copy[tempId];
            return copy;
          });
        }, 5000);

      } catch (err: any) {
        console.error("Lecturer coursework upload failed:", err)
        setUploadProgress(prev => ({
          ...prev,
          [tempId]: { ...prev[tempId], progress: 0, status: 'failed', error: err.message || 'Unknown network error.' }
        }))
      }
    })()
  }

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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans select-none animate-in fade-in duration-300">
      {/* Sticky top header bar */}
      <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-xs">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/dashboard/lecturer')} 
              className="flex items-center gap-2 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-black text-[9px] uppercase tracking-widest transition duration-300 cursor-pointer"
            >
              <ArrowLeft size={12} /> Back to dashboard
            </button>
          </div>
          <div className="flex items-center gap-3">
            <AccountSwitcher />
            <NotificationBell />
            <ThemeToggle />
            <button 
              onClick={fetchSubjectData} 
              disabled={loading}
              className="p-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl shadow-md active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer flex items-center justify-center"
              title="Refresh Data"
            >
              <RefreshCw size={20} className={loading ? "animate-spin text-indigo-600" : ""} />
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-8 md:p-12 flex-1 w-full max-w-[1600px] mx-auto">
        
        {/* Header Section */}
        <header className="mb-8 flex flex-col gap-4">
          {/* Subject Title and Badges */}
          <div className="flex flex-col gap-2 mt-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 uppercase leading-tight flex items-center gap-3">
              <GraduationCap className="text-indigo-600 shrink-0" size={24} />
              {subject?.name || 'Classroom'}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                Room {subject?.room || 'N/A'}
              </span>
              <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                Sem {subject?.semester || 'N/A'}
              </span>
            </div>
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
              {Object.entries(uploadProgress).map(([tempId, progressItem]) => (
                <div 
                  key={tempId}
                  className="bg-white p-6 rounded-[2.5rem] border border-dashed border-indigo-200 shadow-sm flex flex-col gap-4 animate-pulse"
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        {progressItem.type === 'assignment' ? <FileText size={22} /> : <BookOpen size={22} />}
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 text-base uppercase tracking-tight leading-tight">{progressItem.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[9px] font-black uppercase tracking-widest ${
                            progressItem.type === 'assignment' ? 'text-amber-500' : 'text-indigo-500'
                          }`}>
                            {progressItem.type}
                          </span>
                          <span className="text-slate-300 text-[9px] font-bold">•</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            Uploading files...
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-full border-t border-slate-50 pt-3.5">
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        progressItem.status === 'success' 
                          ? 'text-emerald-600' 
                          : progressItem.status === 'failed'
                            ? 'text-red-550'
                            : 'text-indigo-650'
                      }`}>
                        {progressItem.status === 'success' && '✅ Upload Successful! saving log...'}
                        {progressItem.status === 'failed' && `❌ Upload Failed: ${progressItem.error}`}
                        {progressItem.status === 'uploading' && `⚡ Background Uploading (${progressItem.progress}%)`}
                      </span>
                      {progressItem.status === 'failed' && (
                        <button 
                          onClick={() => setUploadProgress(prev => {
                            const copy = { ...prev };
                            delete copy[tempId];
                            return copy;
                          })}
                          className="text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-650 px-2 py-1 bg-slate-50 border border-slate-150 rounded-lg cursor-pointer"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          progressItem.status === 'success' 
                            ? 'bg-emerald-500' 
                            : progressItem.status === 'failed'
                              ? 'bg-red-500'
                              : 'bg-indigo-650 animate-pulse'
                        }`}
                        style={{ width: `${progressItem.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {[...assignments, ...materials]
                .sort((a, b) => {
                  const timeB = parseSafeDate(b.created_at)?.getTime() || 0
                  const timeA = parseSafeDate(a.created_at)?.getTime() || 0
                  return timeB - timeA
                })
                .map((item: any) => (
                  <ContentCard 
                    key={item.id} 
                    item={item} 
                    isAssignment={assignments.some(a => a.id === item.id)} 
                    onRefresh={fetchSubjectData} 
                    studentCount={students.length}
                    onEdit={() => setEditingItem(item)} 
                    autoExpanded={item.id === selectId || item.title === selectId}
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
          onStartUpload={(formData, files, type) => {
            setShowItemModal(false);
            startCourseworkUpload(formData, files, type);
          }}
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
          onStartUpload={(formData, files, type) => {
            const currentItem = editingItem;
            setEditingItem(null);
            startCourseworkUpload(formData, files, type, currentItem);
          }}
        />
      )}
    </div>
  )
}