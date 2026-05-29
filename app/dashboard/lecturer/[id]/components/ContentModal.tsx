'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Upload, Trash2, Loader2, AlertCircle } from 'lucide-react'

interface ContentModalProps {
  classId: string
  subjectName: string
  onClose: () => void
  onRefresh: () => void
  initialData?: any
}

const getSafeISODateStr = (dateStr?: string) => {
  if (!dateStr) return new Date().toISOString().slice(0, 16)
  try {
    const safeStr = dateStr.includes(' ') && !dateStr.includes('T')
      ? dateStr.replace(' ', 'T')
      : dateStr
    const d = new Date(safeStr)
    if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 16)
    return d.toISOString().slice(0, 16)
  } catch (e) {
    return new Date().toISOString().slice(0, 16)
  }
}

export default function ContentModal({
  classId,
  subjectName,
  onClose,
  onRefresh,
  initialData
}: ContentModalProps) {

  const [type, setType] = useState<'assignment' | 'material'>(
    initialData
      ? (initialData.deadline ? 'assignment' : 'material')
      : 'assignment'
  )
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    deadline: getSafeISODateStr(initialData?.deadline),
    allowLate: initialData?.allow_late ?? true
  })

  const handleSave = async () => {
    if (!formData.title.trim()) return setError('Title is required!')
    if (!initialData && files.length === 0) return setError('Please attach at least one file.')

    setLoading(true)
    setError(null)

    try {
      const links: string[] = []
      let capturedFolderId = initialData?.folder_id || null

      if (files.length > 0) {
        // 1. Fetch OAuth2 access token and root folder ID
        const tokenRes = await fetch('/api/drive/token')
        const tokenData = await tokenRes.json()
        if (!tokenRes.ok || tokenData.error) {
          throw new Error(tokenData.error || 'Failed to retrieve Google Drive upload session.')
        }
        const { accessToken, parentFolderId } = tokenData

        // Query the lecturer's own drive folder ID if defined
        let targetParentId = parentFolderId
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('drive_folder_id')
            .eq('id', user.id)
            .single()
          if (prof?.drive_folder_id) {
            targetParentId = prof.drive_folder_id
          }
        }

        // 2. Create assignment folder if it doesn't exist yet
        if (!capturedFolderId) {
          const folderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: formData.title.trim(), // EXACT name, keeping casing & spaces (e.g. "Task 1")
              mimeType: 'application/vnd.google-apps.folder',
              parents: [targetParentId]
            })
          })

          if (!folderRes.ok) {
            const errText = await folderRes.text()
            throw new Error(`Failed to create assignment folder in Google Drive: ${errText}`)
          }

          const folderData = await folderRes.json()
          capturedFolderId = folderData.id
        }

        // 3. Upload attached files
        for (const f of files) {
          const metadata = {
            name: f.name,
            parents: [capturedFolderId]
          }

          const formDataPayload = new FormData()
          formDataPayload.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
          formDataPayload.append('file', f)

          const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            },
            body: formDataPayload
          })

          if (!uploadRes.ok) {
            const errText = await uploadRes.text()
            throw new Error(`File upload failed for "${f.name}": ${errText}`)
          }

          const uploadData = await uploadRes.json()
          const fileId = uploadData.id

          // Set anyone reader permission
          const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              role: 'reader',
              type: 'anyone'
            })
          })

          if (!permRes.ok) {
            console.error("Direct permission set failed for file", fileId)
          }

          // Fetch webViewLink
          const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          })

          if (!metaRes.ok) {
            throw new Error("Failed to retrieve file web link from Google Drive.")
          }

          const metaData = await metaRes.json()
          links.push(metaData.webViewLink)
        }
      }

      let dbError;
      if (initialData) {
        // Update existing item
        const updatePayload: any = {
          title: formData.title,
          description: formData.description || null,
        }
        if (links.length > 0) {
          updatePayload.file_url = initialData.file_url
            ? `${initialData.file_url}, ${links.join(', ')}`
            : links.join(', ')
        }
        if (type === 'assignment') {
          updatePayload.deadline = new Date(formData.deadline).toISOString()
          updatePayload.allow_late = formData.allowLate
        }

        const { error } = await supabase
          .from(type === 'assignment' ? 'assignments' : 'materials')
          .update(updatePayload)
          .eq('id', initialData.id)
        dbError = error
      } else {
        // Insert new item
        const payload: any = {
          class_id: classId,
          title: formData.title,
          description: formData.description || null,
          file_url: links.join(', '),
          folder_id: capturedFolderId // Storing this enables the "Delete everything" feature
        }

        if (type === 'assignment') {
          payload.deadline = new Date(formData.deadline).toISOString()
          payload.allow_late = formData.allowLate
        }

        const { error } = await supabase
          .from(type === 'assignment' ? 'assignments' : 'materials')
          .insert([payload])
        dbError = error
      }

      if (dbError) throw dbError

      // Notify all students in this class if it's a new coursework item (not editing)
      if (!initialData) {
        try {
          const { data: mappings } = await supabase
            .from('student_classes')
            .select('student_id')
            .eq('subject_id', classId)

          if (mappings && mappings.length > 0) {
            const notificationsToInsert = mappings.map(m => ({
              user_id: m.student_id,
              title: type === 'assignment' ? "New Assignment Added" : "New Material Added",
              message: `Lecturer added a new ${type}: "${formData.title}" in ${subjectName}`,
              type: type
            }))

            const { error: notifErr } = await supabase
              .from('notifications')
              .insert(notificationsToInsert)

            if (notifErr) {
              console.error("Failed to insert student notifications:", notifErr)
            }
          }
        } catch (err) {
          console.error("Error creating coursework notifications:", err)
        }
      }

      onRefresh()
      onClose()

    } catch (e: any) {
      console.error("Upload Error:", e)
      setError(e.message || 'Upload failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[999] p-4">
      <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-black text-gray-900">
              {initialData ? 'Edit' : 'Create'} {type === 'assignment' ? 'Assignment' : 'Material'}
            </h2>
            <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mt-1">
              {subjectName}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-4">
          <button
            type="button"
            disabled={!!initialData}
            onClick={() => setType('assignment')}
            className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${
              type === 'assignment' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'
            } ${initialData ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            ASSIGNMENT
          </button>
          <button
            type="button"
            disabled={!!initialData}
            onClick={() => setType('material')}
            className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${
              type === 'material' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-400'
            } ${initialData ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            MATERIAL
          </button>
        </div>

        <input
          className="w-full p-4 bg-gray-50 rounded-2xl text-sm font-bold mb-4 border-none outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="Title..."
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />

        <textarea
          className="w-full p-4 bg-gray-50 rounded-2xl text-sm h-24 mb-4 border-none outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="Description..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />

        {type === 'assignment' && (
          <div className="flex gap-4 mb-4">
            <input
              type="datetime-local"
              className="flex-1 p-4 bg-gray-50 rounded-2xl text-sm font-bold border-none"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setFormData({ ...formData, allowLate: !formData.allowLate })}
              className={`px-4 rounded-2xl font-bold text-[10px] transition-colors ${
                formData.allowLate ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
              }`}
            >
              LATE: {formData.allowLate ? 'YES' : 'NO'}
            </button>
          </div>
        )}

        <label className="border-2 border-dashed border-gray-200 rounded-[2rem] p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors mb-4">
          <Upload size={24} className="text-gray-300" />
          <span className="text-[10px] font-black text-gray-400 uppercase mt-2">Attach Files</span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                setFiles(prev => [...prev, ...Array.from(e.target.files!)])
              }
            }}
          />
        </label>

        <div className="max-h-32 overflow-y-auto mb-4">
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between bg-white border p-3 rounded-2xl shadow-sm mb-2">
              <span className="text-xs truncate max-w-[200px]">{file.name}</span>
              <button type="button" onClick={() => setFiles(f => f.filter((_, i) => i !== index))}>
                <Trash2 size={16} className="text-red-500" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-slate-900 text-white py-4 rounded-[1.5rem] font-black text-sm uppercase flex items-center justify-center gap-2 hover:bg-slate-800 disabled:bg-gray-300 transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Saving...
            </>
          ) : (
            'UPLOAD & SAVE'
          )}
        </button>
      </div>
    </div>
  )
}