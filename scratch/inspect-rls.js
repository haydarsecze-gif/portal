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
  console.log('=== RLS POLICIES FOR SUBJECTS ===');
  const { data, error } = await supabase.rpc('execute_sql_query', { 
    sql: "SELECT * FROM pg_policies WHERE tablename = 'subjects';" 
  });
  
  if (error) {
    // If execute_sql_query RPC doesn't exist, we can fetch via direct query if possible, or try a different way.
    console.warn("RPC call failed or execute_sql_query not found. Attempting direct query...");
    // Let's try executing via a generic HTTP request or SQL editor script
    console.error(error);
  } else {
    console.log(data);
  }
}

run();
