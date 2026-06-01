'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, nukeSession } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { BookOpen, Clock, LogOut, Loader2, Sparkles, ArrowRight, RefreshCw, Settings, User, Mail, KeyRound, HelpCircle, X, Smartphone, Share, PlusSquare, Lock } from 'lucide-react'
import ThemeToggle from '@/app/components/ThemeToggle'
import NotificationBell from '@/app/components/NotificationBell'
import AccountSwitcher from '@/app/components/AccountSwitcher'
import { useUpload } from '@/app/components/UploadContext'

// Helper function to format time (e.g., 08:00 -> 8:00 AM)
const formatTime = (time: string) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const formattedH = h % 12 || 12;
  return `${formattedH}:${minutes} ${ampm}`;
};

const extractFolderId = (input: string) => {
  if (!input) return '';
  let trimmed = input.trim();
  
  // Match typical google drive folder urls
  const foldersMatch = trimmed.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (foldersMatch && foldersMatch[1]) {
    trimmed = foldersMatch[1];
  } else {
    // Match open id urls
    const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (idMatch && idMatch[1]) {
      trimmed = idMatch[1];
    }
  }
  
  // Sanitize to only keep valid Google Drive ID characters (alphanumeric, hyphens, underscores)
  return trimmed.replace(/[^a-zA-Z0-9-_]/g, '');
}

