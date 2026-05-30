import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { NextResponse } from 'next/server';

let cachedEmail: string | null = null;

export async function GET(request: Request) {
  try {
    let clientId = process.env.GOOGLE_CLIENT_ID || '';
    if (clientId.startsWith("'") || clientId.startsWith('"')) {
      clientId = clientId.substring(1, clientId.length - 1);
    }
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    if (clientSecret.startsWith("'") || clientSecret.startsWith('"')) {
      clientSecret = clientSecret.substring(1, clientSecret.length - 1);
    }

    // Default fallback credentials
    let refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';
    if (refreshToken.startsWith("'") || refreshToken.startsWith('"')) {
      refreshToken = refreshToken.substring(1, refreshToken.length - 1);
    }
    let parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
    let driveEmail: string | null = null;

    // Check for custom lecturer authorization
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (user && !userError) {
        // Authenticated user found, retrieve custom tokens
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false }
        });
        
        const { data: profile, error: profileError } = await adminSupabase
          .from('profiles')
          .select('google_refresh_token, drive_folder_id, email')
          .eq('id', user.id)
          .single();

        if (profile && profile.google_refresh_token && !profileError) {
          refreshToken = profile.google_refresh_token;
          parentFolderId = profile.drive_folder_id || '';
          driveEmail = profile.email || null;
        }
      }
    }

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Google OAuth2 credentials missing on server.');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const { token } = await oauth2Client.getAccessToken();
    if (!token) {
      throw new Error('Failed to retrieve access token from Google.');
    }

    // Retrieve email only if not cached/provided
    if (!driveEmail) {
      if (refreshToken === process.env.GOOGLE_REFRESH_TOKEN && cachedEmail) {
        driveEmail = cachedEmail;
      } else {
        try {
          const drive = google.drive({ version: 'v3', auth: oauth2Client });
          const aboutRes = await drive.about.get({
            fields: 'user(emailAddress)'
          });
          driveEmail = aboutRes.data.user?.emailAddress || null;
          if (refreshToken === process.env.GOOGLE_REFRESH_TOKEN) {
            cachedEmail = driveEmail;
          }
        } catch (err: any) {
          console.warn('Failed to retrieve authenticated user email from Google:', err.message || err);
        }
      }
    }

    return NextResponse.json({ 
      accessToken: token, 
      parentFolderId,
      driveEmail: driveEmail || 'student-portal-uploader@primal-duality-496907-a8.iam.gserviceaccount.com'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

