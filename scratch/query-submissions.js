const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectSubmissions() {
  const { data: subs, error } = await supabase.from('submissions').select('*').limit(20);
  console.log("Submissions error:", error);
  console.log("Submissions count:", subs ? subs.length : 0);
  console.log("Submissions content:", JSON.stringify(subs, null, 2));

  const { data: ass, error2 } = await supabase.from('assignments').select('*').limit(20);
  console.log("Assignments content:", JSON.stringify(ass, null, 2));
}

inspectSubmissions();
