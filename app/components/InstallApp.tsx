'use client'
import { useState, useEffect } from 'react'
import { Smartphone, Check, X } from 'lucide-react'

export default function InstallApp() {
  const [installable, setInstallable] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    // 1. Check if PWA install prompt is already captured on the window
    if ((window as any).deferredPrompt) {
      setInstallable(true)
    }

    // 2. Listen to custom PWA installable event
    const handlePWAInstallable = () => {
      setInstallable(true)
    }

    // 3. Listen to successful PWA installation
    const handleAppInstalled = () => {
      setInstallable(false)
      setInstalled(true)
      setTimeout(() => setInstalled(false), 3000)
    }

    window.addEventListener('pwa-installable', handlePWAInstallable)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('pwa-installable', handlePWAInstallable)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (installable) {
      const timer = setTimeout(() => {
        setIsCollapsed(true)
      }, 10000) // 10 seconds
      return () => clearTimeout(timer)
    }
  }, [installable])

  const handleInstall = async () => {
    const promptEvent = (window as any).deferredPrompt
    if (!promptEvent) return

    // Show the native browser install prompt
    promptEvent.prompt()

    // Wait for the user to respond to the prompt
    const { outcome } = await promptEvent.userChoice
    console.log(`PWA Installation user outcome: ${outcome}`)

    // Clear the deferred prompt, it can only be used once
    ;(window as any).deferredPrompt = null
    setInstallable(false)
  }

  if (dismissed) return null

  if (installed) {
    return (
      <div className="fixed bottom-6 right-24 z-50 animate-in slide-in-from-bottom-5 duration-300">
        <div className="flex items-center gap-2 px-4 py-3.5 bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-500/10 border border-emerald-400/20 backdrop-blur-md">
          <Check size={16} strokeWidth={3} />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">Portal Installed Successfully</span>
        </div>
      </div>
    )
  }

  if (!installable) return null

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-700 ease-in-out ${
      isCollapsed ? 'max-w-[120px]' : 'max-w-[340px]'
    }`}>
      <div className={`flex items-center bg-[#1e2028]/95 dark:bg-[#15171e]/95 border border-[#2d303c]/80 dark:border-slate-800/80 backdrop-blur-2xl shadow-2xl transition-all duration-700 ease-in-out ${
        isCollapsed ? 'rounded-full p-1.5' : 'rounded-2xl p-2 pr-3.5'
      }`}>
        <button
          onClick={handleInstall}
          className={`flex items-center justify-center bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black active:scale-95 transition-all duration-700 shadow cursor-pointer shrink-0 ${
            isCollapsed 
              ? 'w-10 h-10 rounded-full p-0' 
              : 'flex-1 gap-2.5 px-4 py-2.5 rounded-xl text-[9px] uppercase tracking-widest'
          }`}
          title="Install Portal App"
        >
          <Smartphone size={isCollapsed ? 16 : 14} className={isCollapsed ? 'animate-pulse' : 'animate-bounce'} />
          <span className={`transition-all duration-500 ease-in-out overflow-hidden whitespace-nowrap ${
            isCollapsed ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-[200px] opacity-100'
          }`}>
            Install Portal App
          </span>
        </button>
        
        <button
          onClick={() => setDismissed(true)}
          className={`text-slate-400 hover:text-slate-200 transition-colors active:scale-95 cursor-pointer flex items-center justify-center shrink-0 ${
            isCollapsed 
              ? 'p-2 rounded-full hover:bg-white/5 ml-0.5' 
              : 'p-2.5 rounded-xl hover:bg-white/5 ml-1.5'
          }`}
          title="Dismiss"
        >
          <X size={isCollapsed ? 12 : 14} />
        </button>
      </div>
    </div>
  )
}