export default function LecturerDashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()
  const { triggerHardReload, isReloading } = useUpload()

  useEffect(() => {
    // Check URL parameters for Drive connection status
    const params = new URLSearchParams(window.location.search)
    const driveConnected = params.get('drive_connected')
    const driveError = params.get('error')

    if (driveConnected === 'true') {
      setSettingsMessage('✅ Google Drive connected successfully! Your coursework files are now hosted on your own personal Drive.')
      setShowSettingsModal(true)
      router.replace('/dashboard/lecturer')
    } else if (driveConnected === 'false') {
      setSettingsMessage(`❌ Drive connection failed: ${driveError || 'Unknown error'}`)
      setShowSettingsModal(true)
      router.replace('/dashboard/lecturer')
    }
  }, [router])

  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsName, setSettingsName] = useState('')
  const [settingsEmail, setSettingsEmail] = useState('')
  const [settingsDrive, setSettingsDrive] = useState('')
  const [settingsPassword, setSettingsPassword] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')

  // Create Subject modal states
  const [showCreateSubjectModal, setShowCreateSubjectModal] = useState(false)
  const [newSubjName, setNewSubjName] = useState('')
  const [newSubjSemester, setNewSubjSemester] = useState('1')
  const [newSubjRoom, setNewSubjRoom] = useState('')
  const [newSubjStartDate, setNewSubjStartDate] = useState(new Date().toISOString().split('T')[0])
  const [newSubjStartTime, setNewSubjStartTime] = useState('08:00')
  const [newSubjEndTime, setNewSubjEndTime] = useState('11:30')
  const [createSubjLoading, setCreateSubjLoading] = useState(false)
  const [createSubjMessage, setCreateSubjMessage] = useState('')

  const fetchData = useCallback(async (showFullLoader = false) => {
    if (showFullLoader) setLoading(true)
    else setIsSyncing(true)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return router.push('/auth/login')

      const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (pErr || !p) {
        await supabase.auth.signOut()
        router.push('/auth/login')
        return
      }
      setProfile(p)
      if (p) {
        setSettingsName(p.full_name || '')
        setSettingsEmail(user.email || '')
        setSettingsDrive(p.drive_folder_id || '')
      }

      const { data: s } = await supabase
        .from('subjects')
        .select('*')
        .contains('lecturer_names', [p.full_name?.trim()])
      
      setSubjects(s || [])
    } catch (err) {
      console.error("Dashboard Load Error:", err)
    } finally {
      setLoading(false)
      setIsSyncing(false)
    }
  }, [router])

  const handleAutoCreateDriveFolder = async () => {
    if (!settingsName.trim() || !settingsEmail.trim()) {
      setSettingsMessage('❌ Name and Email are required to auto-create folder.')
      return
    }
    setSettingsLoading(true)
    setSettingsMessage('⚡ Creating & sharing Google Drive folder...')
    try {
      const res = await fetch('/api/drive/setup-lecturer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lecturerName: settingsName, lecturerEmail: settingsEmail })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to auto-create folder')
      }
      setSettingsDrive(data.folderId)
      setSettingsMessage('✅ Folder created and shared successfully! Save Settings to apply.')
    } catch (err: any) {
      setSettingsMessage('❌ ' + (err.message || 'Folder setup failed.'))
    } finally {
      setSettingsLoading(false)
    }
  }

  const handleConnectGoogleDrive = () => {
    if (!profile?.id) return
    window.location.href = `/api/auth/google?userId=${profile.id}`
  }

  const handleDisconnectGoogleDrive = async () => {
    if (!profile?.id) return
    setSettingsLoading(true)
    setSettingsMessage('⚡ Disconnecting Google Drive...')
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          google_refresh_token: null,
          drive_folder_id: null
        })
        .eq('id', profile.id)

      if (error) throw error
      setSettingsDrive('')
      setSettingsMessage('✅ Google Drive successfully disconnected.')
      fetchData(false)
    } catch (err: any) {
      setSettingsMessage('❌ Disconnection failed: ' + (err.message || err))
    } finally {
      setSettingsLoading(false)
    }
  }

  const handleSaveProfileSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settingsName.trim() || !settingsEmail.trim()) {
      setSettingsMessage('❌ Name and Email are required.')
      return
    }
    setSettingsLoading(true)
    setSettingsMessage('')
    try {
      // If drive folder is empty, auto-create it now
      let finalDriveId = settingsDrive.trim();
      if (!finalDriveId) {
        setSettingsMessage('⚡ Auto-creating Google Drive folder...');
        const autoRes = await fetch('/api/drive/setup-lecturer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lecturerName: settingsName, lecturerEmail: settingsEmail })
        });
        const autoData = await autoRes.json();
        if (!autoRes.ok || autoData.error) {
          throw new Error(autoData.error || 'Failed to auto-create folder');
        }
        finalDriveId = autoData.folderId;
        setSettingsDrive(finalDriveId);
      }

      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) throw new Error('No session active.')

      // 1. Update Auth Email if changed
      let emailChanged = false
      if (settingsEmail.toLowerCase().trim() !== user.email?.toLowerCase().trim()) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: settingsEmail.trim() })
        if (emailErr) throw emailErr
        emailChanged = true
      }

      // If email changed and folder exists, share it with the new email
      if (emailChanged && finalDriveId) {
        try {
          await fetch('/api/drive/setup-lecturer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lecturerName: settingsName, lecturerEmail: settingsEmail, folderId: finalDriveId })
          });
        } catch (e) {
          console.warn("Failed to share folder with new email:", e);
        }
      }

      // 2. Update Auth Password if typed
      if (settingsPassword.trim()) {
        if (settingsPassword.trim().length < 6) {
          throw new Error('Password must be at least 6 characters long.')
        }
        const { error: passErr } = await supabase.auth.updateUser({ password: settingsPassword.trim() })
        if (passErr) throw passErr
      }

      // 3. Update Profiles Table
      let isMissingEmailCol = false
      const { error: profErr } = await supabase
        .from('profiles')
        .update({
          full_name: settingsName.trim(),
          email: settingsEmail.toLowerCase().trim(),
          drive_folder_id: finalDriveId
        })
        .eq('id', user.id)

      if (profErr) {
        const isEmailErr = profErr.code === '42703' || 
                           profErr.message?.toLowerCase().includes("email") ||
                           profErr.message?.toLowerCase().includes("schema cache")
        if (isEmailErr) {
          isMissingEmailCol = true
          const { error: retryErr } = await supabase
            .from('profiles')
            .update({
              full_name: settingsName.trim(),
              drive_folder_id: extractFolderId(settingsDrive)
            })
            .eq('id', user.id)
          if (retryErr) throw retryErr
        } else {
          throw profErr
        }
      }

      if (isMissingEmailCol) {
        setSettingsMessage('⚠️ Saved! Please run the Supabase migration in database.sql to add the missing "email" column.')
      } else {
        setSettingsMessage(emailChanged ? '✅ Profile updated! Verification email sent to both inboxes.' : '✅ Profile updated successfully!')
      }
      
      fetchData(false)
      setTimeout(() => {
        setShowSettingsModal(false)
        setSettingsPassword('')
        setSettingsMessage('')
      }, emailChanged || isMissingEmailCol ? 4000 : 2000)
    } catch (e: any) {
      setSettingsMessage('❌ ' + (e.message || 'Update failed.'))
    } finally {
      setSettingsLoading(false)
    }
  }

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubjName.trim() || !newSubjSemester || !newSubjRoom.trim()) {
      setCreateSubjMessage('❌ Subject Name, Semester, and Room are required.')
      return
    }
    setCreateSubjLoading(true)
    setCreateSubjMessage('')
    try {
      if (!profile) {
        throw new Error('Lecturer profile not loaded.')
      }

      // Generate the lecturer names array (including name and email if available)
      const lecturerNamesArray = [
        profile.full_name?.trim(),
        profile.email?.trim() ? `email:${profile.email.trim()}` : null
      ].filter(Boolean)

      // 1. Insert into 'subjects' table
      const { data: insertedSubject, error: subjectError } = await supabase
        .from('subjects')
        .insert({
          name: newSubjName.trim(),
          room: newSubjRoom.trim(),
          semester: parseInt(newSubjSemester),
          start_date: newSubjStartDate || null,
          class_start_time: newSubjStartTime ? `${newSubjStartTime}:00` : null,
          class_end_time: newSubjEndTime ? `${newSubjEndTime}:00` : null,
          lecturer_names: lecturerNamesArray
        })
        .select()
        .single()

      if (subjectError) throw subjectError
      if (!insertedSubject) throw new Error('Failed to create subject record.')

      // 2. Insert corresponding record into 'classes' table
      const { error: classError } = await supabase
        .from('classes')
        .insert({
          id: insertedSubject.id,
          name: newSubjName.trim(),
          subject_name: newSubjName.trim(),
          semester: parseInt(newSubjSemester),
          room: newSubjRoom.trim(),
          start_time: newSubjStartTime ? `${newSubjStartTime}:00` : '08:00:00',
          end_time: newSubjEndTime ? `${newSubjEndTime}:00` : '11:30:00',
          class_date: newSubjStartDate || new Date().toISOString().split('T')[0],
          teacher_id: profile.id,
          lecture_name: profile.full_name
        })

      if (classError) throw classError

      // 3. Notify admins of the new subject
      try {
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin')

        if (adminProfiles && adminProfiles.length > 0) {
          const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
          const adminNotifs = adminProfiles.map(adm => ({
            user_id: adm.id,
            title: "New Subject Created",
            message: `Lecturer ${profile.full_name} created subject "${newSubjName.trim()}" at ${currentTime}.`,
            type: "approval",
            link: "/admin/subjects"
          }))
          await supabase.from('notifications').insert(adminNotifs)
        }
      } catch (notifErr) {
        console.error('Error creating notifications:', notifErr)
      }

      setCreateSubjMessage('✅ Subject created successfully!')
      
      // Refresh dashboard list
      fetchData(false)
      
      // Clear inputs
      setNewSubjName('')
      setNewSubjRoom('')
      setNewSubjSemester('1')
      setNewSubjStartDate(new Date().toISOString().split('T')[0])
      setNewSubjStartTime('08:00')
      setNewSubjEndTime('11:30')

      setTimeout(() => {
        setShowCreateSubjectModal(false)
        setCreateSubjMessage('')
      }, 2000)
    } catch (err: any) {
      setCreateSubjMessage('❌ ' + (err.message || 'Creation failed.'))
    } finally {
      setCreateSubjLoading(false)
    }
  }

  useEffect(() => { 
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(true) 
  }, [fetchData])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    nukeSession()
    window.location.replace('/auth/login')
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-indigo-600 mb-2" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Lecturer Dashboard...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans select-none animate-in fade-in duration-300 overflow-x-hidden">
      {/* Sticky top header bar */}
      <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-xs">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 md:px-12 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-[10px] uppercase tracking-widest text-slate-850 dark:text-slate-100">
              <span className="hidden sm:inline">Lecturer Portal Console</span>
              <span className="sm:hidden">Lecturer Portal</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <AccountSwitcher />
            <NotificationBell />
            <ThemeToggle />
            <button 
              onClick={() => setShowSettingsModal(true)} 
              className="p-2 sm:p-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl shadow-md active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer flex items-center justify-center"
              title="Profile Settings"
            >
              <Settings size={18} className="sm:w-5 sm:h-5" />
            </button>
            <button 
              onClick={triggerHardReload} 
              className="p-2 sm:p-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl shadow-md active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer flex items-center justify-center"
              title="Hard Reload Page"
            >
              <RefreshCw size={18} className={`sm:w-5 sm:h-5 ${isReloading ? "animate-spin text-indigo-500" : ""}`} />
            </button>
            <button 
              onClick={handleLogout} 
              className="flex items-center gap-1.5 sm:gap-2 p-2 sm:px-5 sm:py-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-red-500/30 text-slate-700 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 rounded-2xl shadow-md active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer text-xs font-black uppercase tracking-widest"
              title="Sign Out"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-8 md:p-12 flex-1 w-full max-w-[1600px] mx-auto">
        
        {/* Modern radial gradient heading block */}
        <div className="relative z-30 bg-gradient-to-br from-slate-900 via-[#10142d] to-slate-900 rounded-[2.5rem] p-8 md:p-12 mb-12 shadow-xl shadow-slate-900/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          {/* Absolute Background Wrapper to safely clip the glow blobs without clipping dropdowns */}
          <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[-30%] right-[-10%] w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-[-30%] left-[-10%] w-[250px] h-[250px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
          </div>
          
          <div className="relative z-10 space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest">
              <Sparkles size={10} /> Lecturer Session Active
            </span>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase leading-none mt-2">
              Lecturer Portal
            </h1>
            <p className="text-slate-400 text-sm font-bold">
              Welcome back, <span className="text-indigo-400">{profile?.full_name || 'Lecturer'}</span>
            </p>
          </div>
        </div>

        {/* Section Title */}
        <div className="mb-6 flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Active Lecturing Matrix</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Manage attendance logs & subject materials</p>
          </div>
          <button
            onClick={() => setShowCreateSubjectModal(true)}
            className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-md hover:shadow-indigo-500/10 cursor-pointer"
          >
            <PlusSquare size={14} /> Create Subject
          </button>
        </div>

        {/* Subjects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {subjects.map((s) => (
            <div 
              key={s.id} 
              className="group bg-white p-8 rounded-[2.5rem] border border-slate-100/80 shadow-sm hover:shadow-xl hover:shadow-indigo-950/5 hover:-translate-y-1 hover:border-indigo-200 transition-all duration-300 flex flex-col justify-between min-h-[240px]"
            >
              <div>
                <span className="inline-block px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest mb-4">
                  Semester {s.semester} Track
                </span>
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors duration-300">{s.name}</h2>
                
                <div className="flex flex-wrap gap-4 mt-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                    <BookOpen size={12} className="text-indigo-500"/> Room: {s.room}
                  </span>
                  <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                    <Clock size={12} className="text-indigo-500"/> 
                    {s.class_start_time ? formatTime(s.class_start_time) : 'N/A'} 
                    {s.class_end_time ? ` - ${formatTime(s.class_end_time)}` : ''}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => router.push(`/dashboard/lecturer/${s.id}`)}
                className="w-full mt-8 bg-slate-900 group-hover:bg-indigo-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md hover:shadow-lg hover:shadow-indigo-500/10 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>View Classroom</span>
                <ArrowRight size={12} />
              </button>
            </div>
          ))}
          
          {subjects.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
              <BookOpen size={48} className="mx-auto text-slate-200 mb-4 animate-pulse" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No assigned academic matrix courses located.</p>
            </div>
          )}
        </div>
      </div>

      {/* Profile Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[999] p-4">
          <form 
            onSubmit={handleSaveProfileSettings}
            className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-[2.5rem] p-8 md:p-10 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Profile Settings</h2>
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-1">Update your lecturer credentials</p>
              </div>
              <button 
                type="button"
                onClick={() => { setShowSettingsModal(false); setSettingsMessage(''); }}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-300 transition-colors font-black text-[10px] uppercase tracking-widest cursor-pointer bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl"
              >
                Close
              </button>
            </div>

            <div className="space-y-5">
              {/* Full Name field */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={14} className="text-indigo-500" /> Full Name
                </label>
                <input
                  type="text"
                  required
                  value={settingsName}
                  onChange={e => setSettingsName(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100/50 dark:border-slate-905/30 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-800 dark:text-slate-200"
                  placeholder="Lecturer Full Name"
                />
              </div>

              {/* Email field */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail size={14} className="text-indigo-500" /> Email Address
                </label>
                <input
                  type="email"
                  required
                  value={settingsEmail}
                  onChange={e => setSettingsEmail(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100/50 dark:border-slate-905/30 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-800 dark:text-slate-200"
                  placeholder="lecturer@university.edu"
                />
              </div>


              {/* Google Drive Connection Card */}
              <div className="space-y-3 p-5 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-slate-100 dark:border-slate-900/60 shadow-xs">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    🔌 Google Drive Integration
                  </label>
                  {profile?.google_refresh_token ? (
                    <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/45 px-2 py-0.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 uppercase tracking-wider">
                      Connected
                    </span>
                  ) : (
                    <span className="text-[8px] font-black text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/45 px-2 py-0.5 rounded-lg border border-amber-100 dark:border-amber-900/40 uppercase tracking-wider">
                      Not Connected
                    </span>
                  )}
                </div>
                
                <p className="text-[9.5px] font-medium text-slate-550 dark:text-slate-400/90 leading-relaxed">
                  {profile?.google_refresh_token 
                    ? 'Connected to your personal Google Drive! Coursework files and student submissions will go directly to your personal Drive folder with zero manual sharing.'
                    : 'Link your personal or work Google Drive account to automatically create and host all subject folders and student submissions on your own Drive.'
                  }
                </p>

                {profile?.email && profile?.google_refresh_token && (
                  <div className="text-[8.5px] font-mono text-indigo-600 dark:text-indigo-300 select-all bg-indigo-50/50 dark:bg-indigo-950/20 p-2.5 rounded-xl border border-indigo-100/50 dark:border-indigo-900/40 break-all leading-tight font-bold">
                    Connected Drive Account: {profile.email}
                  </div>
                )}

                <div className="pt-1.5">
                  {profile?.google_refresh_token ? (
                    <button
                      type="button"
                      onClick={handleDisconnectGoogleDrive}
                      className="w-full text-center bg-red-50 hover:bg-red-100/70 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-650 dark:text-red-400 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition border border-red-100 dark:border-red-900/40 cursor-pointer"
                    >
                      Disconnect Account
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectGoogleDrive}
                      className="w-full text-center bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition shadow-md shadow-indigo-500/10 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      ⚡ Connect Google Drive
                    </button>
                  )}
                </div>
              </div>

              {/* New Password field (Optional) */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock size={14} className="text-indigo-500" /> New Password (Optional)
                </label>
                <input
                  type="password"
                  value={settingsPassword}
                  onChange={e => setSettingsPassword(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100/50 dark:border-slate-905/30 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-800 dark:text-slate-200"
                  placeholder="•••••••• (Leave blank to keep current)"
                />
              </div>
            </div>

            {settingsMessage && (
              <p className={`mt-6 text-center text-xs font-black py-3 px-4 rounded-xl leading-tight uppercase tracking-wide border ${
                settingsMessage.includes('✅') 
                  ? 'text-emerald-550 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/60' 
                  : settingsMessage.includes('ℹ️')
                    ? 'text-blue-550 dark:text-blue-450 bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/60'
                    : 'text-red-550 dark:text-red-450 bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/60'
              }`}>
                {settingsMessage}
              </p>
            )}

            <div className="pt-6 border-t border-slate-50 dark:border-slate-900 mt-6 flex justify-end">
              <button
                type="submit"
                disabled={settingsLoading}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-md shadow-indigo-500/10 cursor-pointer"
              >
                {settingsLoading ? (
                  <><Loader2 className="animate-spin" size={14} /> Saving...</>
                ) : (
                  'Save Settings'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Subject Modal */}
      {showCreateSubjectModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[999] p-4">
          <form 
            onSubmit={handleCreateSubject}
            className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-[2.5rem] p-8 md:p-10 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Create Subject</h2>
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-1">Add a new subject to the lecturing matrix</p>
              </div>
              <button 
                type="button"
                onClick={() => { setShowCreateSubjectModal(false); setCreateSubjMessage(''); }}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-300 transition-colors font-black text-[10px] uppercase tracking-widest cursor-pointer bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl"
              >
                Close
              </button>
            </div>

            <div className="space-y-5">
              {/* Subject Name */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen size={14} className="text-indigo-500" /> Subject Name
                </label>
                <input
                  type="text"
                  required
                  value={newSubjName}
                  onChange={e => setNewSubjName(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100/50 dark:border-slate-905/30 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-800 dark:text-slate-200"
                  placeholder="e.g. Advanced Web Programming"
                />
              </div>

              {/* Semester & Room Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    Semester
                  </label>
                  <select
                    value={newSubjSemester}
                    onChange={e => setNewSubjSemester(e.target.value)}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100/50 dark:border-slate-905/30 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-800 dark:text-slate-200"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                      <option key={sem} value={sem.toString()}>Sem {sem}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    Room
                  </label>
                  <input
                    type="text"
                    required
                    value={newSubjRoom}
                    onChange={e => setNewSubjRoom(e.target.value)}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100/50 dark:border-slate-905/30 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-800 dark:text-slate-200"
                    placeholder="e.g. 601"
                  />
                </div>
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={newSubjStartDate}
                  onChange={e => setNewSubjStartDate(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100/50 dark:border-slate-905/30 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Start Time & End Time Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={newSubjStartTime}
                    onChange={e => setNewSubjStartTime(e.target.value)}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100/50 dark:border-slate-905/30 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={newSubjEndTime}
                    onChange={e => setNewSubjEndTime(e.target.value)}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100/50 dark:border-slate-905/30 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            {createSubjMessage && (
              <p className={`mt-6 text-center text-xs font-black py-3 px-4 rounded-xl leading-tight uppercase tracking-wide border ${
                createSubjMessage.includes('✅') 
                  ? 'text-emerald-550 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/60' 
                  : 'text-red-550 dark:text-red-450 bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/60'
              }`}>
                {createSubjMessage}
              </p>
            )}

            <div className="pt-6 border-t border-slate-50 dark:border-slate-900 mt-6 flex justify-end">
              <button
                type="submit"
                disabled={createSubjLoading}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-md shadow-indigo-500/10 cursor-pointer"
              >
                {createSubjLoading ? (
                  <><Loader2 className="animate-spin" size={14} /> Creating...</>
                ) : (
                  'Create Subject'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}