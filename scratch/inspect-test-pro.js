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
  console.log('=== SEARCHING FOR TEST PRO SUBJECT ===');
  const { data: subjects, error } = await supabase.from('subjects').select('*');
  if (error) {
    console.error(error);
    return;
  }
  console.log("Subjects:", subjects);

  for (const sub of subjects) {
    console.log(`\nResolving lecturers for subject "${sub.name}" (ID: ${sub.id}):`);
    if (sub.lecturer_names && sub.lecturer_names.length > 0) {
      const plainNames = sub.lecturer_names.filter(n => !n.startsWith('email:') && !n.startsWith('phone:'));
      const emails = sub.lecturer_names.filter(n => n.startsWith('email:')).map(n => n.substring(6).trim());

      console.log("- Plain Names in array:", plainNames);
      console.log("- Emails in array:", emails);

      let orFilter = '';
      if (plainNames.length > 0) {
        orFilter += `full_name.in.(${plainNames.map(n => `"${n}"`).join(',')})`;
      }
      if (emails.length > 0) {
        if (orFilter) orFilter += ',';
        orFilter += `email.in.(${emails.map(e => `"${e}"`).join(',')})`;
      }

      console.log("- Constructed OR filter:", orFilter);

      if (orFilter) {
        const { data: matchedLecs, error: mErr } = await supabase
          .from('profiles')
          .select('id, full_name, email, role, is_approved')
          .eq('role', 'teacher')
          .or(orFilter);
        if (mErr) {
          console.error("Match error:", mErr);
        } else {
          console.log("- Matched lecturers:", matchedLecs);
        }
      }
    }
  }
}

run();
