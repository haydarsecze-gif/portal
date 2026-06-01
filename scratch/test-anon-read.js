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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

async function run() {
  console.log('=== TEST ANON READ FOR MAPS ===');
  
  const { data: sc, error: scErr } = await supabase.from('student_classes').select('*');
  console.log("student_classes:", scErr ? `Error: ${scErr.message}` : `${sc?.length} rows`);

  const { data: sub, error: subErr } = await supabase.from('subjects').select('*');
  console.log("subjects:", subErr ? `Error: ${subErr.message}` : `${sub?.length} rows`);

  const { data: cls, error: clsErr } = await supabase.from('classes').select('*');
  console.log("classes:", clsErr ? `Error: ${clsErr.message}` : `${cls?.length} rows`);

  console.log('=== TEST ANON INSERT FOR NOTIFICATIONS ===');
  // Try inserting a notification addressed to the admin (0736c7ed-9ca9-45f9-81d3-8e748ea3d774)
  const { error: insErr } = await supabase.from('notifications').insert({
    user_id: '0736c7ed-9ca9-45f9-81d3-8e748ea3d774',
    title: 'Anon test notification',
    message: 'This is a test from anon client',
    type: 'system'
  });
  console.log("notification insert:", insErr ? `Error: ${insErr.message}` : 'SUCCESS');
}

run();
