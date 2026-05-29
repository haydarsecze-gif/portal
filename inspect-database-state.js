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
  console.log('=== PROFILES ===');
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
  if (pErr) console.error(pErr);
  else console.log(profiles);

  console.log('\n=== ATTENDANCE ===');
  const { data: attendance, error: aErr } = await supabase.from('attendance').select('*');
  if (aErr) console.error(aErr);
  else console.log(attendance);
}

run();
