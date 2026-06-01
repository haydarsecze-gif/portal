const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('./.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.substring(1, value.length - 1);
    env[match[1]] = value;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  console.log('=== VERIFYING UPDATE LOGIC FOR LECTURER MATCHING ===');

  // Test subject details
  const subjectTrueUUID = '3a62bccc-778b-4b58-a18d-eb0dce12335e'; // UUID of subject '213412'

  console.log('Fetching subject...');
  const { data: subject } = await supabase
    .from('subjects')
    .select('name, lecturer_names')
    .eq('id', subjectTrueUUID)
    .maybeSingle();

  console.log('Subject lecturer_names in DB:', subject.lecturer_names);

  if (subject && subject.lecturer_names) {
    const plainNames = subject.lecturer_names.filter(n => !n.startsWith('email:') && !n.startsWith('phone:'));
    const emails = subject.lecturer_names.filter(n => n.startsWith('email:')).map(n => n.substring(6).trim());

    console.log("Parsed plain names:", plainNames);
    console.log("Parsed emails:", emails);

    let orFilter = '';
    if (plainNames.length > 0) {
      orFilter += `full_name.in.(${plainNames.map(n => `"${n}"`).join(',')})`;
    }
    if (emails.length > 0) {
      if (orFilter) orFilter += ',';
      orFilter += `email.in.(${emails.map(e => `"${e}"`).join(',')})`;
    }

    console.log("Constructed OR filter:", orFilter);

    if (orFilter) {
      const { data: matchedLecturers, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'teacher')
        .or(orFilter);

      if (error) {
        console.error("Match Error:", error);
      } else {
        console.log("Matched lecturers from query:", matchedLecturers);
      }
    } else {
      console.log("OrFilter is empty. No query executed.");
    }
  }
}

run();
