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

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

async function run() {
  console.log('=== STEP 1: LOG IN AS STUDENT ===');
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: 'theweirdone719@gmail.com',
    password: 'password123'
  });

  if (authErr) {
    console.error("Sign in failed:", authErr);
    return;
  }

  const studentClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${authData.session.access_token}`
      }
    }
  });

  console.log('=== STEP 2: TRY SELECTING LECTURER PROFILES AS STUDENT ===');
  const { data, error } = await studentClient
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('role', 'teacher');

  if (error) {
    console.error("Error reading profiles:", error);
  } else {
    console.log("Success reading profiles:", data);
  }
}

run();
