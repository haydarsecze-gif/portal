const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('./.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
    env[match[1]] = value;
  }
});

const studentEmail = 'theweirdone719@gmail.com';
const studentId = '66460f4e-56b8-4ca2-862c-f850804ff5db';
const subjectTrueUUID = '8fba884a-9b2f-4dc9-bf1c-14e528321f8b'; // Test Pro

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

async function safeInsertNotificationsSimulated(client, payloads) {
  const normalized = Array.isArray(payloads) ? payloads : [payloads];
  
  // Attempt 1: Full insert with 'link'
  const { data, error } = await client
    .from('notifications')
    .insert(normalized);

  if (error) {
    const isMissingLink = error.code === '42703' || 
      (error.message && error.message.toLowerCase().includes("'link'") && error.message.toLowerCase().includes("column"));

    if (isMissingLink) {
      console.warn("Simulated warning: Link column missing, falling back to stripping link...");
      const strippedPayloads = normalized.map(({ link, ...rest }) => rest);
      return await client
        .from('notifications')
        .insert(strippedPayloads);
    }
  }
  return { data, error };
}

async function run() {
  console.log('=== LOGGING IN AS STUDENT ===');
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: studentEmail,
    password: 'password123'
  });

  if (authErr) {
    console.error("Sign in failed:", authErr);
    return;
  }

  const studentClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${authData.session.access_token}`
      }
    }
  });

  console.log('=== SIMULATING UPLOAD CONTEXT NOTIFICATION LOGIC WITH SAFE FALLBACK ===');
  try {
    const { data: subjectDetails, error: sErr } = await studentClient
      .from('subjects')
      .select('lecturer_names')
      .eq('id', subjectTrueUUID)
      .maybeSingle();

    if (sErr) throw sErr;

    let lecturers = [];
    if (subjectDetails?.lecturer_names && subjectDetails.lecturer_names.length > 0) {
      const plainNames = subjectDetails.lecturer_names.filter(n => !n.startsWith('email:') && !n.startsWith('phone:'));
      const emails = subjectDetails.lecturer_names.filter(n => n.startsWith('email:')).map(n => n.substring(6).trim());

      let orFilter = '';
      if (plainNames.length > 0) {
        orFilter += `full_name.in.(${plainNames.map(n => `"${n}"`).join(',')})`;
      }
      if (emails.length > 0) {
        if (orFilter) orFilter += ',';
        orFilter += `email.in.(${emails.map(e => `"${e}"`).join(',')})`;
      }

      if (orFilter) {
        const { data: matchedLecs, error: mErr } = await studentClient
          .from('profiles')
          .select('id')
          .eq('role', 'teacher')
          .or(orFilter);
        
        if (mErr) throw mErr;
        lecturers = matchedLecs || [];
      }
    }

    if (lecturers.length === 0) {
      const { data: allTeachers, error: fErr } = await studentClient
        .from('profiles')
        .select('id')
        .eq('role', 'teacher')
        .eq('is_approved', true);
      
      if (fErr) throw fErr;
      lecturers = allTeachers || [];
    }

    if (lecturers.length > 0) {
      const notificationsToInsert = lecturers.map(lec => ({
        user_id: lec.id,
        title: "New Assignment Submission",
        message: "sam submitted the assignment 'Test Assignment' (on time).",
        type: "submission",
        link: `/dashboard/lecturer/${subjectTrueUUID}?select=Test Assignment`
      }));

      const { data, error: insErr } = await safeInsertNotificationsSimulated(studentClient, notificationsToInsert);

      if (insErr) {
        console.error("Insert failed:", insErr);
      } else {
        console.log("Insert succeeded!");
      }
    }
  } catch (err) {
    console.error("Failed during simulation:", err);
  }
}

run();
