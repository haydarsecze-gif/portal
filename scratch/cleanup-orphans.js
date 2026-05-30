const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse environment variables safely
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
  try {
    console.log('Fetching all users from Supabase Auth...');
    
    let allUsers = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000
      });
      
      if (error) throw error;
      
      if (!data || !data.users || data.users.length === 0) {
        hasMore = false;
        break;
      }
      
      allUsers = allUsers.concat(data.users);
      if (data.users.length < 1000) {
        hasMore = false;
      } else {
        page++;
      }
    }
    
    console.log(`Found ${allUsers.length} total users in Auth.`);
    
    console.log('Fetching all profiles from public.profiles...');
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, email, role');
      
    if (pErr) throw pErr;
    
    const profileIds = new Set(profiles.map(p => p.id));
    console.log(`Found ${profiles.length} profiles in public.profiles.`);
    
    const orphanedUsers = allUsers.filter(u => !profileIds.has(u.id));
    console.log(`Found ${orphanedUsers.length} orphaned users in Auth.`);
    
    for (const orphan of orphanedUsers) {
      // Avoid deleting the admin user if they don't have a profile (just in case)
      console.log(`Orphan: ID: ${orphan.id}, Email: ${orphan.email}, CreatedAt: ${orphan.created_at}`);
      console.log(`Deleting orphaned user from Auth: ${orphan.email}...`);
      const { error: delErr } = await supabase.auth.admin.deleteUser(orphan.id);
      if (delErr) {
        console.error(`Failed to delete ${orphan.email}:`, delErr.message);
      } else {
        console.log(`Successfully deleted ${orphan.email}!`);
      }
    }
    
    console.log('Cleanup completed successfully!');
  } catch (error) {
    console.error('Error executing cleanup:', error);
  }
}

run();
