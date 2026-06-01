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
  console.log('=== STEP 1: RESET PASSWORD ===');
  const studentId = '66460f4e-56b8-4ca2-862c-f850804ff5db';
  const { data: user, error: updateErr } = await supabase.auth.admin.updateUserById(studentId, {
    password: 'password123'
  });
  
  if (updateErr) {
    console.error("Failed to update password:", updateErr);
    return;
  }
  console.log("Password updated successfully for:", user.user.email);

  console.log('=== STEP 2: LOG IN AS STUDENT ===');
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: 'theweirdone719@gmail.com',
    password: 'password123'
  });

  if (authErr) {
    console.error("Sign in failed:", authErr);
    return;
  }
  console.log("Logged in successfully as student:", authData.user.email);

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

  console.log('=== STEP 3: READ SUBJECTS AS STUDENT ===');
  const { data: subjects, error: sErr } = await studentClient.from('subjects').select('*');
  if (sErr) {
    console.error("Failed to read subjects:", sErr);
  } else {
    console.log("Subjects read as student:", subjects);
  }
}

run();
