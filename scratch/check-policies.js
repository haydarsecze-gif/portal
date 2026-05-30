const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
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

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env variables in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkPolicies() {
  // Let's run a query to get pg_policies via a simple select if we have RPC or directly run sql if allowed
  const { data, error } = await supabase.rpc('admin_run_query', {
    query_text: "SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public';"
  });
  if (error) {
    console.error("Query failed:", error);
    // Let's inspect tables
    const { data: tables, error: tableErr } = await supabase.from('profiles').select('*').limit(1);
    console.log("Profiles test:", { tables, tableErr });
  } else {
    console.log("Policies:\n", JSON.stringify(data, null, 2));
  }
}

checkPolicies();
