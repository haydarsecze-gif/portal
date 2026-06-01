'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Check, X, Trash2, Mail, Clock, ShieldAlert, Loader2, Sparkles, UserCheck, Pencil, Save } from 'lucide-react'

// Relative time formatter: e.g. "1 day ago", "2 months ago", "1 year 2 months ago"
export function formatRelativeTime(dateStr?: string) {
  if (!dateStr) return 'N/A';
  try {
    const cleanStr = dateStr.replace(' ', 'T');
    const past = new Date(cleanStr);
    if (isNaN(past.getTime())) return 'N/A';
    
    const now = new Date();
    const diffMs = now.getTime() - past.getTime();
    if (diffMs < 0) return 'Just now';

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;

    const diffMonths = Math.floor(diffDays / 30.44); // average month length
    if (diffMonths < 12) {
      return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
    }

    const diffYears = Math.floor(diffMonths / 12);
    const remainingMonths = diffMonths % 12;

    if (remainingMonths === 0) {
      return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
    }

    const yearStr = diffYears === 1 ? '1 year' : `${diffYears} years`;
    const monthStr = remainingMonths === 1 ? '1 month' : `${remainingMonths} months`;
    return `${yearStr} ${monthStr} ago`;
  } catch (e) {
    console.error('Error formatting relative time:', e);
    return 'N/A';
  }
}

