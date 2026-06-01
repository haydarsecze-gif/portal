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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  const subjectTrueUUID = '3a62bccc-778b-4b58-a18d-eb0dce12335e'; // UUID of subject '213412'

  console.log('=== STEP 1: FETCH SUBJECT DETAILS ===');
  const { data: subjectDetails, error: sErr } = await supabase
    .from('subjects')
    .select('name, lecturer_names')
    .eq('id', subjectTrueUUID)
    .maybeSingle();

  if (sErr) {
    console.error("Subject error:", sErr);
    return;
  }
  console.log("Subject details:", subjectDetails);

  if (subjectDetails && subjectDetails.lecturer_names) {
    console.log('=== STEP 2: FETCH MATCHED LECTURERS ===');
    const { data: matchedLecs, error: mErr } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_approved')
      .eq('role', 'teacher')
      .in('full_name', subjectDetails.lecturer_names);

    if (mErr) {
      console.error("Profiles error:", mErr);
      return;
    }
    console.log("Matched lecturers:", matchedLecs);
  }
}

run();
