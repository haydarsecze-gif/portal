import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const userId = searchParams.get('state'); // Passed userId as state

  if (!code || !userId) {
    const loginErrorUrl = new URL('/dashboard/lecturer', request.url);
    loginErrorUrl.searchParams.set('drive_connected', 'false');
    loginErrorUrl.searchParams.set('error', 'Missing code or state parameters.');
    return NextResponse.redirect(loginErrorUrl.toString());
  }

  try {
    let clientId = process.env.GOOGLE_CLIENT_ID || '';
    if (clientId.startsWith("'") || clientId.startsWith('"')) {
      clientId = clientId.substring(1, clientId.length - 1);
    }
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    if (clientSecret.startsWith("'") || clientSecret.startsWith('"')) {
      clientSecret = clientSecret.substring(1, clientSecret.length - 1);
    }

    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/auth/google/callback`;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Exchange auth code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      throw new Error('No refresh token returned by Google OAuth. Please disconnect and try connecting again.');
    }

    oauth2Client.setCredentials(tokens);

    // Retrieve email using OAuth2 Userinfo API
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const driveEmail = userInfo.data.email || '';

    // Create a new root folder "Limkokwing Coursework" in their personal drive
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const folderRes = await drive.files.create({
      requestBody: {
        name: 'Limkokwing Coursework',
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });

    const personalFolderId = folderRes.data.id;

    if (!personalFolderId) {
      throw new Error('Failed to create personal coursework root folder on your Google Drive.');
    }

    // Initialize Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Update the profiles table with custom Drive information
    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        google_refresh_token: refreshToken,
        drive_folder_id: personalFolderId,
        email: driveEmail || undefined, // Fallback if email is somehow missing
      })
      .eq('id', userId);

    if (dbError) {
      console.error('Database update error:', dbError);
      throw new Error(`Failed to update profile: ${dbError.message}`);
    }

    // Redirect to lecturer dashboard with success parameters
    const successUrl = new URL('/dashboard/lecturer', request.url);
    successUrl.searchParams.set('drive_connected', 'true');
    return NextResponse.redirect(successUrl.toString());

  } catch (error: any) {
    console.error('OAuth Callback Error:', error);
    const errorUrl = new URL('/dashboard/lecturer', request.url);
    errorUrl.searchParams.set('drive_connected', 'false');
    errorUrl.searchParams.set('error', error.message || 'An error occurred during Google Drive authorization.');
    return NextResponse.redirect(errorUrl.toString());
  }
}
