'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BookOpen, Clock, User, LogOut, Loader2, ArrowRight, Sparkles, RefreshCw, Settings, Mail, Lock, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/app/components/ThemeToggle'
import NotificationBell from '@/app/components/NotificationBell'
import AccountSwitcher from '@/app/components/AccountSwitcher'

export default function StudentDashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [myClasses, setMyClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()

  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsName, setSettingsName] = useState('')
  const [settingsEmail, setSettingsEmail] = useState('')
  const [settingsPassword, setSettingsPassword] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')

  const loadDashboard = useCallback(async (showFullLoader = false) => {
    if (showFullLoader) setLoading(true)
    else setIsSyncing(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/auth/login')

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(prof)

      if (prof) {
        setSettingsName(prof.full_name || '')
        setSettingsEmail(user.email || '')
      }

      if (prof && prof.role === 'student') {
        const { data: existingStudent } = await supabase
          .from('students')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        if (!existingStudent) {
          await supabase.from('students').insert({
            id: user.id,
            name: prof.full_name,
            email: user.email,
            class_id: prof.class_id
          })
        }
      }

      const { data: enrollments, error } = await supabase
        .from('student_classes')
        .select(`
          subject_id,
          subjects (
            id,
            name,
            room,
            lecturer_names
          )
        `)
        .eq('student_id', user.id)

      if (error) throw error

      const classes = (enrollments || [])
        .map((e: any) => e.subjects)
        .filter(Boolean)
        
      setMyClasses(classes)
    } catch (err) {
      console.error("Dashboard Load Error:", err)
    } finally {
      setLoading(false)
      setIsSyncing(false)
    }
  }, [router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard(true)
  }, [loadDashboard])

  const handleSaveProfileSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settingsName.trim() || !settingsEmail.trim()) {
      setSettingsMessage('❌ All fields are required.')
      return
    }
    setSettingsLoading(true)
    setSettingsMessage('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No session active.')

      // 1. Update Auth Email if changed
      let emailChanged = false
      if (settingsEmail.toLowerCase().trim() !== user.email?.toLowerCase().trim()) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: settingsEmail.trim() })
        if (emailErr) throw emailErr
        emailChanged = true
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
          email: settingsEmail.toLowerCase().trim()
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
              full_name: settingsName.trim()
            })
            .eq('id', user.id)
          if (retryErr) throw retryErr
        } else {
          throw profErr
        }
      }

      // 4. Update Students Table
      const { error: studentErr } = await supabase
        .from('students')
        .update({
          name: settingsName.trim(),
          email: settingsEmail.toLowerCase().trim()
        })
        .eq('id', user.id)

      if (studentErr) {
        const isEmailErr = studentErr.code === '42703' || 
                           studentErr.message?.toLowerCase().includes("email")
        if (isEmailErr) {
          isMissingEmailCol = true
          const { error: retryErr } = await supabase
            .from('students')
            .update({
              name: settingsName.trim()
            })
            .eq('id', user.id)
          if (retryErr) throw retryErr
        } else {
          throw studentErr
        }
      }

      if (isMissingEmailCol) {
        setSettingsMessage('⚠️ Saved! Please run the Supabase migration in database.sql to add the missing "email" column.')
      } else {
        setSettingsMessage(emailChanged ? '✅ Profile updated! Verification email sent to both inboxes.' : '✅ Profile updated successfully!')
      }

      loadDashboard(false)
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-indigo-600 mb-2" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Student Dashboard...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg-portal flex flex-col font-sans select-none animate-in fade-in duration-300 text-text-title">
      {/* Sticky top header bar */}
      <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-xs">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-[10px] uppercase tracking-widest text-slate-850 dark:text-slate-100">
              Student Dashboard Console
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
              onClick={() => window.location.reload()} 
              className="p-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl shadow-md active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer flex items-center justify-center"
              title="Hard Reload Page"
            >
              <RefreshCw size={20} />
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
        
        {/* Modern radial gradient greeting block */}
        <div className="relative z-30 bg-gradient-to-br from-slate-900 via-[#10142d] to-slate-900 rounded-[2.5rem] p-8 md:p-12 mb-12 shadow-xl shadow-slate-900/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          {/* Absolute Background Wrapper to safely clip the glow blobs without clipping dropdowns */}
          <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[-30%] right-[-10%] w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-[-30%] left-[-10%] w-[250px] h-[250px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
          </div>
          
          <div className="relative z-10 space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest">
              <Sparkles size={10} /> Authorized Session Active
            </span>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase leading-none mt-2">
              Student Dashboard
            </h1>
            <p className="text-slate-400 text-sm font-bold">
              Welcome back, <span className="text-indigo-400">{profile?.full_name || 'Student'}</span>
            </p>
          </div>
        </div>

        {/* Section Title */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Enrolled Classrooms</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Explore active curriculum lists</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {myClasses.length > 0 ? (
            myClasses.map((cls) => (
              <div 
                key={cls.id} 
                onClick={() => router.push(`/dashboard/student/class/${cls.id}`)} 
                className="group bg-bg-card p-8 rounded-[2rem] border border-border-card shadow-sm hover:shadow-xl hover:shadow-indigo-950/5 hover:-translate-y-1 hover:border-indigo-200 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[220px]"
              >
                <div>
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                    <BookOpen size={20} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-tight group-hover:text-indigo-600 transition-colors duration-300 mb-3">{cls.name}</h3>
                  
                  <div className="flex flex-col gap-1.5 mt-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <Clock size={12} className="text-slate-300" /> Room {cls.room}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <User size={12} className="text-slate-300" /> {cls.lecturer_names?.join(', ') || 'Lecturer Unassigned'}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-slate-50 flex justify-between items-center shrink-0">
                  <span className="text-[9px] text-slate-300 font-mono">TRACK: {cls.id.substring(0, 8).toUpperCase()}</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Enter <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
              <BookOpen size={48} className="mx-auto text-slate-200 mb-4" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No classes assigned yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Profile Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[999] p-4">
          <form 
            onSubmit={handleSaveProfileSettings}
            className="bg-bg-card border border-border-card rounded-[2.5rem] p-8 md:p-10 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Profile Settings</h2>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Update your student credentials</p>
              </div>
              <button 
                type="button"
                onClick={() => { setShowSettingsModal(false); setSettingsMessage(''); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors font-black text-[10px] uppercase tracking-widest cursor-pointer bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50"
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
                  placeholder="Student Full Name"
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
                  placeholder="student@limkokwing.edu"
                />
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
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100/50 dark:border-slate-805/30 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-800 dark:text-slate-200"
                  placeholder="•••••••• (Leave blank to keep current)"
                />
              </div>
            </div>

            {settingsMessage && (
              <p className={`mt-6 text-center text-xs font-black py-3 px-4 rounded-xl leading-tight uppercase tracking-wide border ${
                settingsMessage.includes('✅') 
                  ? 'text-emerald-550 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/60' 
                  : 'text-red-550 dark:text-red-450 bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/60'
              }`}>
                {settingsMessage}
              </p>
            )}

            <div className="pt-6 border-t border-slate-100 dark:border-slate-900 mt-6 flex justify-end">
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