const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = './.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  console.log('=== AUTH USERS ===');
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error(error);
    return;
  }
  
  // Also fetch profiles to match names and roles
  const { data: profiles } = await supabase.from('profiles').select('*');
  
  users.forEach(u => {
    const profile = profiles.find(p => p.id === u.id);
    console.log({
      id: u.id,
      email: u.email,
      fullName: profile ? profile.full_name : 'No profile name',
      role: profile ? profile.role : 'No profile role',
      isApproved: profile ? profile.is_approved : false
    });
  });
}

run();
