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
    deadline: initialData?.deadline
      ? new Date(initialData.deadline).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
    allowLate: initialData?.allow_late ?? true
  })

  const handleSave = async () => {
    if (!formData.title.trim()) return setError('Title is required!')
    if (!initialData && files.length === 0) return setError('Please attach at least one file.')

    setLoading(true)
    setError(null)

    try {
      const links: string[] = []
      let capturedFolderId: string | null = null

      // UPLOAD ALL FILES
      for (const f of files) {
        const reader = new FileReader()
        const base64: string = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(f)
        })

        const { data, error: uploadError } = await supabase.functions.invoke('upload-to-drive', {
          body: {
            file: base64,
            fileName: f.name,
            mimeType: f.type,
            subjectName: subjectName.trim(),
            assignmentName: formData.title.trim(),
            itemType: type
          }
        })

        if (uploadError) throw uploadError

        links.push(data.link)

        // IMPORTANT: Capture the folderId from the first file
        // All files in this loop go into the same folder
        if (!capturedFolderId && data.folderId) {
          capturedFolderId = data.folderId
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