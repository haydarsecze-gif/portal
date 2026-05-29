'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, FileText, BookOpen, X, Upload, Loader2, Check, RotateCcw, Cloud, Paperclip, Lock, File as FileIcon, Calendar, Clock, Trash2, MapPin, Hash, Mail, Phone, User, ExternalLink, RefreshCw, GraduationCap, AlertCircle } from 'lucide-react'
import ThemeToggle from '@/app/components/ThemeToggle'
import NotificationBell from '@/app/components/NotificationBell'
import AccountSwitcher from '@/app/components/AccountSwitcher'

const STATUS_LABELS: Record<string, string> = {
  'P': 'Present', 'L': 'Late', 'X': 'Absent', 'M': 'Medical (MC)', 'V': 'Valid Reason', 'H': 'Holiday / Break', 'N': 'Not Applicable', '--': 'Unmarked'
};

// True coordinates for Limkokwing University Cambodia Campus
const CAMPUS_LAT = 11.5692183; 
const CAMPUS_LNG = 104.9173108; 
const ALLOWED_RADIUS_METERS = 200; 

const parseSafeDate = (dateStr?: string) => {
  if (!dateStr) return null
  try {
    const safeStr = dateStr.includes(' ') && !dateStr.includes('T')
      ? dateStr.replace(' ', 'T')
      : dateStr
    const d = new Date(safeStr)
    if (isNaN(d.getTime())) return null
    return d
  } catch (e) {
    return null
  }
} 

