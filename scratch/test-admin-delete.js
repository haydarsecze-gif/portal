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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

async function run() {
  // 1. Sign in as admin
  console.log("Signing in as godchan22@gmail.com...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'godchan22@gmail.com',
    password: 'password123'
  });

  if (authError) {
    console.error("Auth Error:", authError);
    return;
  }
  console.log("Authenticated User ID:", authData.user.id);

  // 2. Fetch a subject
  const { data: subjects } = await supabase.from('subjects').select('*');
  console.log("Active subjects in database:", subjects);
  if (!subjects || subjects.length === 0) {
    console.log("No subjects to delete.");
    return;
  }

  const targetSubject = subjects[0];
  console.log("Attempting to delete subject:", targetSubject.name, "(ID:", targetSubject.id, ")");

  // 3. Delete subject
  const { error: deleteError } = await supabase.from('subjects').delete().eq('id', targetSubject.id);
  if (deleteError) {
    console.error("Delete Error:", deleteError);
  } else {
    console.log("Delete succeeded! Checking if it was actually removed...");
    const { data: check } = await supabase.from('subjects').select('*').eq('id', targetSubject.id).maybeSingle();
    if (check) {
      console.log("Warning: Subject still exists in DB! (Silently failed)");
    } else {
      console.log("Subject was successfully removed from DB.");
    }
  }
}

run();
