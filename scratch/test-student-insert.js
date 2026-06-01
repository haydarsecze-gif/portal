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
  const studentEmail = 'theweirdone719@gmail.com';

  console.log('=== STEP 2: LOG IN AS STUDENT ===');
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: studentEmail,
    password: 'password123'
  });

  if (authErr) {
    console.error("Sign in failed:", authErr);
    return;
  }
  console.log("Logged in successfully as:", authData.user.email);

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

  console.log('=== STEP 3: ATTEMPT INSERTING NOTIFICATION AS STUDENT WITHOUT SELECT ===');
  const payload = {
    user_id: '7ae69c73-bf15-4137-8956-9b6d7cb311e3', // Sora (teacher)
    title: "Test Student Submission",
    message: "sam submitted the assignment 'fweqfewqf'.",
    type: "submission"
  };

  const { data: insData, error: insErr } = await studentClient
    .from('notifications')
    .insert([payload]); // No select()!

  if (insErr) {
    console.error("Insert Error:", insErr);
  } else {
    console.log("Insert Success! Row was successfully created in the background.");
  }
}

run();
