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

// Use anon client
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

async function run() {
  console.log('=== ATTEMPTING TO INSERT NOTIFICATION WITH ANON KEY ===');
  const studentId = '66460f4e-56b8-4ca2-862c-f850804ff5db';
  const payload = {
    user_id: studentId,
    title: "Test Notification",
    message: "This is a test notification from anon key.",
    type: "system"
  };

  const { data, error } = await supabase.from('notifications').insert([payload]).select();
  if (error) {
    console.error("Insert Error:", error);
  } else {
    console.log("Insert Success:", data);
  }
}

run();
