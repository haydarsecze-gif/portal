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
  console.log('=== RLS POLICIES FOR NOTIFICATIONS ===');
  const { data, error } = await supabase.from('notifications').select('*').limit(1);
  if (error) {
    console.error("Error reading notifications:", error);
  } else {
    console.log("Able to read notifications. Row count or sample:", data);
  }

  // Let's get the policies list for notifications table
  try {
    const { data: policies, error: polError } = await supabase.rpc('execute_sql_query', {
      sql: "SELECT * FROM pg_policies WHERE tablename = 'notifications';"
    });
    if (polError) throw polError;
    console.log("Policies:", policies);
  } catch (err) {
    console.warn("Could not fetch pg_policies directly. Let's dump pg_policies:");
    console.error(err);
  }
}

run();