export default function LecturerManagement() {
  const [teachers, setTeachers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Edit states for Admin editing lecturer
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingLecturer, setEditingLecturer] = useState<any>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editDriveId, setEditDriveId] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Premium Alert/Confirm Dialog Modal State
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'success' | 'warning';
    onConfirm?: () => void;
    onCancel?: () => void;
    isConfirm?: boolean;
  }>({ isOpen: false, title: '', message: '', type: 'info' })

  useEffect(() => { fetchTeachers() }, [])

  const fetchTeachers = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*')
    if (!error) {
      setTeachers(data.filter(p => p.role === 'teacher') || [])
    }
    setLoading(false)
  }

  const updateStatus = async (id: string, approved: boolean) => {
    const targetLecturer = teachers.find(t => t.id === id)
    const lecturerName = targetLecturer?.full_name || "Lecturer"

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setAlertConfig({
          isOpen: true,
          title: "Session Expired",
          message: "Unauthorized: No active session.",
          type: "error"
        })
        return
      }

      const res = await fetch('/api/admin/approve-lecturer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ userId: id, approved })
      })

      const resData = await res.json()
      if (!res.ok) {
        setAlertConfig({
          isOpen: true,
          title: "Update Failed",
          message: "Failed to update lecturer status: " + (resData.error || "Unknown database error."),
          type: "error"
        })
        return
      }

      try {
        let adminName = "Administrator"
        const { data: { user: adminUser } } = await supabase.auth.getUser()
        if (adminUser) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', adminUser.id)
            .single()
          if (prof?.full_name) adminName = prof.full_name
        }

        const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

        if (approved) {
          // Notify the lecturer
          await supabase.from('notifications').insert({
            user_id: id,
            title: "Lecturer Account Approved",
            message: `Your lecturer account has been approved by ${adminName} at ${currentTime}.`,
            type: "approval",
            link: "/dashboard/lecturer"
          })

          // Notify all admins
          const { data: adminProfiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin')

          if (adminProfiles && adminProfiles.length > 0) {
            const adminNotifs = adminProfiles.map(adm => ({
              user_id: adm.id,
              title: "Lecturer Account Approved",
              message: `${adminName} approved lecturer ${lecturerName}'s account at ${currentTime}.`,
              type: "approval",
              link: "/admin/lecturers"
            }))
            await supabase.from('notifications').insert(adminNotifs)
          }
        }
      } catch (err) {
        console.error("Error creating approval notification:", err)
      }
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: "Database Error",
        message: err.message,
        type: "error"
      })
    }

    fetchTeachers()
  }

  const deleteTeacher = async (id: string) => {
    const targetLecturer = teachers.find(t => t.id === id)
    const lecturerName = targetLecturer?.full_name || "Lecturer"

    setAlertConfig({
      isOpen: true,
      title: "Delete Lecturer",
      message: `Are you sure you want to permanently delete lecturer account "${lecturerName}"? This will erase all their academic directory and coursework profiles.`,
      type: "warning",
      isConfirm: true,
      onConfirm: async () => {
        setAlertConfig(prev => ({ ...prev, isOpen: false }))
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
            setAlertConfig({
              isOpen: true,
              title: "Session Expired",
              message: "Unauthorized: No active session.",
              type: "error"
            })
            return
          }

          const res = await fetch('/api/auth/delete-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ userId: id })
          })

          const resData = await res.json()
          if (!res.ok) {
            setAlertConfig({
              isOpen: true,
              title: "Deletion Failed",
              message: "Failed to delete lecturer: " + (resData.error || "Unknown serverless exception."),
              type: "error"
            })
            return
          }

          try {
            let adminName = "Administrator"
            const { data: { user: adminUser } } = await supabase.auth.getUser()
            if (adminUser) {
              const { data: prof } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', adminUser.id)
                .single()
              if (prof?.full_name) adminName = prof.full_name
            }

            const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

            // Notify all admins
            const { data: adminProfiles } = await supabase
              .from('profiles')
              .select('id')
              .eq('role', 'admin')

            if (adminProfiles && adminProfiles.length > 0) {
              const adminNotifs = adminProfiles.map(adm => ({
                user_id: adm.id,
                title: "Lecturer Account Deleted",
                message: `${adminName} deleted lecturer account "${lecturerName}" at ${currentTime}.`,
                type: "approval",
                link: "/admin/lecturers"
              }))
              await supabase.from('notifications').insert(adminNotifs)
            }
          } catch (err) {
            console.error("Error creating deletion notification:", err)
          }
        } catch (authDeleteErr: any) {
          console.error("Error deleting auth record from Supabase:", authDeleteErr)
          setAlertConfig({
            isOpen: true,
            title: "Database Error",
            message: authDeleteErr.message,
            type: "error"
          })
        }

        fetchTeachers()
      },
      onCancel: () => {
        setAlertConfig(prev => ({ ...prev, isOpen: false }))
      }
    })
  }

  const handleSaveLecturer = async () => {
    if (!editingLecturer || !editName.trim() || !editEmail.trim()) {
      setAlertConfig({
        isOpen: true,
        title: "Required Fields",
        message: "Please fill in the Name and Email fields.",
        type: "warning"
      })
      return
    }
    
    setIsSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setAlertConfig({
          isOpen: true,
          title: "Session Expired",
          message: "Unauthorized: No active session.",
          type: "error"
        })
        setIsSaving(false)
        return
      }

      const res = await fetch('/api/admin/update-lecturer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: editingLecturer.id,
          fullName: editName.trim(),
          email: editEmail.trim(),
          driveFolderId: editDriveId.trim()
        })
      })

      const resData = await res.json()
      if (!res.ok) {
        setAlertConfig({
          isOpen: true,
          title: "Update Failed",
          message: "Failed to update details: " + (resData.error || "Unknown server error."),
          type: "error"
        })
      } else {
        setIsEditModalOpen(false)
        fetchTeachers()
      }
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: "Save Error",
        message: err.message,
        type: "error"
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-300">
      <Loader2 className="animate-spin mb-2" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Lecturer Approvals...</p>
    </div>
  )

  const pending = teachers.filter(t => !t.is_approved)
  const approved = teachers.filter(t => t.is_approved)

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans select-text">
      
      {/* Pending Approvals Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Clock className="text-amber-500 shrink-0" size={18} />
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Pending Lecturer Approvals</h2>
          <span className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-lg text-[10px] font-black tracking-widest">{pending.length}</span>
        </div>
        
        <div className="grid gap-4">
          {pending.length > 0 ? (
            pending.map(t => (
              <div key={t.id} className="bg-white border border-slate-100 p-4 sm:p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4 text-left min-w-0">
                  <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-sm uppercase shrink-0">
                    {t.full_name?.[0] || 'T'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-850 uppercase tracking-tight truncate">{t.full_name}</h3>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 mt-0.5 text-[9.5px]">
                      <span className="text-slate-400 font-bold uppercase tracking-wider truncate">{t.email || 'No email provided'}</span>
                      {t.created_at && (
                        <>
                          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-amber-500 dark:text-amber-400 font-black uppercase tracking-wider">Registered: {formatRelativeTime(t.created_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end sm:justify-start shrink-0">
                  <button 
                    onClick={() => updateStatus(t.id, true)} 
                    className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-500/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                    title="Approve Lecturer"
                  >
                    <Check size={16} strokeWidth={3} />
                  </button>
                  <button 
                    onClick={() => deleteTeacher(t.id)} 
                    className="bg-slate-50 border border-slate-150 hover:bg-red-50 text-slate-400 hover:text-red-500 hover:border-red-100 p-3 rounded-2xl active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                    title="Reject/Delete Lecturer"
                  >
                    <X size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center bg-white rounded-3xl border border-dashed border-slate-200">
              <Sparkles size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No pending lecturer registration logs found.</p>
            </div>
          )}
        </div>
      </section>

      {/* Verified Faculty Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <UserCheck className="text-indigo-600 shrink-0" size={18} />
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Verified Faculty Directory</h2>
          <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-lg text-[10px] font-black tracking-widest">{approved.length}</span>
        </div>
        
        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lecturer Profile Details</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Account Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {approved.length > 0 ? (
                  approved.map(t => (
                    <tr key={t.id} className="group hover:bg-slate-50/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-sm text-slate-800 uppercase tracking-tight">{t.full_name}</div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 mt-0.5 text-[9.5px]">
                          <span className="text-slate-400 font-bold uppercase tracking-wider truncate">{t.email || 'No email provided'}</span>
                          {t.created_at && (
                            <>
                              <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                              <span className="text-indigo-500 dark:text-indigo-400 font-black uppercase tracking-wider">Created: {formatRelativeTime(t.created_at)}</span>
                            </>
                          )}
                          {t.drive_folder_id && (
                            <>
                              <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                              <span className="text-emerald-500 dark:text-emerald-400 font-black uppercase tracking-wider truncate max-w-[150px]" title={t.drive_folder_id}>Drive ID: {t.drive_folder_id}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setEditingLecturer(t)
                              setEditName(t.full_name || '')
                              setEditEmail(t.email || '')
                              setEditDriveId(t.drive_folder_id || '')
                              setIsEditModalOpen(true)
                            }}
                            className="w-10 h-10 inline-flex items-center justify-center bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 text-slate-400 hover:text-indigo-600 rounded-xl transition-all cursor-pointer active:scale-95"
                            title="Edit Lecturer Details"
                          >
                            <Pencil size={16} />
                          </button>
                          <button 
                            onClick={() => deleteTeacher(t.id)} 
                            className="w-10 h-10 inline-flex items-center justify-center bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-100 text-slate-350 hover:text-red-500 rounded-xl transition-all cursor-pointer active:scale-95"
                            title="Delete Lecturer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50/30">
                      No verified lecturing faculty found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Edit Lecturer Modal */}
      {isEditModalOpen && editingLecturer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 relative flex flex-col gap-6 animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-6 right-6 p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-350 hover:text-slate-600 dark:hover:text-slate-100 rounded-xl transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest">
                Account Administration
              </span>
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight mt-2 leading-none">
                Edit Lecturer Profile
              </h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                Override active lecturing faculty settings
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none block">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all"
                  placeholder="e.g. Dr. John Doe"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none block">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all"
                  placeholder="e.g. lecturer@domain.com"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none block">
                  Google Drive Folder ID
                </label>
                <input
                  type="text"
                  value={editDriveId}
                  onChange={e => setEditDriveId(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all"
                  placeholder="e.g. 1PAX7i6xTj_-SucRyBp..."
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 py-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLecturer}
                disabled={isSaving}
                className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-950/10 active:scale-95 transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <Loader2 className="animate-spin text-white" size={12} />
                ) : (
                  <>
                    <Save size={12} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Alert/Confirm Dialog Modal */}
      {alertConfig.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 relative flex flex-col gap-6 animate-in zoom-in-95 duration-300 font-sans">
            <div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                alertConfig.type === 'error' 
                  ? 'bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-450'
                  : alertConfig.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 text-amber-600 dark:text-amber-450'
                    : 'bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400'
              }`}>
                {alertConfig.type === 'error' ? 'System Alert' : alertConfig.type === 'warning' ? 'User Confirmation' : 'Notification'}
              </span>
              <h3 className="text-xl font-black text-slate-850 dark:text-white uppercase tracking-tight mt-2 leading-none">
                {alertConfig.title}
              </h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-450 mt-3 leading-relaxed">
                {alertConfig.message}
              </p>
            </div>

            <div className="flex gap-3">
              {alertConfig.isConfirm ? (
                <>
                  <button
                    onClick={alertConfig.onCancel}
                    className="flex-1 py-3.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-350 rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={alertConfig.onConfirm}
                    className={`flex-1 py-3.5 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer ${
                      alertConfig.type === 'error'
                        ? 'bg-rose-600 hover:bg-rose-500'
                        : 'bg-indigo-600 hover:bg-indigo-500'
                    }`}
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-950/10 active:scale-95 transition-all cursor-pointer"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}