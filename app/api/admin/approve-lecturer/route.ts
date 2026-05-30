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

    // Parse target userId and approval status
    const body = await req.json();
    const { userId, approved } = body;

    if (!userId || approved === undefined) {
      return NextResponse.json({ error: 'Missing userId or approved parameter' }, { status: 400 });
    }

    console.log(`Admin User ID ${user.id} requested approval status ${approved} for lecturer ID ${userId}`);

    // Update targeted lecturer's is_approved and status fields
    const { error: updateErr } = await serviceClient
      .from('profiles')
      .update({ 
        is_approved: approved,
        status: approved ? 'active' : 'pending'
      })
      .eq('id', userId);

    if (updateErr) {
      console.error('Supabase Profiles update error:', updateErr);
      return NextResponse.json({ error: 'Failed to update lecturer status: ' + updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in approve-lecturer API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
