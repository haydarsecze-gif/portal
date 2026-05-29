'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { FileText, BookOpen, Trash2, ChevronDown, ChevronUp, Eye, HardDrive, Database, AlertCircle } from 'lucide-react'

export default function ContentCard({ item, isAssignment, onRefresh, studentCount }: any) {
  const [expanded, setExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const links: string[] = item?.file_url 
    ? item.file_url.split(',').map((u: string) => u.trim()).filter(Boolean) 
    : [];

  const formatDeadline = (deadline?: string) => {
    if (!deadline) return 'No Deadline'
    try {
      const safeDeadline = deadline.includes(' ') && !deadline.includes('T') 
        ? deadline.replace(' ', 'T') 
        : deadline
      const d = new Date(safeDeadline)
      if (isNaN(d.getTime())) return 'No Deadline'
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch (e) {
      return 'No Deadline'
    }
  }

  const formatUploadDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    try {
      const safeDate = dateStr.includes(' ') && !dateStr.includes('T') 
        ? dateStr.replace(' ', 'T') 
        : dateStr
      const d = new Date(safeDate)
      if (isNaN(d.getTime())) return 'N/A'
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch (e) {
      return 'N/A'
    }
  }

  useEffect(() => {
    let timer: any;
    if (isDeleting) {
      timer = setTimeout(() => {
        setIsDeleting(false);
        setLocalError("Request timed out.");
      }, 20000); // Increased timeout for Drive deletion
    }
    return () => clearTimeout(timer);
  }, [isDeleting]);

  const handleDelete = async (deleteFromDrive: boolean) => {
    setLocalError(null)
    setShowDeleteConfirm(false)
    setIsDeleting(true) 

    const table = isAssignment ? 'assignments' : 'materials'
    
    try {
      // 1. IF REQUESTED, DELETE FROM GOOGLE DRIVE DIRECTLY
      if (deleteFromDrive && item.folder_id) {
        const tokenRes = await fetch('/api/drive/token')
        const tokenData = await tokenRes.json()
        if (!tokenRes.ok || tokenData.error) {
          throw new Error(tokenData.error || 'Failed to retrieve Google Drive delete session.')
        }
        const { accessToken } = tokenData

        const delRes = await fetch(`https://www.googleapis.com/drive/v3/files/${item.folder_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })
        
        if (!delRes.ok && delRes.status !== 404) { // 404 means already deleted, ignore it
          const errText = await delRes.text()
          throw new Error(`Could not delete from Google Drive: ${errText}. DB record preserved.`)
        }
      }

      // 2. DELETE FROM SUPABASE DATABASE
      const { error: dbError } = await supabase.from(table).delete().eq('id', item.id)
      if (dbError) throw dbError

      // 3. REFRESH DATA
      await onRefresh()

    } catch (error: any) {
      console.error("Delete failed:", error)
      setLocalError(error.message || "Failed to delete")
      setIsDeleting(false) 
    }
  }

  return (
    <>
      <div className={`bg-white rounded-2xl border transition-all duration-300 ${
        isDeleting ? 'opacity-50 scale-[0.98] border-blue-200 bg-blue-50/10' : 'border-gray-100 hover:border-blue-100 shadow-sm'
      } mb-4 overflow-hidden`}>
        
        <div 
          className={`p-5 flex justify-between items-center ${isDeleting ? 'cursor-not-allowed' : 'cursor-pointer select-none'}`} 
          onClick={() => !isDeleting && setExpanded(!expanded)}
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              isDeleting ? 'bg-gray-100 text-gray-400' : (isAssignment ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600')
            }`}>
              {isDeleting ? (
                <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
              ) : (
                isAssignment ? <FileText size={22} /> : <BookOpen size={22} />
              )}
            </div>
            <div>
              <h3 className={`font-bold text-base ${isDeleting ? 'text-gray-400' : 'text-gray-900'}`}>{item.title}</h3>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                <span className={`text-[10px] font-black uppercase tracking-widest ${
                  isDeleting ? 'text-gray-400' : (isAssignment ? 'text-blue-600' : 'text-amber-600')
                }`}>
                  {isDeleting ? 'DELETING...' : (isAssignment ? 'Assignment' : 'Material')}
                </span>
                <span className="text-gray-300 text-[10px] font-bold">•</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Uploaded: {formatUploadDate(item.created_at)}
                </span>
                {isAssignment && (
                  <>
                    <span className="text-gray-300 text-[10px] font-bold">•</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Due: {formatDeadline(item.deadline)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
            {!isDeleting && (
              <>
                {isAssignment && (
                  <div className="text-right border-r border-gray-100 pr-5 hidden sm:block">
                    <p className="text-blue-600 font-black text-lg leading-none">{item.turnedInCount || 0}/{studentCount}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase">Turned In</p>
                  </div>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true) }} 
                  className="text-gray-300 hover:text-red-500 transition-colors p-2"
                >
                  <Trash2 size={20} />
                </button>
                <div className="text-gray-400">{expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
              </>
            )}
          </div>
        </div>

        {localError && (
          <div className="px-6 py-2 bg-red-50 text-red-600 text-[10px] font-bold flex items-center gap-2 border-t border-red-100">
            <AlertCircle size={12} /> {localError}
          </div>
        )}

        {expanded && !isDeleting && (
          <div className="px-6 pb-6 pt-2 border-t border-gray-50 bg-slate-50/30">
            <p className="text-gray-600 text-sm mb-5 whitespace-pre-wrap leading-relaxed">{item.description || "No description."}</p>
            
            {links.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {links.map((url: string, i: number) => (
                  <a key={url + i} href={url} target="_blank" rel="noreferrer" className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-xs font-bold text-gray-700 flex items-center gap-2 hover:bg-blue-50 hover:border-blue-200 transition shadow-sm">
                    <Eye size={14} className="text-blue-500" /> View Attachment {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-center mb-2 text-gray-900">Remove Content?</h2>
            <div className="space-y-3 mt-6">
              <button 
                onClick={() => handleDelete(true)} 
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-700 transition active:scale-95 shadow-lg shadow-red-100"
              >
                <HardDrive size={16}/> Delete Drive + DB
              </button>
              
              <button 
                onClick={() => handleDelete(false)} 
                className="w-full bg-slate-100 text-slate-700 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition active:scale-95"
              >
                <Database size={16}/> Record Only
              </button>
              
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="w-full py-2 text-gray-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}