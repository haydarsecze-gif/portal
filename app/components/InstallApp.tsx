'use client'
import { useState, useEffect } from 'react'
import { Smartphone, Download, Check, X } from 'lucide-react'

export default function InstallApp() {
  const [installable, setInstallable] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)

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
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-6 duration-300">
      <div className="flex items-center bg-slate-950/80 dark:bg-slate-900/90 border border-slate-800/80 dark:border-slate-700/80 backdrop-blur-2xl p-2 rounded-2xl shadow-2xl shadow-indigo-950/20 max-w-[280px]">
        <button
          onClick={handleInstall}
          className="flex-1 flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow duration-300 cursor-pointer"
        >
          <Smartphone size={14} className="animate-bounce" />
          <span>Install Portal App</span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-2.5 text-slate-400 hover:text-slate-200 transition-colors rounded-xl hover:bg-white/5 active:scale-95 cursor-pointer ml-1"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
