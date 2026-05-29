'use client'
import React from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, UserCheck, Users, BookOpen, LogOut, RefreshCw } from 'lucide-react'
import ThemeToggle from '@/app/components/ThemeToggle'
import NotificationBell from '@/app/components/NotificationBell'
import AccountSwitcher from '@/app/components/AccountSwitcher'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const handleAdminLogout = async () => {
    if (confirm("Are you sure you want to log out from the Admin Panel?")) {
      try {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        router.push('/auth/login')
        router.refresh()
      } catch (err: any) {
        alert("Logout failed: " + err.message)
      }
    }
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#F8FAFC] font-sans select-none">
      
      {/* MOBILE HEADER */}
      <header className="lg:hidden bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <ShieldCheck size={18} />
          </div>
          <span className="font-black text-[9px] uppercase tracking-widest text-slate-100 leading-tight">
            Institutional<br/>Admin Panel
          </span>
        </div>
        <div className="flex items-center gap-3">
          <AccountSwitcher />
          <NotificationBell />
          <ThemeToggle />
          <button 
            onClick={() => window.location.reload()}
            className="p-3 bg-white/85 dark:bg-slate-900/85 border border-slate-200/50 dark:border-slate-800/50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl shadow-md hover:shadow-indigo-500/5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center backdrop-blur-md"
            title="Refresh Page"
          >
            <RefreshCw size={20} />
          </button>
          <button 
            onClick={handleAdminLogout}
            className="text-slate-400 hover:text-red-400 transition-colors p-2 outline-none cursor-pointer flex items-center justify-center"
            title="Exit Admin"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* MOBILE NAVIGATION TABS */}
      <nav className="lg:hidden bg-slate-950 border-b border-slate-900 px-4 py-2.5 flex gap-2 overflow-x-auto custom-scrollbar sticky top-[68px] z-40">
        <Link 
          href="/admin/lecturers" 
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all whitespace-nowrap text-[9px] font-black uppercase tracking-widest cursor-pointer ${
            pathname === '/admin/lecturers' 
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow' 
              : 'text-slate-400 hover:bg-slate-900/50'
          }`}
        >
          <UserCheck size={14} />
          <span>Lecturers</span>
        </Link>
        <Link 
          href="/admin/students" 
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all whitespace-nowrap text-[9px] font-black uppercase tracking-widest cursor-pointer ${
            pathname === '/admin/students' 
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow' 
              : 'text-slate-400 hover:bg-slate-900/50'
          }`}
        >
          <Users size={14} />
          <span>Students</span>
        </Link>
        <Link 
          href="/admin/subjects" 
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all whitespace-nowrap text-[9px] font-black uppercase tracking-widest cursor-pointer ${
            pathname === '/admin/subjects' 
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow' 
              : 'text-slate-400 hover:bg-slate-900/50'
          }`}
        >
          <BookOpen size={14} />
          <span>Curriculum</span>
        </Link>
      </nav>

      {/* SIDEBAR NAVIGATION CONTROL PANELS FOR DESKTOP */}
      <aside className="hidden lg:flex w-72 bg-slate-900 border-r border-slate-800 flex-col sticky top-0 h-screen z-50 shadow-2xl">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <ShieldCheck size={20} />
            </div>
            <span className="font-black text-[10px] uppercase tracking-widest text-slate-100 leading-tight">
              Institutional<br/>Admin Panel
            </span>
          </div>

          <nav className="space-y-2">
            <Link 
              href="/admin/lecturers" 
              className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group cursor-pointer ${
                pathname === '/admin/lecturers' 
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-xl shadow-indigo-900/10' 
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <UserCheck size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Lecturer Approvals</span>
              </div>
            </Link>

            <Link 
              href="/admin/students" 
              className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group cursor-pointer ${
                pathname === '/admin/students' 
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-xl shadow-indigo-900/10' 
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Student Directory</span>
              </div>
            </Link>

            <Link 
              href="/admin/subjects" 
              className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group cursor-pointer ${
                pathname === '/admin/subjects' 
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-xl shadow-indigo-900/10' 
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <BookOpen size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Curriculum Matrix</span>
              </div>
            </Link>
          </nav>
        </div>

        {/* LOGOUT BUTTON */}
        <div className="mt-auto p-8 border-t border-slate-800 space-y-4">
          <div className="flex items-center justify-between text-slate-400 font-black text-[10px] uppercase tracking-widest items-center">
            <span>Theme & Refresh</span>
            <div className="flex items-center gap-2">
              <AccountSwitcher align="left" />
              <NotificationBell align="left" />
              <ThemeToggle />
              <button 
                onClick={() => window.location.reload()}
                className="p-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl shadow-md hover:shadow-indigo-500/5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center backdrop-blur-md"
                title="Refresh Page"
              >
                <RefreshCw size={20} />
              </button>
            </div>
          </div>
          <button 
            onClick={handleAdminLogout}
            className="flex items-center gap-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-red-400 transition-colors w-full text-left outline-none cursor-pointer pt-2"
          >
            <LogOut size={18} /> Exit Admin
          </button>
        </div>
      </aside>

      {/* CORE FRAME LAYOUT children */}
      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col bg-[#F8FAFC]">
        {/* Sticky Desktop Top Header */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-800/50 sticky top-0 z-40 backdrop-blur-md shadow-xs">
          <div className="flex items-center gap-2 text-slate-450 font-black text-[10px] uppercase tracking-widest">
            <span>Admin Console</span>
          </div>
          <div className="flex items-center gap-3">
            <AccountSwitcher />
            <NotificationBell />
            <ThemeToggle />
            <button 
              onClick={() => window.location.reload()}
              className="p-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl shadow-md hover:shadow-indigo-500/5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center backdrop-blur-md"
              title="Refresh Page"
            >
              <RefreshCw size={20} />
            </button>
            <button 
              onClick={handleAdminLogout}
              className="flex items-center gap-2 px-5 py-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-red-500/30 text-slate-700 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 rounded-2xl shadow-md active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer text-xs font-black uppercase tracking-widest"
              title="Exit Admin"
            >
              <LogOut size={14} /> Exit Admin
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-8 md:p-12">
          {children}
        </div>
      </main>
    </div>
  )
}