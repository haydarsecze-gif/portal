import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export const maxDuration = 60; // Allow up to 60 seconds for file uploads to Google Drive to complete safely

async function resolveLecturerCredentials(targetFolderId: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // 1. Try to find in assignments
    const { data: assignment } = await supabase
      .from('assignments')
      .select('class_id')
      .eq('folder_id', targetFolderId)
      .maybeSingle();

    let classId = assignment?.class_id;

    // 2. If not found in assignments, try materials
    if (!classId) {
      const { data: material } = await supabase
        .from('materials')
        .select('class_id')
        .eq('folder_id', targetFolderId)
        .maybeSingle();
      classId = material?.class_id;
    }

    if (classId) {
      // 3. Find the teacher from the classes table
      const { data: classRecord } = await supabase
        .from('classes')
        .select('teacher_id')
        .eq('id', classId)
        .maybeSingle();

      if (classRecord?.teacher_id) {
        // 4. Retrieve the lecturer's profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('google_refresh_token, drive_folder_id')
          .eq('id', classRecord.teacher_id)
          .maybeSingle();

        if (profile && profile.google_refresh_token) {
          return {
            refreshToken: profile.google_refresh_token,
            parentFolderId: profile.drive_folder_id
          };
        }
      }
    }
  } catch (err) {
    console.error('Error resolving lecturer credentials:', err);
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { studentName, targetFolderId, fileName, fileType, fileSize } = await req.json();

    let clientId = process.env.GOOGLE_CLIENT_ID || '';
    if (clientId.startsWith("'") || clientId.startsWith('"')) {
      clientId = clientId.substring(1, clientId.length - 1);
    }
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    if (clientSecret.startsWith("'") || clientSecret.startsWith('"')) {
      clientSecret = clientSecret.substring(1, clientSecret.length - 1);
    }

    // Dynamic credentials lookup
    let refreshToken = '';
    const lecturerCreds = await resolveLecturerCredentials(targetFolderId);
    if (lecturerCreds && lecturerCreds.refreshToken) {
      refreshToken = lecturerCreds.refreshToken;
    } else {
      refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';
      if (refreshToken.startsWith("'") || refreshToken.startsWith('"')) {
        refreshToken = refreshToken.substring(1, refreshToken.length - 1);
      }
    }

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Google Drive API configuration error: OAuth2 credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) are missing on the server. Please check your Vercel deployment variables.');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // 1. Find or Create Student Folder
    const listResponse = await drive.files.list({
      q: `name = '${studentName}' and '${targetFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id)',
    });

    let studentFolderId = listResponse.data.files?.[0]?.id;

    if (!studentFolderId) {
      const folderRes = await drive.files.create({
        requestBody: { name: studentName, mimeType: 'application/vnd.google-apps.folder', parents: [targetFolderId] },
        fields: 'id',
      });
      studentFolderId = folderRes.data.id!;
    }

    // 2. Fetch a fresh temporary Access Token
    const { token } = await oauth2Client.getAccessToken();
    if (!token) {
      throw new Error('Failed to retrieve access token from Google.');
    }

    // 3. Initiate Google Resumable Upload Session
    const reqHost = req.headers.get('host');
    const requestOrigin = req.headers.get('origin') || (reqHost ? (reqHost.includes('localhost') ? `http://${reqHost}` : `https://${reqHost}`) : 'https://portal-three-blond.vercel.app');

    const initHeaders: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': fileType || 'application/octet-stream',
      'X-Upload-Content-Length': String(fileSize)
    };
    if (requestOrigin) {
      initHeaders['Origin'] = requestOrigin;
    }

    const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: initHeaders,
      body: JSON.stringify({
        name: fileName,
        parents: [studentFolderId]
      })
    });

    if (!initRes.ok) {
      const errText = await initRes.text();
      throw new Error(`Google Resumable Upload initiation failed: ${errText}`);
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('Google did not return a resumable upload Location URI.');
    }

    return NextResponse.json({ uploadUrl, studentFolderId, accessToken: token });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}