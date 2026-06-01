import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Unauthorized: ' + authErr?.message }, { status: 401 });
    }

    // Fetch the user's profile using serviceClient to bypass all RLS limits on profiles
    const { data: profile, error: profErr } = await serviceClient
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (profErr || !profile) {
      console.error('Profile fetch error:', profErr);
      return NextResponse.json({ error: 'Forbidden: Profile not found' }, { status: 403 });
    }

    console.log(`Settings API Auth: User ID: ${user.id}, Full Name: ${profile.full_name}, Role: ${profile.role}`);

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

export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // Create service client to bypass RLS safely on the server
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Get the user securely on the server
    const { data: { user }, error: authErr } = await serviceClient.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized: ' + authErr?.message }, { status: 401 });
    }

    // Fetch the user's profile
    const { data: profile, error: profErr } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profErr || !profile) {
      return NextResponse.json({ error: 'Forbidden: Profile not found' }, { status: 403 });
    }

    if (profile.role !== 'teacher' && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subjectId');

    if (!subjectId) {
      return NextResponse.json({ error: 'Missing subject ID' }, { status: 400 });
    }

    // 1. Delete dependent tables in parallel to minimize network latency round-trips
    const [subRes, assignRes, matRes, attRes, scRes] = await Promise.all([
      serviceClient.from('submissions').delete().eq('class_id', subjectId),
      serviceClient.from('assignments').delete().eq('class_id', subjectId),
      serviceClient.from('materials').delete().eq('class_id', subjectId),
      serviceClient.from('attendance').delete().eq('class_id', subjectId),
      serviceClient.from('student_classes').delete().eq('subject_id', subjectId)
    ]);

    if (subRes.error) throw subRes.error;
    if (assignRes.error) throw assignRes.error;
    if (matRes.error) throw matRes.error;
    if (attRes.error) throw attRes.error;
    if (scRes.error) throw scRes.error;

    // 2. Delete classes row
    const { error: clsErr } = await serviceClient.from('classes').delete().eq('id', subjectId);
    if (clsErr) throw clsErr;

    // 3. Delete the subject itself
    const { error: subjErr } = await serviceClient.from('subjects').delete().eq('id', subjectId);
    if (subjErr) throw subjErr;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting subject in API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
