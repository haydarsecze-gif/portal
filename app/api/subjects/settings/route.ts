import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // Create a user client with the user's token to verify their identity and role
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false }
      }
    );

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized: ' + authErr?.message }, { status: 401 });
    }

    // Fetch the user's profile to verify they are teacher/admin
    const { data: profile, error: profErr } = await userClient
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (profErr || !profile) {
      return NextResponse.json({ error: 'Forbidden: Profile not found' }, { status: 403 });
    }

    if (profile.role !== 'teacher' && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const {
      subjectId,
      subjectName,
      semester,
      startDate,
      startTime,
      endTime,
      room,
      lecturerName,
      lecturerEmail,
      lecturerPhone
    } = body;

    if (!subjectId) {
      return NextResponse.json({ error: 'Missing subject ID' }, { status: 400 });
    }

    // Construct lecturer names array containing serialized contact details.
    // If lecturerEmail or lecturerPhone is empty, we must NOT store them as "email:" or "phone:".
    const lecturerNamesArray = [
      lecturerName?.trim(),
      lecturerEmail?.trim() ? `email:${lecturerEmail.trim()}` : null,
      lecturerPhone?.trim() ? `phone:${lecturerPhone.trim()}` : null
    ].filter(Boolean);

    // Create service client to bypass RLS safely on the server
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 1. Update classes table
    const { error: classErr } = await serviceClient
      .from('classes')
      .update({
        name: subjectName,
        subject_name: subjectName,
        semester: semester,
        class_date: startDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        lecture_name: lecturerName?.trim(),
        room: room
      })
      .eq('id', subjectId);

    if (classErr) throw classErr;

    // 2. Update subjects table
    const { error: subjectErr } = await serviceClient
      .from('subjects')
      .update({
        name: subjectName,
        semester: semester,
        start_date: startDate || null,
        class_start_time: startTime || null,
        class_end_time: endTime || null,
        lecturer_names: lecturerNamesArray,
        room: room
      })
      .eq('id', subjectId);

    if (subjectErr) throw subjectErr;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in settings API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
