const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = './.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  console.log('=== CLASSES ===');
  const { data: classes, error: cErr } = await supabase.from('classes').select('*').limit(5);
  if (cErr) console.error(cErr);
  else console.log(classes);

  console.log('=== STUDENTS ===');
  const { data: students, error: sErr } = await supabase.from('students').select('*').limit(5);
  if (sErr) console.error(sErr);
  else console.log(students);

  console.log('=== PROFILES ===');
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').limit(5);
  if (pErr) console.error(pErr);
  else console.log(profiles);
}

run();
