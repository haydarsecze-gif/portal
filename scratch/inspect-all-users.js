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
  console.log('=== ALL USER PROFILES ===');
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
  if (pErr) console.error("Profiles error:", pErr);
  else console.log(profiles);

  console.log('=== ALL STUDENTS ===');
  const { data: students, error: sErr } = await supabase.from('students').select('*');
  if (sErr) console.error("Students error:", sErr);
  else console.log(students);

  console.log('=== ALL SUBJECTS ===');
  const { data: subjects, error: subErr } = await supabase.from('subjects').select('*');
  if (subErr) console.error("Subjects error:", subErr);
  else console.log(subjects);
}

run();
