import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';

export const maxDuration = 60; // Allow up to 60 seconds for file uploads to Google Drive to complete safely

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const studentName = formData.get('studentName') as string;
    const targetFolderId = formData.get('targetFolderId') as string;

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

    if (studentFolderId) {
      const existingFiles = await drive.files.list({
        q: `'${studentFolderId}' in parents and trashed = false`,
        fields: 'files(id)',
      });
      if (existingFiles.data.files) {
        for (const file of existingFiles.data.files) {
          await drive.files.update({ fileId: file.id!, requestBody: { trashed: true } });
        }
      }
    } else {
      const folderRes = await drive.files.create({
        requestBody: { name: studentName, mimeType: 'application/vnd.google-apps.folder', parents: [targetFolderId] },
        fields: 'id',
      });
      studentFolderId = folderRes.data.id!;
    }

    // 2. Upload and pack Name + URL
    const links = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const res = await drive.files.create({
        requestBody: { name: file.name, parents: [studentFolderId!] },
        media: { mimeType: file.type, body: Readable.from(buffer) },
        fields: 'id, webViewLink, name',
      });

      await drive.permissions.create({
        fileId: res.data.id!,
        requestBody: { role: 'reader', type: 'anyone' }
      });

      // PACKING: filename:::url
      links.push(`${res.data.name}:::${res.data.webViewLink}`);
    }

    return NextResponse.json({ links });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}