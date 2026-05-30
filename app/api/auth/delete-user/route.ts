import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or malformed token' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // Create service client to bypass RLS safely on the server and use admin auth API
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

    // Parse target userId to delete
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    console.log(`Admin User ID ${user.id} requested deletion of user ID ${userId}`);

    // 1. Clean up student-related records
    try {
      await serviceClient.from('submissions').delete().eq('student_id', userId);
    } catch (dbErr) {
      console.warn('Non-fatal error cleaning up submissions:', dbErr);
    }

    try {
      await serviceClient.from('attendance').delete().eq('student_id', userId);
    } catch (dbErr) {
      console.warn('Non-fatal error cleaning up attendance:', dbErr);
    }

    try {
      await serviceClient.from('student_classes').delete().eq('student_id', userId);
    } catch (dbErr) {
      console.warn('Non-fatal error cleaning up student_classes:', dbErr);
    }

    try {
      await serviceClient.from('students').delete().eq('id', userId);
    } catch (dbErr) {
      console.warn('Non-fatal error cleaning up students table:', dbErr);
    }

    // 2. Clean up lecturer-related records (classes)
    try {
      await serviceClient
        .from('classes')
        .update({ teacher_id: null })
        .eq('teacher_id', userId);
    } catch (dbErr) {
      console.warn('Non-fatal error nullifying teacher_id in classes:', dbErr);
    }

    // 3. Clean up the public.profiles record using serviceClient to bypass RLS completely
    const { error: profileDeleteErr } = await serviceClient
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileDeleteErr) {
      console.error('Supabase Profiles row delete error:', profileDeleteErr);
      return NextResponse.json({ error: 'Failed to delete user profile from database: ' + profileDeleteErr.message }, { status: 500 });
    }

    // 4. Call serviceClient auth admin to delete the user completely from auth.users
    const { error: deleteErr } = await serviceClient.auth.admin.deleteUser(userId);

    if (deleteErr) {
      // Check if user is already deleted/not found in auth.users
      const errMsg = deleteErr.message?.toLowerCase() || '';
      if (errMsg.includes('user not found') || errMsg.includes('not found') || deleteErr.status === 404) {
        console.warn(`User ID ${userId} was already deleted or not found in auth.users. Proceeding peacefully.`);
      } else {
        console.error('Supabase Auth user delete error:', deleteErr);
        return NextResponse.json({ error: 'Failed to delete user from Supabase Auth: ' + deleteErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in delete-user API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
