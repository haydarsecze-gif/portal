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

// Use anon/publishable client
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

async function run() {
  console.log('=== TRYING TO READ PROFILES WITH ANON KEY ===');
  const { data: profs, error: profErr } = await supabase.from('profiles').select('id, role').limit(5);
  if (profErr) {
    console.error("Profs Error:", profErr);
  } else {
    console.log("Profs:", profs);
  }

  console.log('=== TRYING TO READ NOTIFICATIONS WITH ANON KEY ===');
  const { data: notifs, error: notifErr } = await supabase.from('notifications').select('*').limit(5);
  if (notifErr) {
    console.error("Notifs Error:", notifErr);
  } else {
    console.log("Notifs:", notifs);
  }
}

run();
