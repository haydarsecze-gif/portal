import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { lecturerName, lecturerEmail, folderId } = await req.json();

    if (!lecturerEmail) {
      return NextResponse.json({ error: 'Lecturer email is required' }, { status: 400 });
    }

    let clientId = process.env.GOOGLE_CLIENT_ID || '';
    if (clientId.startsWith("'") || clientId.startsWith('"')) {
      clientId = clientId.substring(1, clientId.length - 1);
    }
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    if (clientSecret.startsWith("'") || clientSecret.startsWith('"')) {
      clientSecret = clientSecret.substring(1, clientSecret.length - 1);
    }
    let refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';
    if (refreshToken.startsWith("'") || refreshToken.startsWith('"')) {
      refreshToken = refreshToken.substring(1, refreshToken.length - 1);
    }
    const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';

    if (!clientId || !clientSecret || !refreshToken) {
      return NextResponse.json({ error: 'Google OAuth2 credentials missing on server.' }, { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    let targetFolderId = folderId;

    if (!targetFolderId) {
      // 1. Create a new folder named after the lecturer inside the parent root folder
      const folderName = `Lecturer - ${lecturerName || 'Unnamed'}`;
      const folderRes = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId]
        },
        fields: 'id'
      });
      targetFolderId = folderRes.data.id;
    }

    // 2. Share the folder with the lecturer's email address as writer (editor)
    // We swallow errors here if the email is invalid or has sharing restrictions (e.g. non-Google accounts)
    try {
      await drive.permissions.create({
        fileId: targetFolderId,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: lecturerEmail.trim().toLowerCase()
        },
        sendNotificationEmail: true
      });
    } catch (permErr: any) {
      console.warn(`Could not share folder ${targetFolderId} with ${lecturerEmail}:`, permErr.message || permErr);
    }

    return NextResponse.json({ folderId: targetFolderId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
