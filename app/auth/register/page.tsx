'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, Lock, User, KeyRound, ArrowLeft, UserCheck, RefreshCw } from 'lucide-react'
import ThemeToggle from '@/app/components/ThemeToggle'

export default function Register() {
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [driveFolderId, setDriveFolderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        setInviteCode(code.toUpperCase())
      }
    }
  }, [])

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      setMessage("❌ Please fill all required fields")
      return
    }

    if (role === 'student' && !inviteCode) {
      setMessage("❌ Student must enter Invite Code")
      return
    }

    if (role === 'teacher' && !driveFolderId.trim()) {
      setMessage("❌ Lecturer must enter Google Drive Folder ID")
      return
    }

    setLoading(true)
    setMessage('')

    try {
      let classId = null

      if (role === 'student') {
        const { data: codeData, error: codeError } = await supabase
          .from('invite_codes')
          .select('class_id')
          .eq('code', inviteCode.toUpperCase().trim())
          .single()

        if (codeError || !codeData) {
          throw new Error("Invalid or expired invite code")
        }
        classId = codeData.class_id
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      if (authData.user) {
        const userRole = role === 'student' ? 'student' : 'teacher'
        const status = role === 'student' ? 'active' : 'pending'

        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id,
          full_name: fullName,
          role: userRole,
          status: status,
          class_id: classId,
          drive_folder_id: role === 'teacher' ? driveFolderId.trim() : null
        })

        if (profileError) throw profileError

        if (userRole === 'student') {
          const { error: studentError } = await supabase.from('students').insert({
            id: authData.user.id,
            name: fullName,
            email: email,
            class_id: classId
          })
          if (studentError) throw studentError
        }

        if (userRole === 'teacher') {
          try {
            const { data: admins } = await supabase
              .from('profiles')
              .select('id')
              .eq('role', 'admin')

            if (admins && admins.length > 0) {
              const notificationsToInsert = admins.map(adm => ({
                user_id: adm.id,
                title: "New Lecturer Registration",
                message: `${fullName} registered as a lecturer and is pending approval.`,
                type: "approval"
              }))

              await supabase.from('notifications').insert(notificationsToInsert)
            }
          } catch (err) {
            console.error("Error creating registration notifications for admins:", err)
          }
        }



        setMessage(role === 'teacher' 
          ? "✅ Request sent! Wait for admin approval." 
          : "✅ Registration successful!")
        
        setTimeout(() => router.push('/auth/login'), 2000)
      }
    } catch (err: any) {
      setMessage("❌ " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#05070e] via-[#0b0e1e] to-[#040508] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      
      {/* Theme and Refresh Controls */}
      <div className="absolute top-6 right-6 flex items-center gap-2 z-50">
        <ThemeToggle />
        <button 
          onClick={() => window.location.reload()}
          className="p-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl shadow-md hover:shadow-indigo-500/5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center backdrop-blur-md"
          title="Refresh Page"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* Background glow blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Back button */}
      <button 
        onClick={() => router.push('/')}
        className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2.5 bg-slate-950/40 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-slate-200 rounded-2xl shadow-lg transition-all duration-300 backdrop-blur-md cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span className="text-[9px] font-black uppercase tracking-widest">Back</span>
      </button>

      {/* Auth card */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleRegister(); }}
        className="bg-slate-950/40 border border-slate-900 backdrop-blur-2xl p-10 md:p-12 rounded-[3rem] shadow-[0_30px_70px_rgba(0,0,0,0.5)] shadow-indigo-950/10 w-full max-w-md relative z-10 hover:border-slate-800/80 transition-all duration-500 animate-in zoom-in-95 duration-300"
      >
        
        <h1 className="text-3xl font-black text-center uppercase tracking-tighter text-slate-100 mb-1">
          Register
        </h1>
        <p className="text-center text-[9px] font-black text-indigo-400 uppercase tracking-[0.25em] mb-8">
          Establish Access Credentials
        </p>

        {/* Role Selection Toggle */}
        <div className="flex bg-slate-900/30 p-1.5 rounded-2xl border border-slate-900 mb-8">
          <button 
            type="button"
            onClick={() => { setRole('student'); setMessage(''); }}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
              role === 'student' 
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Student
          </button>
          <button 
            type="button"
            onClick={() => { setRole('teacher'); setMessage(''); }}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
              role === 'teacher' 
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Lecturer
          </button>
        </div>

        <div className="space-y-4">
          {/* Full Name field */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
              <User size={16} />
            </div>
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full pl-12 pr-6 py-4.5 bg-slate-900/30 group-hover:bg-slate-900/50 border border-slate-900 group-focus-within:border-indigo-500/50 rounded-2xl text-slate-200 text-sm font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/5 transition-all duration-300"
            />
          </div>

          {/* Email field */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
              <Mail size={16} />
            </div>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-6 py-4.5 bg-slate-900/30 group-hover:bg-slate-900/50 border border-slate-900 group-focus-within:border-indigo-500/50 rounded-2xl text-slate-200 text-sm font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/5 transition-all duration-300"
            />
          </div>

          {/* Password field */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
              <Lock size={16} />
            </div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-6 py-4.5 bg-slate-900/30 group-hover:bg-slate-900/50 border border-slate-900 group-focus-within:border-indigo-500/50 rounded-2xl text-slate-200 text-sm font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/5 transition-all duration-300"
            />
          </div>

          {/* Drive Folder ID field (Lecturer only) */}
          {role === 'teacher' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-3 duration-300">
              <div className="bg-indigo-950/20 border border-indigo-900/60 p-5 rounded-2xl space-y-3">
                <p className="text-[9.5px] font-black uppercase text-indigo-300 tracking-wider">Required Google Drive Setup</p>
                
                <div className="bg-indigo-950/40 p-3 rounded-xl border border-indigo-900/30">
                  <p className="text-[8.5px] font-black uppercase tracking-widest text-indigo-300">💡 Auto-Organization</p>
                  <p className="text-[9px] font-medium text-indigo-400/95 leading-normal mt-1">
                    You only need to create <strong className="font-extrabold text-indigo-300">one main root folder</strong>. The portal will automatically create subfolders inside it for each of your <strong className="font-extrabold text-indigo-300">Subjects</strong>, folders for each <strong className="font-extrabold text-indigo-300">Assignment/Material</strong>, and nested folders with the <strong className="font-extrabold text-indigo-300">Student's Name</strong> for their submissions.
                  </p>
                </div>

                <ol className="text-[9.5px] font-bold text-indigo-400/90 leading-relaxed list-decimal pl-4 space-y-1.5">
                  <li>Create <strong className="font-extrabold text-indigo-300">1 main folder</strong> (e.g. <i>"Limkokwing Coursework"</i>) in your personal or work Google Drive.</li>
                  <li>Share it with Editor access to our service email: <span className="block font-black select-all mt-1 bg-white/5 dark:bg-slate-950/50 p-1.5 rounded-lg border border-indigo-900/40 break-all text-indigo-300">student-portal-uploader@primal-duality-496907-a8.iam.gserviceaccount.com</span></li>
                  <li>Copy the Folder ID from the URL (the string after <code className="bg-indigo-950 px-1 py-0.5 rounded">folders/</code>) and paste it below.</li>
                </ol>
                <p className="text-[8px] font-black text-indigo-500 uppercase tracking-wider leading-normal mt-2">
                  ⚠️ Note: If your work/school Drive restricts sharing with outside accounts, please use a personal Google Drive instead.
                </p>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-indigo-400 group-focus-within:text-indigo-350 transition-colors">
                  <KeyRound size={16} />
                </div>
                <input
                  type="text"
                  placeholder="Google Drive Folder ID"
                  value={driveFolderId}
                  onChange={(e) => setDriveFolderId(e.target.value.trim())}
                  className="w-full pl-12 pr-6 py-4.5 bg-indigo-950/20 border border-indigo-900/60 focus:border-indigo-500 rounded-2xl text-indigo-300 text-sm font-black placeholder:text-indigo-500/60 outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300"
                />
              </div>
            </div>
          )}

          {/* Invite Code field (Student only) */}
          {role === 'student' && (
            <div className="relative group animate-in fade-in slide-in-from-top-3 duration-300">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-indigo-400 group-focus-within:text-indigo-300 transition-colors">
                <KeyRound size={16} />
              </div>
              <input
                type="text"
                placeholder="Invite Code (e.g. SORA425)"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full pl-12 pr-6 py-4.5 bg-indigo-950/20 border border-indigo-900/60 focus:border-indigo-500 rounded-2xl text-indigo-300 text-sm font-black placeholder:text-indigo-500/60 outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300"
              />
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full relative group overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 text-white disabled:text-slate-500 py-4.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.25em] active:scale-98 transition-all duration-300 mt-8 shadow-xl shadow-emerald-950/10 hover:shadow-emerald-500/15 flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <>
              <span>Complete Register</span>
              <UserCheck size={13} />
            </>
          )}
        </button>

        {message && (
          <p className={`mt-6 text-center text-xs font-black py-3 px-4 rounded-xl animate-in fade-in duration-300 leading-tight uppercase tracking-wide border ${
            message.includes('✅') 
              ? 'text-emerald-400 bg-emerald-950/30 border-emerald-900/50' 
              : 'text-red-400 bg-red-950/30 border-red-900/50'
          }`}>
            {message}
          </p>
        )}

        <p className="mt-8 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Joined before? <a href="/auth/login" className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors ml-1 font-black">Sign In</a>
        </p>
      </form>
    </div>
  )
}