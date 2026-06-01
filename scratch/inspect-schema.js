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
  const subjectId = '81c36a3d-b5b8-479d-881e-a4bb53c30ee2';
  console.log("Attempting to delete subject with ID:", subjectId);
  const { error } = await supabase.from('subjects').delete().eq('id', subjectId);
  if (error) {
    console.error("Postgres Error Code:", error.code);
    console.error("Postgres Error Message:", error.message);
    console.error("Postgres Error Detail:", error.details);
  } else {
    console.log("Delete succeeded without errors!");
  }
}

run();
