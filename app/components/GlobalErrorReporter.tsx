'use client'
import { useState, useEffect } from 'react'

export default function GlobalErrorReporter() {
  const [errorInfo, setErrorInfo] = useState<string | null>(null)

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const msg = `Error: ${event.message}\nSource: ${event.filename}:${event.lineno}:${event.colno}\nStack: ${event.error?.stack || 'No Stack'}`
      setErrorInfo(msg)
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = `Unhandled Rejection: ${event.reason?.message || event.reason}\nStack: ${event.reason?.stack || 'No Stack'}`
      setErrorInfo(msg)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  if (!errorInfo) return null

  return (
    <div className="fixed inset-x-0 top-0 z-[99999] bg-rose-650 bg-rose-700 text-white p-6 border-b border-rose-500 shadow-2xl font-mono text-[10px] whitespace-pre-wrap max-h-[50vh] overflow-y-auto select-text leading-relaxed">
      <div className="flex justify-between items-center mb-2 border-b border-white/20 pb-2">
        <span className="font-black uppercase tracking-widest text-rose-100">Client-Side Runtime Exception Detected</span>
        <button 
          onClick={() => setErrorInfo(null)}
          className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-[9px] uppercase tracking-wider font-bold cursor-pointer"
        >
          Dismiss
        </button>
      </div>
      {errorInfo}
    </div>
  )
}