export default function StudentClassroom() {
  const params = useParams();
  const router = useRouter();
  const classId = params?.id as string;

  const [activeTab, setActiveTab] = useState<'content' | 'attendance' | 'info'>('content');
  const [content, setContent] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [roomName, setRoomName] = useState<string>('');
  const [subjectTrueUUID, setSubjectTrueUUID] = useState<string>('');
  const [subjectStartDate, setSubjectStartDate] = useState<string | null>(null);
  const [subject, setSubject] = useState<any>(null);
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);

  const getOriginalStatus = (record: any) => {
    if (!record) return '--';
    
    // If NOT hidden from student view, return the teacher/admin overridden status directly
    if (!record.hidden_from_student) {
      return record.status || '--';
    }
    
    // Hidden: derive from check-in time
    if (!record.check_in_time) {
      return '--';
    }
    
    const checkIn = new Date(record.check_in_time);
    const startTimeStr = subject?.class_start_time || '08:00:00';
    const [startH, startM] = startTimeStr.split(':').map(Number);
    
    const classStart = new Date(checkIn.getTime());
    classStart.setHours(startH, startM, 0, 0);
    
    const diffMs = checkIn.getTime() - classStart.getTime();
    const lateMinutes = Math.floor(diffMs / (60 * 1000));
    
    if (lateMinutes <= 0) return 'P';
    if (lateMinutes >= 1 && lateMinutes <= 15) return 'L';
    return 'X';
  };

  const [isCheckingGeo, setIsCheckingGeo] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoSuccess, setGeoSuccess] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);

  const fetchClassData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      let resolvedSubjectUUID = classId;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(classId)) {
        const { data: assignmentData } = await supabase
          .from('assignments')
          .select('class_id')
          .eq('id', classId)
          .maybeSingle();

        if (assignmentData && assignmentData.class_id) {
          resolvedSubjectUUID = assignmentData.class_id;
        } else {
          const { data: subjectByName } = await supabase
            .from('subjects')
            .select('id')
            .eq('name', classId)
            .maybeSingle();
          if (subjectByName) resolvedSubjectUUID = subjectByName.id;
        }
      }

      const { data: subjectDetails } = await supabase
        .from('subjects')
        .select('id, room, name, semester, class_start_time, class_end_time, start_date, lecturer_names')
        .eq('id', resolvedSubjectUUID)
        .maybeSingle();

      setSubjectTrueUUID(resolvedSubjectUUID);
      setSubject(subjectDetails);
      setRoomName(subjectDetails?.room || 'Unassigned');
      setSubjectStartDate(subjectDetails?.start_date || null);

      if (subjectDetails) {
        const { data: existingClass } = await supabase
          .from('classes')
          .select('id')
          .eq('id', subjectDetails.id)
          .maybeSingle()

        if (!existingClass) {
          await supabase
            .from('classes')
            .insert({
              id: subjectDetails.id,
              name: subjectDetails.name || 'Unassigned',
              subject_name: subjectDetails.name || 'Unassigned',
              semester: subjectDetails.semester || 1,
              room: subjectDetails.room || 'Unassigned',
              start_time: subjectDetails.class_start_time || '08:00:00',
              end_time: subjectDetails.class_end_time || '11:30:00',
              class_date: subjectDetails.start_date || new Date().toISOString().split('T')[0]
            })
        }
      }

      const [assignments, materials, subData, profData, attData] = await Promise.all([
        supabase.from('assignments').select('*').eq('class_id', resolvedSubjectUUID),
        supabase.from('materials').select('*').eq('class_id', resolvedSubjectUUID),
        supabase.from('submissions').select('*').eq('class_id', resolvedSubjectUUID).eq('student_id', user.id),
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('attendance').select('week, status, check_in_time, hidden_from_student').eq('class_id', resolvedSubjectUUID).eq('student_id', user.id).order('week', { ascending: true })
      ]);

      setProfile(profData.data);

      if (profData.data && profData.data.role === 'student') {
        const { data: existingStudent } = await supabase
          .from('students')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        if (!existingStudent) {
          await supabase.from('students').insert({
            id: user.id,
            name: profData.data.full_name,
            email: user.email,
            class_id: profData.data.class_id
          })
        }
      }
      setSubmissions(subData.data || []);
      setStudentAttendance(attData.data || []);
      
      setContent([
        ...(assignments.data || []).map((x: any) => ({ ...x, type: 'assignment' })),
        ...(materials.data || []).map((x: any) => ({ ...x, type: 'material' }))
      ].sort((a, b) => {
        const timeB = parseSafeDate(b.created_at)?.getTime() || 0
        const timeA = parseSafeDate(a.created_at)?.getTime() || 0
        return timeB - timeA
      }));
    } catch (err: any) {
      console.error("Sync Failure in classroom loader:", err.message);
    } finally {
      setLoading(false);
    }
  }, [classId, router]);

  useEffect(() => { if (classId) fetchClassData(); }, [classId, fetchClassData]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const handleCampusCheckIn = async () => {
    setIsCheckingGeo(true);
    setGeoError(null);
    setGeoSuccess(false);
    setAlreadyCheckedIn(false);
    setCheckInMessage(null);

    const now = new Date();
    const startTimeStr = subject?.class_start_time || '08:00:00';
    const endTimeStr = subject?.class_end_time || '11:30:00';

    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);

    const classStart = new Date(now.getTime());
    classStart.setHours(startH, startM, 0, 0);

    const classEnd = new Date(now.getTime());
    classEnd.setHours(endH, endM, 0, 0);

    const allowedStart = new Date(classStart.getTime() - 15 * 60 * 1000);

    if (now < allowedStart) {
      const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setGeoError(`Check-In Not Opened: Class starts at ${formatTime(classStart)}. You can check in starting 15 minutes before class (at ${formatTime(allowedStart)}).`);
      setIsCheckingGeo(false);
      return;
    }

    if (now > classEnd) {
      setGeoError("Class has ended. Check-in is no longer allowed.");
      setIsCheckingGeo(false);
      return;
    }

    if (!navigator.geolocation) {
      setGeoError("Geolocation tracking services are unsupported by this browser.");
      setIsCheckingGeo(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const distance = calculateDistance(userLat, userLng, CAMPUS_LAT, CAMPUS_LNG);

        if (distance > ALLOWED_RADIUS_METERS) {
          setGeoError(`Verification Failed: You must be physically on campus (Detected: ${Math.round(distance)}m away).`);
          setIsCheckingGeo(false);
          return;
        }

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Authentication dropped");

          let targetWeek = studentAttendance.length < 17 ? studentAttendance.length + 1 : 17;
          if (subjectStartDate) {
            const startDate = new Date(subjectStartDate);
            const today = new Date();
            const diffTime = today.getTime() - startDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const currentWeek = Math.floor(diffDays / 7) + 1;
            targetWeek = Math.min(Math.max(currentWeek, 1), 17);
          }

          const nowCheckIn = new Date();
          const diffMs = nowCheckIn.getTime() - classStart.getTime();
          const lateMinutes = Math.floor(diffMs / (60 * 1000));

          let checkInStatus = 'P';
          let checkInMsg = '';

          if (lateMinutes <= 0) {
            checkInStatus = 'P';
            checkInMsg = "Check-In Verified! You checked in on time. Attendance recorded successfully.";
          } else if (lateMinutes >= 1 && lateMinutes <= 15) {
            checkInStatus = 'L';
            checkInMsg = `Check-In Verified! You checked in at ${nowCheckIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. You are ${lateMinutes} ${lateMinutes === 1 ? 'minute' : 'minutes'} late. You have been marked as Late (L). Please try to come faster next time.`;
          } else {
            checkInStatus = 'X';
            checkInMsg = `Check-In Verified! You checked in at ${nowCheckIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. You are ${lateMinutes} minutes late. You have been marked as Absent (X). Please try to come faster next time.`;
          }

          const { error: insertErr } = await supabase
            .from('attendance')
            .insert({
              class_id: subjectTrueUUID,
              student_id: user.id,
              week: targetWeek,
              status: checkInStatus,
              check_in_time: nowCheckIn.toISOString()
            });

          if (insertErr) {
            if (insertErr.code === '23505' || insertErr.message?.includes('duplicate') || insertErr.message?.includes('Conflict')) {
              setAlreadyCheckedIn(true);
            } else if (insertErr.code === '23503') {
              setGeoError("System Error: Invalid Class ID.");
            } else {
              throw insertErr;
            }
          } else {
            setCheckInMessage(checkInMsg);
            setGeoSuccess(true);
          }

          fetchClassData(); 
        } catch (err: any) {
          setGeoError("Database issue: " + err.message);
        } finally {
          setIsCheckingGeo(false);
        }
      },
      (error) => {
        let msg = "GPS Signal blocked. Ensure location tracking permissions are granted to this site.";
        if (error.code === 1) {
          msg = "Location permission denied. Please enable location permissions for this app/site in settings.";
        } else if (error.code === 2) {
          msg = "GPS/Location signal unavailable. Please ensure your device's location services (GPS) are turned ON.";
        } else if (error.code === 3) {
          msg = "Location request timed out. Please try checking in again from an open area.";
        }
        setGeoError(msg);
        setIsCheckingGeo(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const closeModal = () => { setSelectedItem(null); setShowSuccess(false); setSelectedFiles([]); setIsResubmitting(false); };

  const turnInAssignment = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const studentName = profile?.full_name || "Student";

      const uploadedLinks = [];
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

      for (const file of selectedFiles) {
        // 1. Prepare Google Drive folder and get resumable session URL via server (100-byte body)
        const res = await fetch('/api/drive/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName,
            targetFolderId: selectedItem.folder_id,
            fileName: file.name,
            fileType: file.type || 'application/octet-stream',
            fileSize: file.size
          })
        });
        const responseText = await res.text();
        let initData;
        try {
          initData = JSON.parse(responseText);
        } catch (jsonErr) {
          throw new Error(`Google Drive resumable upload initialization failed (Status ${res.status}): ${responseText.substring(0, 150)}`);
        }
        if (initData.error) throw new Error(initData.error);

        const { uploadUrl, studentFolderId, accessToken } = initData;

        // 2. Upload file in chunks (BYPASSES ALL PAYLOAD AND MEMORY LIMITS!)
        let uploadedBytes = 0;
        const totalBytes = file.size;

        while (uploadedBytes < totalBytes) {
          const chunkEnd = Math.min(uploadedBytes + CHUNK_SIZE, totalBytes);
          const chunkBlob = file.slice(uploadedBytes, chunkEnd);
          const chunkSize = chunkBlob.size;

          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Length': String(chunkSize),
              'Content-Range': `bytes ${uploadedBytes}-${chunkEnd - 1}/${totalBytes}`
            },
            body: chunkBlob
          });

          if (uploadRes.status === 308) {
            // Intermediate chunk uploaded successfully!
            uploadedBytes = chunkEnd;
          } else if (uploadRes.ok) {
            // Final chunk uploaded successfully!
            const uploadData = await uploadRes.json();
            const fileId = uploadData.id;

            // Set permission to anyone reader
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
            });

            if (!permRes.ok) {
              console.error("Direct permission set failed for file", fileId);
            }

            // Fetch file webViewLink
            const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink,name`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            });

            if (!metaRes.ok) {
              throw new Error("Failed to retrieve uploaded file web link from Google Drive.");
            }

            const fileMeta = await metaRes.json();
            uploadedLinks.push(`${fileMeta.name}:::${fileMeta.webViewLink}`);
            uploadedBytes = totalBytes; // Complete
          } else {
            const errText = await uploadRes.text();
            throw new Error(`Chunk upload failed at byte ${uploadedBytes} (Status ${uploadRes.status}): ${errText}`);
          }
        }
      }


      // 3. Save to database
      const existingSubmission = getSub(selectedItem.title);
      let finalLinks = uploadedLinks;
      if (existingSubmission && existingSubmission.file_urls) {
        finalLinks = [...existingSubmission.file_urls, ...uploadedLinks];
      }

      const { error: submitErr } = await supabase.from('submissions').upsert({
        id: existingSubmission?.id, // Fix: Include primary key ID to update the existing row rather than inserting duplicate records
        class_id: subjectTrueUUID,
        student_id: user?.id,
        assignment_name: selectedItem.title,
        file_urls: finalLinks,
        submitted_at: new Date().toISOString(),
      });

      if (submitErr) throw submitErr;

      // Notify lecturers about the new assignment submission
      try {
        const { data: lecturers } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'teacher')
          .in('full_name', subject?.lecturer_names || [])

        if (lecturers && lecturers.length > 0) {
          const notificationsToInsert = lecturers.map(lec => ({
            user_id: lec.id,
            title: "New Assignment Submission",
            message: `${studentName} submitted the assignment "${selectedItem.title}" in ${subject?.name || "Classroom"}.`,
            type: "submission"
          }))

          const { error: notifErr } = await supabase
            .from('notifications')
            .insert(notificationsToInsert)

          if (notifErr) {
            console.error("Failed to insert lecturer notifications:", notifErr)
          }
        }
      } catch (err) {
        console.error("Error creating submission notifications:", err)
      }

      setShowSuccess(true);
      setSelectedFiles([]);
      setIsResubmitting(false);
      fetchClassData();
    } catch (err: any) { alert(err.message); } finally { setUploading(false); }
  };

  const handleRemoveExistingFile = async (fileStringToRemove: string) => {
    if (!confirm("Are you sure you want to delete this submitted file?")) return;
    const { data: { user } } = await supabase.auth.getUser();
    const activeSub = getSub(selectedItem.title);
    if (!activeSub) return;

    const updatedUrls = activeSub.file_urls.filter((url: string) => url !== fileStringToRemove);

    if (updatedUrls.length === 0) {
      await supabase.from('submissions').delete().eq('id', activeSub.id); // Fix: Delete precisely by primary key ID
    } else {
      await supabase.from('submissions').update({ file_urls: updatedUrls }).eq('id', activeSub.id); // Fix: Update precisely by primary key ID
    }
    fetchClassData();
  };

  const getSub = (title: string) => submissions.find(s => s.assignment_name === title);
  
  const checkStatus = (item: any) => {
    const deadline = parseSafeDate(item.deadline);
    const sub = getSub(item.title);
    const subDate = sub ? parseSafeDate(sub.submitted_at) : null;
    return {
      isPastDeadline: deadline ? new Date() > deadline : false,
      isLate: (subDate && deadline) ? subDate > deadline : false,
      formattedDeadline: deadline ? deadline.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No Deadline',
      formattedSubDate: subDate ? subDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null
    };
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-indigo-600 mb-2" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Classroom Data...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-8 md:p-10 font-sans select-none animate-in fade-in duration-300">
      <div className="w-full max-w-[1600px] mx-auto">
        
        {/* Header Section */}
        <header className="mb-8 flex flex-col gap-4">
          {/* Compact Top Bar */}
          <div className="flex justify-between items-center w-full">
            <button 
              onClick={() => router.push('/dashboard/student')} 
              className="flex items-center gap-2 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-black text-[9px] uppercase tracking-widest transition duration-300 cursor-pointer"
            >
              <ArrowLeft size={12} /> Back to Dashboard
            </button>

            <div className="flex items-center gap-2">
              <AccountSwitcher />
              <NotificationBell />
              <ThemeToggle />
              <button 
                onClick={fetchClassData} 
                disabled={loading}
                className="p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center"
              >
                <RefreshCw size={14} className={loading ? "animate-spin text-indigo-600" : ""} />
              </button>
            </div>
          </div>

          {/* Subject Title and Badges */}
          <div className="flex flex-col gap-2 mt-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 uppercase leading-tight flex items-center gap-3">
              <GraduationCap className="text-indigo-600 shrink-0" size={24} />
              {subject?.name || 'Classroom'}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                Room {subject?.room || 'N/A'}
              </span>
              <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                Sem {subject?.semester || 'N/A'}
              </span>
            </div>
          </div>
        </header>

        {/* Tab Navigation Pill Bar */}
        <nav className="flex w-full bg-white p-1 rounded-2xl border border-slate-100 shadow-sm mb-10 overflow-x-auto custom-scrollbar whitespace-nowrap">
          {[
            { id: 'content', label: 'Coursework' },
            { id: 'attendance', label: 'My Attendance' },
            { id: 'info', label: 'Class Info' }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)} 
              className={`shrink-0 flex-1 sm:flex-none py-3 px-4 sm:px-6 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all cursor-pointer ${
                activeTab === tab.id 
                  ? 'bg-slate-900 text-white shadow' 
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab 1: Coursework */}
        {activeTab === 'content' && (
          <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {content.length > 0 ? content.map(item => {
              const hasSub = getSub(item.title);
              return (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedItem(item)} 
                  className="bg-white p-6 rounded-[2rem] border border-slate-100/80 flex justify-between items-center cursor-pointer hover:border-indigo-200 transition-all duration-300 hover:shadow-lg shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      item.type === 'assignment' 
                        ? (hasSub ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600') 
                        : 'bg-indigo-50 text-indigo-600'
                    }`}>
                      {item.type === 'assignment' ? <FileText size={22} /> : <BookOpen size={22} />}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-base uppercase tracking-tight leading-tight">{item.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                        <span className={`text-[9px] font-black uppercase tracking-widest ${
                          item.type === 'assignment' ? 'text-amber-500' : 'text-indigo-500'
                        }`}>
                          {item.type}
                        </span>
                        {item.type === 'assignment' && (
                          <>
                            <span className="text-slate-300 text-[9px] font-bold">•</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                              Due: {checkStatus(item).formattedDeadline}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {hasSub && (
                    <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-emerald-100 shrink-0">
                      <Check size={11} strokeWidth={4}/> Done
                    </div>
                  )}
                </div>
              )
            }) : (
              <div className="bg-white py-20 text-center rounded-[2.5rem] border-2 border-dashed border-slate-100">
                <FileText className="mx-auto text-slate-200 mb-4" size={40} />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No coursework files uploaded yet.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Attendance */}
        {activeTab === 'attendance' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
            
            {/* Campus check-in component */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100/80 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="space-y-1 flex-1">
                <h4 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 text-base">
                  <MapPin size={18} className="text-indigo-600 animate-pulse" /> Campus Geolocation Check-In
                </h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Assigned Target: <span className="text-indigo-600">Room {roomName}</span>
                </p>
                <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-xl max-w-xl mt-3 flex items-start gap-2.5">
                  <div className="bg-amber-500/10 p-1.5 rounded-lg text-amber-600 shrink-0 mt-0.5 animate-pulse">
                    <AlertCircle size={12} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-amber-700 tracking-wider">Required Location Settings</p>
                    <p className="text-[10px] font-bold text-amber-600 leading-normal mt-0.5">
                      When your system prompts, you **must** select <span className="underline font-black">Precise (Exact Location)</span> and choose <span className="underline font-black">Allow while visiting the site</span>. Choosing "Approximate" will fail the 200m campus verification.
                    </p>
                  </div>
                </div>

                {geoError && (
                  <p className="text-xs font-bold text-red-500 bg-red-50/50 p-3 rounded-xl border border-red-100 max-w-xl mt-4 leading-relaxed">
                    ❌ {geoError}
                  </p>
                )}
                {geoSuccess && checkInMessage && (
                  <p className={`text-xs font-bold p-3 rounded-xl border mt-4 leading-relaxed ${
                    checkInMessage.includes('Absent') 
                      ? 'text-red-600 bg-red-50/50 border-red-100' 
                      : checkInMessage.includes('Late') 
                        ? 'text-amber-700 bg-amber-50/50 border-amber-100' 
                        : 'text-emerald-600 bg-emerald-50/50 border-emerald-100'
                  }`}>
                    {checkInMessage}
                  </p>
                )}
                {alreadyCheckedIn && (
                  <p className="text-xs font-bold text-indigo-600 bg-indigo-50/30 p-3 rounded-xl border border-indigo-100 max-w-xl mt-4 leading-relaxed">
                    ℹ️ You are already checked in for the active academic week slot!
                  </p>
                )}
              </div>
              
              <button
                type="button"
                disabled={isCheckingGeo}
                onClick={handleCampusCheckIn}
                className="w-full lg:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 disabled:from-slate-100 disabled:to-slate-100 text-white disabled:text-slate-400 px-8 py-4.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-500/10 active:scale-95 transition-all duration-300 shrink-0 cursor-pointer"
              >
                {isCheckingGeo ? (
                  <><Loader2 size={12} className="animate-spin" /> Verifying Connection...</>
                ) : (
                  <><MapPin size={12} /> Check In Attendance</>
                )}
              </button>
            </div>

            {/* Attendance matrix blocks */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100/80 shadow-sm">
              <h3 className="font-black text-base text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600" /> Attendance Matrix Logs
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 17 }, (_, i) => i + 1).map(week => {
                  const record = studentAttendance.find(r => r.week === week);
                  const statusCode = getOriginalStatus(record);
                  
                  let cardStyles = "bg-slate-50/40 border-slate-100 text-slate-400";
                  let badgeStyles = "bg-slate-100 text-slate-500";
                  
                  if (statusCode === 'P') {
                    cardStyles = "bg-emerald-50/30 border-emerald-100/80 text-emerald-700";
                    badgeStyles = "bg-emerald-100 text-emerald-700";
                  } else if (statusCode === 'L') {
                    cardStyles = "bg-amber-50/30 border-amber-100/80 text-amber-700";
                    badgeStyles = "bg-amber-100 text-amber-700";
                  } else if (statusCode === 'X') {
                    cardStyles = "bg-red-50/30 border-red-100/80 text-red-600";
                    badgeStyles = "bg-red-100 text-red-600";
                  } else if (statusCode !== '--') {
                    cardStyles = "bg-indigo-50/30 border-indigo-100/80 text-indigo-700";
                    badgeStyles = "bg-indigo-100 text-indigo-700";
                  }

                  return (
                    <div key={week} className={`p-5 border-2 rounded-3xl flex items-center justify-between shadow-xs transition-all duration-300 hover:shadow-md ${cardStyles}`}>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Week {week}</p>
                        <p className="text-xs font-black uppercase mt-1 tracking-tight leading-tight">{STATUS_LABELS[statusCode] || 'Unmarked'}</p>
                      </div>
                      <span className={`text-xs font-black tracking-tighter w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-current/10 ${badgeStyles}`}>
                        {statusCode}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}

        {/* Tab 3: Class Info */}
        {activeTab === 'info' && (() => {
          let lecturerName = 'Lecturer Unassigned';
          let lecturerEmail = 'N/A';
          let lecturerPhone = 'N/A';
          
          if (subject && Array.isArray(subject.lecturer_names)) {
            subject.lecturer_names.forEach((item: string) => {
              if (item.startsWith('email:')) {
                lecturerEmail = item.substring(6);
              } else if (item.startsWith('phone:')) {
                lecturerPhone = item.substring(6);
              } else {
                lecturerName = item;
              }
            });
          } else if (subject && typeof subject.lecturer_names === 'string') {
            lecturerName = subject.lecturer_names;
          }

          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
              
              {/* Left Column: Metadata */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100/80 shadow-sm space-y-6">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">Course Metadata</h4>
                
                <div className="space-y-4">
                  <div className="p-5 bg-slate-50/50 rounded-2xl flex items-center gap-4 border border-transparent hover:border-indigo-100 transition-colors duration-300">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                      <Hash size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Subject Name</p>
                      <p className="text-sm font-black text-slate-800 mt-0.5 uppercase tracking-tight">{subject?.name || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-slate-50/50 rounded-2xl flex items-center gap-4 border border-transparent hover:border-indigo-100 transition-colors duration-300">
                      <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Semester</p>
                        <p className="text-sm font-black text-slate-800 mt-0.5 uppercase tracking-tight">Sem {subject?.semester || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="p-5 bg-slate-50/50 rounded-2xl flex items-center gap-4 border border-transparent hover:border-indigo-100 transition-colors duration-300">
                      <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                        <MapPin size={18} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Room</p>
                        <p className="text-sm font-black text-slate-800 mt-0.5 uppercase tracking-tight">Room {subject?.room || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 bg-slate-50/50 rounded-2xl flex items-center gap-4 border border-transparent hover:border-indigo-100 transition-colors duration-300">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Start Date</p>
                      <p className="text-sm font-black text-slate-800 mt-0.5">
                        {subject?.start_date && parseSafeDate(subject.start_date) ? parseSafeDate(subject.start_date)!.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Faculty */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100/80 shadow-sm space-y-6">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">Lecturer & Timing</h4>
                
                <div className="space-y-4">
                  <div className="p-5 bg-slate-50/50 rounded-2xl flex items-center gap-4 border border-transparent hover:border-indigo-100 transition-colors duration-300">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Lecturer Name</p>
                      <p className="text-sm font-black text-slate-800 mt-0.5 uppercase tracking-tight">{lecturerName}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-slate-50/50 rounded-2xl flex items-center gap-4 border border-transparent hover:border-indigo-100 transition-colors duration-300 overflow-hidden">
                      <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center shrink-0">
                        <Mail size={18} />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Email Address</p>
                        <p className="text-xs font-bold text-slate-855 mt-0.5 truncate" title={lecturerEmail}>{lecturerEmail}</p>
                      </div>
                    </div>

                    <div className="p-5 bg-slate-50/50 rounded-2xl flex items-center gap-4 border border-transparent hover:border-indigo-100 transition-colors duration-300">
                      <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center shrink-0">
                        <Phone size={18} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Phone Number</p>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">{lecturerPhone}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-slate-50/50 rounded-2xl flex items-center gap-4 border border-transparent hover:border-indigo-100 transition-colors duration-300">
                      <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                        <Clock size={18} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Start Time</p>
                        <p className="text-sm font-black text-slate-800 mt-0.5">{subject?.class_start_time || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="p-5 bg-slate-50/50 rounded-2xl flex items-center gap-4 border border-transparent hover:border-indigo-100 transition-colors duration-300">
                      <div className="w-10 h-10 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center shrink-0">
                        <Clock size={18} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">End Time</p>
                        <p className="text-sm font-black text-slate-800 mt-0.5">{subject?.class_end_time || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          );
        })()}
      </div>

      {/* Assignment Submission Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[999] p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 relative shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-200 border border-slate-100">
            <button onClick={closeModal} className="absolute top-8 right-8 text-slate-400 hover:text-slate-800 transition duration-300 cursor-pointer"><X size={20}/></button>
            
            {showSuccess ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100"><Check size={28} strokeWidth={3}/></div>
                <h2 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tight">File Synced</h2>
                <button onClick={closeModal} className="bg-slate-900 text-white w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest cursor-pointer shadow-lg active:scale-95 transition-all">Close Modal</button>
              </div>
            ) : (() => {
              const status = checkStatus(selectedItem);
              const hasSubmission = getSub(selectedItem.title);
              const isLocked = status.isPastDeadline && !selectedItem.allow_late && !hasSubmission;

              return (
                <>
                  <div className="mb-6">
                    <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-100">{selectedItem.type}</span>
                    <h2 className="text-xl font-black text-slate-900 mt-3 tracking-tight uppercase">{selectedItem.title}</h2>
                    
                    {selectedItem.type === 'assignment' && (
                      <div className="flex items-center gap-1.5 text-slate-400 mt-2 font-bold text-[10px] uppercase tracking-widest">
                        <Clock size={12} className="text-slate-300" />
                        <span>Deadline: {status.formattedDeadline}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-3xl p-6 mb-6 border border-slate-100/80">
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">{selectedItem.description || "No specific instructions provided."}</p>
                    {selectedItem.file_url && (
                      <a href={selectedItem.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-white w-fit px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-xs hover:border-indigo-400 transition-colors">
                        <Paperclip size={13} className="text-indigo-500" />
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Lecturer File Attachment</span>
                      </a>
                    )}
                  </div>
                  
                  {selectedItem.type === 'assignment' && (
                    <div className="pt-6 border-t border-slate-100 space-y-4">
                      {isLocked ? (
                        <div className="text-center p-6 bg-red-50/50 rounded-2xl border border-red-100">
                          <Lock size={20} className="mx-auto text-red-500 mb-2"/>
                          <p className="text-red-600 font-black text-[10px] uppercase tracking-widest">Late Submissions Closed</p>
                        </div>
                      ) : (
                        <>
                          {hasSubmission && (
                            <div className="space-y-3 animate-in fade-in">
                              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <div className="text-left">
                                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Submitted On</p>
                                  <p className="text-xs font-bold text-slate-600 mt-0.5">{status.formattedSubDate}</p>
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${
                                  status.isLate 
                                    ? 'bg-red-50 border-red-100 text-red-500' 
                                    : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                }`}>
                                  {status.isLate ? 'Late Submission' : 'On Time'}
                                </span>
                              </div>

                              <div className="grid gap-2">
                                {hasSubmission.file_urls?.map((combined: string, i: number) => {
                                  const [filename, url] = combined.includes(':::') ? combined.split(':::') : [`File ${i+1}`, combined];
                                  return (
                                    <div key={i} className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-slate-200 group shadow-xs">
                                      <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 overflow-hidden flex-1 mr-2 text-slate-700 hover:text-indigo-600 transition-colors">
                                        <FileIcon size={14} className="text-indigo-500 shrink-0"/>
                                        <span className="text-[10px] font-black truncate">{filename}</span>
                                      </a>
                                      <div className="flex items-center gap-2">
                                        <a href={url} target="_blank" rel="noreferrer"><Cloud size={14} className="text-slate-300 hover:text-indigo-500 transition-colors" /></a>
                                        <button type="button" onClick={() => handleRemoveExistingFile(combined)} className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer">
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {(!hasSubmission || isResubmitting) ? (
                            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-200">
                              <div className="grid gap-2">
                                {selectedFiles.map((f, i) => (
                                  <div key={i} className="flex justify-between items-center px-4 py-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-[10px] font-black text-indigo-700">
                                    <span className="truncate">{f.name}</span>
                                    <button onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-red-500 cursor-pointer"><X size={14}/></button>
                                  </div>
                                ))}
                              </div>
                              
                              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 h-28 rounded-[2rem] cursor-pointer hover:bg-indigo-50/30 hover:border-indigo-400 group transition-all duration-300">
                                <Upload className="text-slate-300 mb-1 group-hover:text-indigo-600 transition-colors duration-300" size={22}/>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Choose Local Files</span>
                                <span className="text-[7.5px] font-bold text-slate-300 group-hover:text-indigo-400 uppercase tracking-wider mt-0.5 transition-colors">Max upload size: 2GB per file</span>
                                <input 
                                  type="file" 
                                  multiple 
                                  className="hidden" 
                                  onChange={(e) => {
                                    const filesArray = Array.from(e.target.files || []);
                                    const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
                                    for (const file of filesArray) {
                                      if (file.size > MAX_SIZE) {
                                        alert(`File "${file.name}" exceeds the maximum 2GB size limit.`);
                                        return;
                                      }
                                    }
                                    setSelectedFiles(prev => [...prev, ...filesArray]);
                                  }} 
                                  disabled={uploading} 
                                />
                              </label>

                              <div className="flex gap-2.5 pt-2">
                                {hasSubmission && (
                                  <button type="button" onClick={() => { setIsResubmitting(false); setSelectedFiles([]); }} className="flex-1 bg-white border border-slate-200 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer">Cancel</button>
                                )}
                                <button onClick={turnInAssignment} disabled={uploading || selectedFiles.length === 0} className="flex-1 bg-indigo-600 disabled:bg-slate-100 text-white disabled:text-slate-300 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition flex items-center justify-center shadow-lg hover:shadow-indigo-500/10 cursor-pointer">
                                  {uploading ? <Loader2 className="animate-spin" size={14}/> : "Sync to Drive"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setIsResubmitting(true)} className="w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white py-4.5 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-md cursor-pointer">
                              <RotateCcw size={12}/> Resubmit Assignment / Upload Files
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}