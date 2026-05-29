import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { createClient } from '@supabase/supabase-js';

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
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET
      );
      oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
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