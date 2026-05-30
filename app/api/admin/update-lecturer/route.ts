import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or malformed token' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // Create service client to bypass RLS safely on the server
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Get the user from the auth token securely on the server
    const { data: { user }, error: authErr } = await serviceClient.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized: ' + (authErr?.message || 'Invalid token') }, { status: 401 });
    }

    // Fetch the user's profile using serviceClient to check if they are an admin
    const { data: profile, error: profErr } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profErr || !profile) {
      console.error('Profile fetch error:', profErr);
      return NextResponse.json({ error: 'Forbidden: Requester profile not found' }, { status: 403 });
    }

    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    // Parse target userId and update payload
    const body = await req.json();
    const { userId, fullName, email, driveFolderId } = body;

    if (!userId || !fullName || !email) {
      return NextResponse.json({ error: 'Missing target userId, fullName, or email' }, { status: 400 });
    }

    console.log(`Admin User ID ${user.id} requested update for lecturer ID ${userId}`);

    // 1. Fetch targeted lecturer profile
    const { data: targetProfile, error: targetProfErr } = await serviceClient
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (targetProfErr || !targetProfile) {
      return NextResponse.json({ error: 'Target profile not found' }, { status: 404 });
    }

    // 2. If email is different, update the user in auth.users
    const normalizedEmail = email.trim().toLowerCase();
    const currentEmail = targetProfile.email?.trim().toLowerCase();

    if (normalizedEmail !== currentEmail) {
      console.log(`Updating Auth Email for user ${userId} from ${currentEmail} to ${normalizedEmail}`);
      const { error: authUpdateErr } = await serviceClient.auth.admin.updateUserById(userId, {
        email: normalizedEmail,
        email_confirm: true // bypass confirmation
      });

      if (authUpdateErr) {
        console.error('Supabase Auth email update error:', authUpdateErr);
        return NextResponse.json({ error: 'Failed to update user email in Auth database: ' + authUpdateErr.message }, { status: 500 });
      }
    }

    // 3. Update profiles table
    const { error: profileUpdateErr } = await serviceClient
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        email: normalizedEmail,
        drive_folder_id: driveFolderId?.trim() || null
      })
      .eq('id', userId);

    if (profileUpdateErr) {
      console.error('Supabase Profiles update error:', profileUpdateErr);
      return NextResponse.json({ error: 'Failed to update lecturer profile: ' + profileUpdateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in update-lecturer API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
