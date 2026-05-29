import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const studentName = formData.get('studentName') as string;
    const targetFolderId = formData.get('targetFolderId') as string;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
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