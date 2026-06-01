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
  console.log('=== ALL CLASSES ===');
  const { data: classes, error: cErr } = await supabase.from('classes').select('*');
  if (cErr) console.error("Classes error:", cErr);
  else console.log(classes);

  console.log('=== ALL STUDENT_CLASSES ===');
  const { data: sc, error: scErr } = await supabase.from('student_classes').select('*');
  if (scErr) console.error("Student-Classes error:", scErr);
  else console.log(sc);

  console.log('=== ALL ATTENDANCE ===');
  const { data: attendance, error: attErr } = await supabase.from('attendance').select('*');
  if (attErr) console.error("Attendance error:", attErr);
  else console.log(attendance);
}

run();
