'use client'
import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Sync state with HTML class
    const checkTheme = () => {
      const darkActive = document.documentElement.classList.contains('dark')
      setIsDark(darkActive)
    }
    checkTheme()

    // Observe HTML class changes
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setIsDark(false)
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setIsDark(true)
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 sm:p-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl shadow-md hover:shadow-indigo-500/5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center backdrop-blur-md"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <div className="relative w-[18px] h-[18px] sm:w-5 sm:h-5 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-amber-500 animate-in spin-in-45 fade-in zoom-in-75 duration-300" />
        ) : (
          <Moon className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-indigo-600 animate-in -spin-in-45 fade-in zoom-in-75 duration-300" />
        )}
      </div>
    </button>
  )
}
