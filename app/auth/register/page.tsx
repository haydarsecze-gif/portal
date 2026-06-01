'use client'
import { useState, useEffect } from 'react'
import { supabase, safeInsertNotifications } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, Lock, User, KeyRound, ArrowLeft, UserCheck, RefreshCw, HelpCircle, X, Smartphone, Share, PlusSquare } from 'lucide-react'
import ThemeToggle from '@/app/components/ThemeToggle'

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

export default function Register() {
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
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

    setLoading(true)
    setMessage('')

    const cleanEmail = email.trim().toLowerCase()

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
        email: cleanEmail,
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
          email: cleanEmail,
          drive_folder_id: null,
          is_approved: role === 'student'
        })

        if (profileError) throw profileError

        if (userRole === 'student') {
          const { error: studentError } = await supabase.from('students').insert({
            id: authData.user.id,
            name: fullName,
            email: cleanEmail,
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

              await safeInsertNotifications(notificationsToInsert)
            }
          } catch (err) {
            console.error("Error creating registration notifications for admins:", err)
          }
        }



        if (userRole === 'teacher') {
          try {
            // Save lecturer credentials securely to Multi-Account Switcher for 1-click test switching
            const saved = JSON.parse(localStorage.getItem('portal_saved_accounts') || '[]')
            const index = saved.findIndex((a: any) => a.email.toLowerCase() === cleanEmail)
            const newAcc: any = {
              email: cleanEmail,
              role: 'teacher',
              name: fullName
            }
            if (password) {
              try {
                newAcc.password = btoa(unescape(encodeURIComponent(password)))
              } catch (e) {
                newAcc.password = btoa(password)
              }
            }
            if (index > -1) {
              saved[index] = newAcc
            } else {
              saved.push(newAcc)
            }
            localStorage.setItem('portal_saved_accounts', JSON.stringify(saved))
          } catch (e) {
            console.error("Error caching registered lecturer credentials:", e)
          }

          const registeredUserId = authData.user.id
          setMessage("✅ Registration successful! Redirecting to Google Drive connection...")
          setTimeout(() => {
            window.location.href = `/api/auth/google?userId=${registeredUserId}`
          }, 1500)
        } else {
          setMessage("✅ Registration successful!")
          setTimeout(() => router.push('/auth/login'), 2000)
        }
      }
    } catch (err: any) {
      setMessage("❌ " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#f3f4f6] via-[#e5e7eb] to-[#f5f3ff] dark:from-[#05070e] dark:via-[#0b0e1e] dark:to-[#040508] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      
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
        className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2.5 bg-white/40 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-900 hover:border-slate-300 dark:hover:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-2xl shadow-lg transition-all duration-300 backdrop-blur-md cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span className="text-[9px] font-black uppercase tracking-widest">Back</span>
      </button>

      {/* Auth card */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleRegister(); }}
        className="bg-bg-card border border-border-card p-10 md:p-12 rounded-[3rem] shadow-[0_30px_70px_rgba(0,0,0,0.1)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.5)] dark:shadow-indigo-950/10 w-full max-w-md relative z-10 hover:border-slate-350 dark:hover:border-slate-800 transition-all duration-500 animate-in zoom-in-95 duration-300"
      >
        
        <h1 className="text-3xl font-black text-center uppercase tracking-tighter text-slate-800 dark:text-slate-100 mb-1">
          Register
        </h1>
        <p className="text-center text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.25em] mb-8">
          Establish Access Credentials
        </p>

        {/* Role Selection Toggle */}
        <div className="flex bg-slate-100/50 dark:bg-slate-900/30 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-900 mb-8">
          <button 
            type="button"
            onClick={() => { setRole('student'); setMessage(''); }}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
              role === 'student' 
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md' 
                : 'text-slate-550 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
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
                : 'text-slate-550 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
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
              className="w-full pl-12 pr-6 py-4.5 bg-slate-100/50 dark:bg-slate-900/30 group-hover:bg-slate-150/50 dark:group-hover:bg-slate-900/50 border border-slate-200/50 dark:border-slate-900 group-focus-within:border-indigo-500/50 rounded-2xl text-slate-800 dark:text-slate-200 text-sm font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/5 transition-all duration-300"
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
              className="w-full pl-12 pr-6 py-4.5 bg-slate-100/50 dark:bg-slate-900/30 group-hover:bg-slate-150/50 dark:group-hover:bg-slate-900/50 border border-slate-200/50 dark:border-slate-900 group-focus-within:border-indigo-500/50 rounded-2xl text-slate-800 dark:text-slate-200 text-sm font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/5 transition-all duration-300"
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
              className="w-full pl-12 pr-6 py-4.5 bg-slate-100/50 dark:bg-slate-900/30 group-hover:bg-slate-150/50 dark:group-hover:bg-slate-900/50 border border-slate-200/50 dark:border-slate-900 group-focus-within:border-indigo-500/50 rounded-2xl text-slate-800 dark:text-slate-200 text-sm font-bold outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/5 transition-all duration-300"
            />
          </div>

          {/* Lecturer Drive Integration Info */}
          {role === 'teacher' && (
            <div className="space-y-2 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-150/40 dark:border-indigo-900/40 text-left animate-in fade-in slide-in-from-top-3 duration-300">
              <p className="text-[9.5px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                🔌 1-Click Google Drive Connection
              </p>
              <p className="text-[9.5px] font-medium text-slate-550 dark:text-slate-400/90 leading-relaxed">
                As a lecturer, you don't need to manually create or share folders! Once you click "Complete Register", the portal will immediately direct you to link your personal or work Google Drive with a single click.
              </p>
            </div>
          )}

          {/* Invite Code field (Student only) */}
          {role === 'student' && (
            <div className="relative group animate-in fade-in slide-in-from-top-3 duration-300">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-indigo-500 dark:text-indigo-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-300 transition-colors">
                <KeyRound size={16} />
              </div>
              <input
                type="text"
                placeholder="Invite Code (e.g. SORA425)"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full pl-12 pr-6 py-4.5 bg-slate-100/50 dark:bg-indigo-950/20 border border-slate-200/60 dark:border-indigo-900/60 focus:border-indigo-500 rounded-2xl text-slate-800 dark:text-indigo-305 text-sm font-black placeholder:text-slate-450 dark:placeholder:text-indigo-500/60 outline-none shadow-inner focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300"
              />
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full relative group overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-200 dark:disabled:from-slate-800 disabled:to-slate-200 dark:disabled:to-slate-800 text-white disabled:text-slate-400 dark:disabled:text-slate-500 py-4.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.25em] active:scale-98 transition-all duration-300 mt-8 shadow-xl shadow-emerald-950/10 hover:shadow-emerald-500/15 flex items-center justify-center gap-2 cursor-pointer"
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
              ? 'text-emerald-500 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50' 
              : 'text-red-500 dark:text-red-400 bg-red-50/50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50'
          }`}>
            {message}
          </p>
        )}

        <p className="mt-8 text-[10px] font-bold text-slate-550 dark:text-slate-500 uppercase tracking-widest">
          Joined before? <a href="/auth/login" className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-400 hover:underline transition-colors ml-1 font-black">Sign In</a>
        </p>
      </form>

    </div>
  )
}