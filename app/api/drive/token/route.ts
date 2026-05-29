import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
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
      throw new Error('Google OAuth2 credentials missing on server.');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const { token } = await oauth2Client.getAccessToken();
    if (!token) {
      throw new Error('Failed to retrieve access token from Google.');
    }

    return NextResponse.json({ accessToken: token, parentFolderId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
