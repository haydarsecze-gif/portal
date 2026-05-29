import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60; // Allow up to 60 seconds for Google Drive attachments during edits to complete safely

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Required for server-side updates
);

export async function PATCH(req: Request) {
  try {
    const formData = await req.formData();
    const id = formData.get('id') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const folderId = formData.get('folder_id') as string;
    const file = formData.get('file') as File | null;

    let fileUrl = formData.get('existing_file_url') as string;

    if (file && file.size > 0) {
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

      const buffer = Buffer.from(await file.arrayBuffer());
      const res = await drive.files.create({
        requestBody: { name: `[LECTURER] ${file.name}`, parents: [folderId] },
        media: { mimeType: file.type, body: Readable.from(buffer) },
        fields: 'webViewLink',
      });
      fileUrl = res.data.webViewLink!;
    }

    const { error } = await supabase
      .from('assignments')
      .update({ title, description, file_url: fileUrl })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}