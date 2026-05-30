'use client'
import React, { createContext, useContext, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

interface UploadProgressItem {
  progress: number;
  status: 'uploading' | 'success' | 'failed';
  error?: string;
  title: string;
  type?: 'assignment' | 'material' | 'submission_upload' | 'submission_delete';
}

interface UploadContextType {
  uploadProgress: { [key: string]: UploadProgressItem };
  setUploadProgress: React.Dispatch<React.SetStateAction<{ [key: string]: UploadProgressItem }>>;
  dismissProgress: (key: string) => void;
  triggerHardReload: () => void;
  isReloading: boolean;
  uploadStudentSubmission: (params: {
    assignmentTitle: string;
    filesToUpload: File[];
    itemToUpload: any;
    subjectTrueUUID: string;
    studentName: string;
    profile: any;
    accessToken: string;
    existingSubmission: any;
    onComplete?: () => void;
  }) => Promise<void>;
  deleteStudentFile: (params: {
    fileStringToRemove: string;
    assignmentTitle: string;
    existingSubmission: any;
    subjectTrueUUID: string;
    onComplete?: () => void;
  }) => Promise<void>;
  uploadLecturerCoursework: (params: {
    tempId: string;
    formData: any;
    type: 'assignment' | 'material';
    files: File[];
    subjectName: string;
    classId: string;
    initialData?: any;
    onComplete?: () => void;
  }) => Promise<void>;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: UploadProgressItem }>({});
  const submissionQueues = React.useRef<{ [key: string]: Promise<any> }>({});
  const [isReloading, setIsReloading] = useState(false);

  const triggerHardReload = () => {
    setIsReloading(true);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const enqueueSubmissionAction = (assignmentTitle: string, action: () => Promise<any>) => {
    const currentQueue = submissionQueues.current[assignmentTitle] || Promise.resolve();
    const nextQueue = currentQueue.then(action).catch((err) => {
      console.error("Queue execution error for " + assignmentTitle + ":", err);
      throw err;
    });
    submissionQueues.current[assignmentTitle] = nextQueue;
    return nextQueue;
  };

  const dismissProgress = (key: string) => {
    setUploadProgress(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const uploadStudentSubmission = async ({
    assignmentTitle,
    filesToUpload,
    itemToUpload,
    subjectTrueUUID,
    studentName,
    profile,
    accessToken,
    existingSubmission,
    onComplete
  }: any) => {
    const totalSize = filesToUpload.reduce((sum: number, f: File) => sum + f.size, 0);
    let totalUploadedBytes = 0;

    setUploadProgress(prev => ({
      ...prev,
      [assignmentTitle]: { title: assignmentTitle, progress: 0, status: 'uploading', type: 'submission_upload' }
    }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uploadedLinks: string[] = [];
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

      const isResubmission = !!existingSubmission;
      let resubmitFolderName = '';
      if (isResubmission) {
        const now = new Date();
        const formattedTime = now.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        resubmitFolderName = `resubmit - ${formattedTime}`;
      }

      for (const file of filesToUpload) {
        // 1. Prepare Google Drive resumable session
        const res = await fetch('/api/drive/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName,
            targetFolderId: itemToUpload.folder_id,
            fileName: file.name,
            fileType: file.type || 'application/octet-stream',
            fileSize: file.size,
            isResubmission,
            resubmitFolderName
          })
        });

        const initData = await res.json();
        if (initData.error) throw new Error(initData.error);

        const { uploadUrl } = initData;
        let uploadedBytes = 0;
        const totalBytes = file.size;

        while (uploadedBytes < totalBytes) {
          const chunkEnd = Math.min(uploadedBytes + CHUNK_SIZE, totalBytes);
          const chunkBlob = file.slice(uploadedBytes, chunkEnd);
          const chunkSize = chunkBlob.size;

          const uploadResult = await new Promise<{ status: number; ok: boolean; responseText: string }>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', uploadUrl);
            xhr.setRequestHeader('Content-Range', `bytes ${uploadedBytes}-${chunkEnd - 1}/${totalBytes}`);
            
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const pct = Math.min(Math.round(((totalUploadedBytes + e.loaded) / totalSize) * 98), 98);
                setUploadProgress(prev => ({
                  ...prev,
                  [assignmentTitle]: { ...prev[assignmentTitle], progress: pct }
                }));
              }
            };

            xhr.onload = () => resolve({ status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, responseText: xhr.responseText });
            xhr.onerror = () => reject(new Error('Network upload failed.'));
            xhr.send(chunkBlob);
          });

          if (uploadResult.status === 308) {
            totalUploadedBytes += chunkSize;
            uploadedBytes = chunkEnd;
          } else if (uploadResult.ok) {
            totalUploadedBytes += chunkSize;
            const uploadData = JSON.parse(uploadResult.responseText);
            const fileId = uploadData.id;

            // Set permission to anyone reader
            await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ role: 'reader', type: 'anyone' })
            });

            // Fetch file webViewLink
            const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink,name`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const fileMeta = await metaRes.json();
            uploadedLinks.push(`${fileMeta.name}:::${fileMeta.webViewLink}`);
            uploadedBytes = totalBytes;
          } else {
            throw new Error(`Upload failed (Status ${uploadResult.status}): ${uploadResult.responseText}`);
          }
        }
      }

      // 3. Save to database in a sequential transaction queue to avoid deadlock/concurrency overrides!
      await enqueueSubmissionAction(assignmentTitle, async () => {
        // Query the absolute latest submission from the database first
        const { data: latestSub, error: fetchErr } = await supabase
          .from('submissions')
          .select('*')
          .eq('class_id', subjectTrueUUID)
          .eq('student_id', user?.id)
          .eq('assignment_name', assignmentTitle)
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        let finalLinks = uploadedLinks;
        if (latestSub && latestSub.file_urls) {
          const existingLinksSet = new Set(latestSub.file_urls);
          const uniqueNewLinks = uploadedLinks.filter(link => !existingLinksSet.has(link));
          finalLinks = [...latestSub.file_urls, ...uniqueNewLinks];
        }

        const upsertPayload: any = {
          class_id: subjectTrueUUID,
          student_id: user?.id,
          assignment_name: assignmentTitle,
          file_urls: finalLinks,
          submitted_at: new Date().toISOString()
        };
        if (latestSub?.id) {
          upsertPayload.id = latestSub.id;
        }

        const { error: submitErr } = await supabase.from('submissions').upsert(upsertPayload);
        if (submitErr) throw submitErr;

        // 4. Notify lecturers
        try {
          const { data: lecturers } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'teacher')
            .eq('is_approved', true);
          
          if (lecturers && lecturers.length > 0) {
            let submissionStatusText = "on time";
            if (itemToUpload?.deadline) {
              const deadlineDate = new Date(itemToUpload.deadline);
              const submissionDate = new Date();
              if (submissionDate > deadlineDate) {
                submissionStatusText = "late";
              }
            }

            const actionVerb = latestSub ? "resubmitted" : "submitted";
            const notifTitle = latestSub ? "Assignment Resubmission" : "New Assignment Submission";
            const message = `${studentName} ${actionVerb} the assignment "${assignmentTitle}" (${submissionStatusText}).`;

            const notificationsToInsert = lecturers.map(lec => ({
              user_id: lec.id,
              title: notifTitle,
              message: message,
              type: "submission",
              link: `/dashboard/lecturer/${subjectTrueUUID}?select=${assignmentTitle}`
            }));
            await supabase.from('notifications').insert(notificationsToInsert);
          }
        } catch (err) {
          console.error("Error creating notifications:", err);
        }
      });

      setUploadProgress(prev => ({
        ...prev,
        [assignmentTitle]: { ...prev[assignmentTitle], progress: 100, status: 'success' }
      }));

      if (onComplete) onComplete();

      // Clear successfully completed item after 3.5 seconds
      setTimeout(() => {
        dismissProgress(assignmentTitle);
      }, 3500);
    } catch (err: any) {
      console.error("Global upload failed:", err);
      setUploadProgress(prev => ({
        ...prev,
        [assignmentTitle]: { ...prev[assignmentTitle], progress: 0, status: 'failed', error: err.message || 'Upload failed.' }
      }));
    }
  };

  const deleteStudentFile = async ({
    fileStringToRemove,
    assignmentTitle,
    existingSubmission,
    subjectTrueUUID,
    onComplete
  }: any) => {
    setUploadProgress(prev => ({
      ...prev,
      [assignmentTitle]: { title: assignmentTitle, progress: 30, status: 'uploading', type: 'submission_delete' }
    }));

    try {
      const { data: { user } } = await supabase.auth.getUser();

      await enqueueSubmissionAction(assignmentTitle, async () => {
        // Query the absolute latest submission from the database first
        const { data: latestSub, error: fetchErr } = await supabase
          .from('submissions')
          .select('*')
          .eq('class_id', subjectTrueUUID)
          .eq('student_id', user?.id)
          .eq('assignment_name', assignmentTitle)
          .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!latestSub) {
          throw new Error("No active submission record found to delete files from.");
        }

        const updatedUrls = latestSub.file_urls.filter((url: string) => url !== fileStringToRemove);

        if (updatedUrls.length === 0) {
          const { error: delErr } = await supabase.from('submissions').delete().eq('id', latestSub.id);
          if (delErr) throw delErr;
        } else {
          const { error: updErr } = await supabase.from('submissions').update({ file_urls: updatedUrls }).eq('id', latestSub.id);
          if (updErr) throw updErr;
        }
      });

      setUploadProgress(prev => ({
        ...prev,
        [assignmentTitle]: { ...prev[assignmentTitle], progress: 100, status: 'success' }
      }));

      if (onComplete) onComplete();

      // Clear successfully completed item after 3.5 seconds
      setTimeout(() => {
        dismissProgress(assignmentTitle);
      }, 3500);
    } catch (err: any) {
      console.error("Global delete failed:", err);
      setUploadProgress(prev => ({
        ...prev,
        [assignmentTitle]: { ...prev[assignmentTitle], progress: 0, status: 'failed', error: err.message || 'Delete failed.' }
      }));
    }
  };

  const uploadLecturerCoursework = async ({
    tempId,
    formData,
    type,
    files,
    subjectName,
    classId,
    initialData,
    onComplete
  }: any) => {
    const totalSize = files.reduce((sum: number, f: File) => sum + f.size, 0);
    const assignmentTitle = formData.title;

    setUploadProgress(prev => ({
      ...prev,
      [tempId]: { title: assignmentTitle, progress: 0, status: 'uploading', type }
    }));

    try {
      const links: string[] = [];
      let capturedFolderId = initialData?.folder_id || null;

      if (files.length > 0) {
        // 1. Fetch OAuth2 access token and root folder ID
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const tokenRes = await fetch('/api/drive/token', { headers });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || tokenData.error) {
          throw new Error(tokenData.error || 'Failed to retrieve Google Drive upload session.');
        }
        const { accessToken, parentFolderId } = tokenData;

        // Query the lecturer's own drive folder ID if defined
        let targetParentId = parentFolderId;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('drive_folder_id')
            .eq('id', user.id)
            .single();
          if (prof?.drive_folder_id) {
            targetParentId = prof.drive_folder_id;
          }
        }

        // If targetParentId is still falsy, dynamically search or create "Limkokwing Coursework" folder in the root
        if (!targetParentId) {
          try {
            const listRootRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name = 'Limkokwing Coursework' and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false")}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (listRootRes.ok) {
              const listRootData = await listRootRes.json();
              if (listRootData.files && listRootData.files.length > 0) {
                targetParentId = listRootData.files[0].id;
              }
            }
            if (!targetParentId) {
              const createRootRes = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  name: 'Limkokwing Coursework',
                  mimeType: 'application/vnd.google-apps.folder'
                })
              });
              if (createRootRes.ok) {
                const rootFolderData = await createRootRes.json();
                targetParentId = rootFolderData.id;
              }
            }
            // Save the newly resolved folder ID to the lecturer's profile
            if (targetParentId && user) {
              await supabase
                .from('profiles')
                .update({ drive_folder_id: targetParentId })
                .eq('id', user.id);
            }
          } catch (rootErr) {
            console.error("Failed to dynamically search or create root coursework folder:", rootErr);
          }
        }

        const finalSubjectName = subjectName?.trim() || 'Classroom';

        // A. Search/Create the Subject/Class Folder inside targetParentId dynamically
        let subjectFolderId = null;

        const getOrCreateSubjectFolder = async (subjId: string, parentId: string, finalSubjName: string, accToken: string) => {
          const globalCache = (typeof window !== 'undefined' ? ((window as any).__subjectFolderCache = (window as any).__subjectFolderCache || {}) : {}) as Record<string, Promise<string> | undefined>;
          
          if (globalCache[subjId]) {
            return globalCache[subjId];
          }

          const promise = (async () => {
            // 0. Try to resolve via existing materials/assignments in the database first
            try {
              const { data: mats } = await supabase
                .from('materials')
                .select('folder_id')
                .eq('class_id', subjId)
                .not('folder_id', 'is', null)
                .limit(1);
              
              let existingFolderId = mats?.[0]?.folder_id;
              
              if (!existingFolderId) {
                const { data: assigns } = await supabase
                  .from('assignments')
                  .select('folder_id')
                  .eq('class_id', subjId)
                  .not('folder_id', 'is', null)
                  .limit(1);
                existingFolderId = assigns?.[0]?.folder_id;
              }
              
              if (existingFolderId) {
                const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFolderId}?fields=parents&supportsAllDrives=true`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${accToken}`
                  }
                });
                if (metaRes.ok) {
                  const fileMeta = await metaRes.json();
                  if (fileMeta && fileMeta.parents && fileMeta.parents.length > 0) {
                    const resolvedParentId = fileMeta.parents[0];
                    console.log(`Successfully resolved existing subject folder ID from database: ${resolvedParentId}`);
                    return resolvedParentId;
                  }
                }
              }
            } catch (dbErr) {
              console.warn("Failed to check database for existing subject folder reference:", dbErr);
            }

            const parentToSearch = parentId || 'root';
            const searchQ = `mimeType = 'application/vnd.google-apps.folder' and name = '${finalSubjName.replace(/'/g, "\\'")}' and '${parentToSearch}' in parents and trashed = false`;
            const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQ)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accToken}`
              }
            });
            
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              if (searchData.files && searchData.files.length > 0) {
                return searchData.files[0].id;
              }
            } else {
              const errData = await searchRes.json().catch(() => ({}));
              if (searchRes.status === 404 || searchRes.status === 403 || errData.error?.message?.toLowerCase().includes('not found') || errData.error?.message?.toLowerCase().includes('permission')) {
                throw new Error('access_denied');
              }
            }

            // Create it if not found
            const createSubRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                name: finalSubjName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentToSearch]
              })
            });

            if (createSubRes.ok) {
              const subFolderData = await createSubRes.json();
              const subId = subFolderData.id;

              // Grant anyone reader permission
              await fetch(`https://www.googleapis.com/drive/v3/files/${subId}/permissions`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  role: 'reader',
                  type: 'anyone'
                })
              });
              return subId;
            } else {
              const errData = await createSubRes.json().catch(() => ({}));
              if (createSubRes.status === 404 || createSubRes.status === 403 || errData.error?.message?.toLowerCase().includes('not found') || errData.error?.message?.toLowerCase().includes('permission')) {
                throw new Error('access_denied');
              }
              const errText = JSON.stringify(errData);
              throw new Error(`Failed to create subject folder: ${errText}`);
            }
          })();

          globalCache[subjId] = promise;
          
          promise.catch(() => {
            delete globalCache[subjId];
          });

          return promise;
        };

        try {
          subjectFolderId = await getOrCreateSubjectFolder(classId, targetParentId, finalSubjectName, accessToken);
        } catch (e: any) {
          if (e.message === 'access_denied' && targetParentId !== parentFolderId) {
            console.warn(`Lecturer folder ${targetParentId} is inaccessible. Attempting synchronous repair...`);
            let repairedId = null;
            
            if (user) {
              try {
                const { data: p } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single();
                if (p && p.email) {
                  const autoRes = await fetch('/api/drive/setup-lecturer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lecturerName: p.full_name, lecturerEmail: p.email })
                  });
                  const autoData = await autoRes.json();
                  if (autoRes.ok && autoData.folderId) {
                    await supabase
                      .from('profiles')
                      .update({ drive_folder_id: autoData.folderId })
                      .eq('id', user.id);
                    repairedId = autoData.folderId;
                    console.log(`Successfully repaired inaccessible drive folder ID for lecturer ${p.full_name}. New folder: ${repairedId}`);
                  }
                }
              } catch (repairErr) {
                console.error("Failed to synchronously repair lecturer drive:", repairErr);
              }
            }

            if (repairedId) {
              targetParentId = repairedId;
            } else {
              targetParentId = parentFolderId;
            }

            subjectFolderId = await getOrCreateSubjectFolder(classId, targetParentId, finalSubjectName, accessToken);
          } else {
            throw e;
          }
        }

        if (subjectFolderId) {
          targetParentId = subjectFolderId;
        }

        // 2. Create coursework folder if it doesn't exist yet
        if (!capturedFolderId) {
          const folderRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: `${type}: ${formData.title.trim()}`,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [targetParentId]
            })
          });

          if (!folderRes.ok) {
            const errText = await folderRes.text();
            throw new Error(`Failed to create coursework folder in Google Drive: ${errText}`);
          }

          const folderData = await folderRes.json();
          capturedFolderId = folderData.id;
        }

        // 3. Upload attached files with progress tracking!
        let totalUploaded = 0;

        for (const f of files) {
          const metadata = {
            name: f.name,
            parents: [capturedFolderId]
          };

          const formDataPayload = new FormData();
          formDataPayload.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          formDataPayload.append('file', f);

          const uploadResult = await new Promise<{ status: number; ok: boolean; responseText: string }>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true');
            xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
            
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const fileUploaded = e.loaded;
                const currentTotal = totalUploaded + fileUploaded;
                const pct = Math.min(Math.round((currentTotal / totalSize) * 98), 98);
                setUploadProgress(prev => ({
                  ...prev,
                  [tempId]: { ...prev[tempId], progress: pct }
                }));
              }
            };

            xhr.onload = () => {
              resolve({
                status: xhr.status,
                ok: xhr.status >= 200 && xhr.status < 300,
                responseText: xhr.responseText
              });
            };

            xhr.onerror = () => {
              reject(new Error(`Network upload failed for "${f.name}".`));
            };

            xhr.send(formDataPayload);
          });

          if (!uploadResult.ok) {
            throw new Error(`File upload failed for "${f.name}" (Status ${uploadResult.status}): ${uploadResult.responseText}`);
          }

          const uploadData = JSON.parse(uploadResult.responseText);
          const fileId = uploadData.id;

          // Set anyone reader permission
          await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              role: 'reader',
              type: 'anyone'
            })
          });

          // Fetch webViewLink
          const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });

          if (!metaRes.ok) {
            throw new Error("Failed to retrieve file web link from Google Drive.");
          }

          const metaData = await metaRes.json();
          links.push(metaData.webViewLink);

          totalUploaded += f.size;
          const pct = Math.round((totalUploaded / totalSize) * 98);
          setUploadProgress(prev => ({
            ...prev,
            [tempId]: { ...prev[tempId], progress: pct }
          }));
        }
      }

      // Save to database
      const tableName = type === 'assignment' ? 'assignments' : 'materials';
      let dbError;
      let insertedId = "";

      if (initialData) {
        // Update existing item
        const updatePayload: any = {
          title: formData.title,
          description: formData.description || null,
        };
        if (links.length > 0) {
          updatePayload.file_url = initialData.file_url
            ? `${initialData.file_url}, ${links.join(', ')}`
            : links.join(', ');
        }
        if (type === 'assignment') {
          updatePayload.deadline = formData.deadline ? new Date(formData.deadline).toISOString() : null;
          updatePayload.allow_late = formData.allowLate;
        }

        const { error } = await supabase
          .from(tableName)
          .update(updatePayload)
          .eq('id', initialData.id);
        dbError = error;
        insertedId = initialData.id;
      } else {
        // Insert new item
        const payload: any = {
          class_id: classId,
          title: formData.title,
          description: formData.description || null,
          file_url: links.join(', '),
          folder_id: capturedFolderId,
          created_at: new Date().toISOString()
        };

        if (type === 'assignment') {
          payload.deadline = formData.deadline ? new Date(formData.deadline).toISOString() : null;
          payload.allow_late = formData.allowLate;
        }

        const { data: insertedData, error } = await supabase
          .from(tableName)
          .insert([payload])
          .select()
          .single();
        
        dbError = error;
        if (insertedData) {
          insertedId = insertedData.id;
        }
      }

      if (dbError) throw dbError;

      // Notify all students in this class if it's a new coursework item (not editing)
      if (!initialData) {
        try {
          const { data: mappings } = await supabase
            .from('student_classes')
            .select('student_id')
            .eq('subject_id', classId);

          if (mappings && mappings.length > 0) {
            const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            
            // Resolve Lecturer Name
            let lecturerName = "Lecturer";
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: prof } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single();
              if (prof?.full_name) {
                lecturerName = prof.full_name;
              }
            }

            const formattedDeadline = type === 'assignment' && formData.deadline
              ? new Date(formData.deadline).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
              : '';

            const message = type === 'assignment'
              ? `${lecturerName} added a new assignment: "${formData.title}" in the subject "${subjectName || 'Classroom'}"${formattedDeadline ? ` (Due: ${formattedDeadline})` : ''}.`
              : `${lecturerName} added a new material: "${formData.title}" in the subject "${subjectName || 'Classroom'}".`;

            const linkPath = `/dashboard/student/class/${classId}?select=${insertedId}`;

            const notificationsToInsert = mappings.map(m => ({
              user_id: m.student_id,
              title: type === 'assignment' ? "New Assignment Added" : "New Material Added",
              message: message,
              type: type,
              link: linkPath
            }));

            await supabase.from('notifications').insert(notificationsToInsert);
          }
        } catch (err) {
          console.error("Error creating coursework notifications:", err);
        }
      }

      // Complete successfully
      setUploadProgress(prev => ({
        ...prev,
        [tempId]: { ...prev[tempId], progress: 100, status: 'success' }
      }));

      if (onComplete) onComplete();

      // Clear successfully completed item after 3.5 seconds
      setTimeout(() => {
        dismissProgress(tempId);
      }, 3500);

    } catch (err: any) {
      console.error("Global lecturer upload failed:", err);
      setUploadProgress(prev => ({
        ...prev,
        [tempId]: { ...prev[tempId], progress: 0, status: 'failed', error: err.message || 'Unknown network error.' }
      }));
    }
  };

  return (
    <UploadContext.Provider value={{
      uploadProgress,
      setUploadProgress,
      dismissProgress,
      uploadStudentSubmission,
      deleteStudentFile,
      uploadLecturerCoursework,
      triggerHardReload,
      isReloading
    }}>
      {children}
      {isReloading && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300 max-w-xs text-center">
            <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" size={36} />
            <div>
              <h4 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest text-[9px]">Syncing Portal</h4>
              <p className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-1">Hard Reloading Resources...</p>
            </div>
          </div>
        </div>
      )}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
}
