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
  console.log('=== STEP 1: RESET LECTURER PASSWORD ===');
  const lecturerId = '7ae69c73-bf15-4137-8956-9b6d7cb311e3'; // Sora (teacher)
  await supabase.auth.admin.updateUserById(lecturerId, { password: 'password123' });
  console.log("Lecturer password set to password123");

  console.log('=== STEP 2: LOG IN AS LECTURER ===');
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: 'zurahotaru22@gmail.com',
    password: 'password123'
  });

  if (authErr) {
    console.error("Sign in failed:", authErr);
    return;
  }
  console.log("Logged in successfully as lecturer:", authData.user.email);

  const lecturerClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
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

  console.log('=== STEP 3: READ STUDENT_CLASSES AS LECTURER ===');
  const { data: sc, error: scErr } = await lecturerClient.from('student_classes').select('*');
  if (scErr) console.error("Failed to read student_classes:", scErr);
  else console.log("student_classes rows:", sc.length);

  console.log('=== STEP 4: READ SUBJECTS AS LECTURER ===');
  const { data: sub, error: subErr } = await lecturerClient.from('subjects').select('*');
  if (subErr) console.error("Failed to read subjects:", subErr);
  else console.log("subjects rows:", sub.length);

  console.log('=== STEP 5: INSERT NOTIFICATION FOR STUDENT AS LECTURER ===');
  const { error: insErr } = await lecturerClient.from('notifications').insert({
    user_id: '66460f4e-56b8-4ca2-862c-f850804ff5db', // sam (student)
    title: 'New Assignment Added',
    message: 'Sora added a new assignment: "Test Assignment"',
    type: 'assignment'
  });
  console.log("Insert result:", insErr ? `Error: ${insErr.message}` : 'SUCCESS');
}

run();
