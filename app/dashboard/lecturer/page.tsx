'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { BookOpen, Clock, LogOut, Loader2, Sparkles, ArrowRight, RefreshCw, Settings, User, Mail, KeyRound } from 'lucide-react'
import ThemeToggle from '@/app/components/ThemeToggle'
import NotificationBell from '@/app/components/NotificationBell'
import AccountSwitcher from '@/app/components/AccountSwitcher'

// Helper function to format time (e.g., 08:00 -> 8:00 AM)
const formatTime = (time: string) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const formattedH = h % 12 || 12;
  return `${formattedH}:${minutes} ${ampm}`;
};

export default function LecturerDashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()

  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsName, setSettingsName] = useState('')
  const [settingsEmail, setSettingsEmail] = useState('')
  const [settingsDrive, setSettingsDrive] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')

  const fetchData = useCallback(async (showFullLoader = false) => {
    if (showFullLoader) setLoading(true)
    else setIsSyncing(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/auth/login')

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      if (p) {
        setSettingsName(p.full_name || '')
        setSettingsEmail(user.email || '')
        setSettingsDrive(p.drive_folder_id || '')
      }

      // Querying the single source of truth: 'subjects' table
      const { data: s } = await supabase
        .from('subjects')
        .select('*')
        .contains('lecturer_names', [p.full_name])
      
      setSubjects(s || [])
    } catch (err) {
      console.error("Dashboard Load Error:", err)
    } finally {
      setLoading(false)
      setIsSyncing(false)
    }
  }, [router])

  const handleSaveProfileSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settingsName.trim() || !settingsEmail.trim() || !settingsDrive.trim()) {
      setSettingsMessage('❌ All fields are required.')
      return
    }
    setSettingsLoading(true)
    setSettingsMessage('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No session active.')

      // 1. Update Auth Email if changed
      if (settingsEmail.toLowerCase().trim() !== user.email?.toLowerCase().trim()) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: settingsEmail.trim() })
        if (emailErr) throw emailErr
        setSettingsMessage('ℹ️ Verification sent! Please check both email inboxes.')
      }

      // 2. Update Profiles Table
      const { error: profErr } = await supabase
        .from('profiles')
        .update({
          full_name: settingsName.trim(),
          drive_folder_id: settingsDrive.trim()
        })
        .eq('id', user.id)

      if (profErr) throw profErr

      setSettingsMessage('✅ Profile updated successfully!')
      fetchData(false)
      setTimeout(() => {
        setShowSettingsModal(false)
        setSettingsMessage('')
      }, 2000)
    } catch (e: any) {
      setSettingsMessage('❌ ' + (e.message || 'Update failed.'))
    } finally {
      setSettingsLoading(false)
    }
  }

  useEffect(() => { 
    fetchData(true) 
  }, [fetchData])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-indigo-600 mb-2" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Lecturer Dashboard...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans select-none animate-in fade-in duration-300">
      {/* Sticky top header bar */}
      <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-xs">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-[10px] uppercase tracking-widest text-slate-850 dark:text-slate-100">
              Lecturer Portal Console
            </span>
          </div>
          <div className="flex items-center gap-3">
            <AccountSwitcher />
            <NotificationBell />
            <ThemeToggle />
            <button 
              onClick={() => setShowSettingsModal(true)} 
              className="p-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl shadow-md active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer flex items-center justify-center"
              title="Profile Settings"
            >
              <Settings size={20} />
            </button>
            <button 
              onClick={() => fetchData(false)} 
              disabled={isSyncing}
              className="p-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl shadow-md active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer flex items-center justify-center"
              title="Refresh Data"
            >
              <RefreshCw size={20} className={isSyncing ? "animate-spin text-indigo-400" : ""} />
            </button>
            <button 
              onClick={handleLogout} 
              className="flex items-center gap-2 px-5 py-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-red-500/30 text-slate-700 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 rounded-2xl shadow-md active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer text-xs font-black uppercase tracking-widest"
              title="Sign Out"
            >
              <LogOut size={14} /> Sign Out
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
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Active Lecturing Matrix</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Manage attendance logs & subject materials</p>
          </div>
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

              {/* Google Drive Folder ID field */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound size={14} className="text-indigo-500" /> Google Drive Folder ID
                </label>
                <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 p-3.5 rounded-2xl">
                  <p className="text-[8.5px] font-black uppercase text-indigo-700 dark:text-indigo-350 tracking-wider">Sharing Instructions</p>
                  <p className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400/90 leading-normal mt-1">
                    Your personal Drive folder must remain shared with Editor permissions to our service email: 
                    <span className="block font-black select-all mt-1 bg-white dark:bg-slate-950 p-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/60 break-all">student-portal-uploader@primal-duality-496907-a8.iam.gserviceaccount.com</span>
                  </p>
                </div>
                <input
                  type="text"
                  required
                  value={settingsDrive}
                  onChange={e => setSettingsDrive(e.target.value.trim())}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100/50 dark:border-slate-905/30 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-800 dark:text-slate-200"
                  placeholder="Google Drive Folder ID"
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
    </div>
  )
}