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
  console.log('=== STARTING BACKFILL ===');
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error listing auth users:', error);
    return;
  }
  
  console.log(`Found ${users.length} users in Auth. Updating profiles...`);
  
  for (const u of users) {
    if (!u.email) continue;
    const email = u.email.toLowerCase().trim();
    
    // Check if profile exists first
    const { data: profile, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', u.id)
      .single();
      
    if (fetchErr || !profile) {
      console.log(`No profile found for user ID ${u.id} (${email}). Error:`, fetchErr?.message || 'Not found');
      continue;
    }
    
    console.log(`Updating Profile: ${profile.full_name} (${u.id}) -> ${email}`);
    
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ email })
      .eq('id', u.id);
      
    if (updateErr) {
      if (updateErr.message.includes("Could not find the 'email' column") || updateErr.message.includes("column \"email\" of relation \"profiles\" does not exist")) {
        console.error(`\n⚠️ ERROR: The 'email' column is missing in your 'profiles' table database schema!`);
        console.error(`Please run the following SQL command in your Supabase Dashboard SQL Editor first:\n`);
        console.error(`   ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;\n`);
        console.error(`Once you run the migration, rerun this script to complete the backfill.\n`);
        process.exit(1);
      } else {
        console.error(`Failed to update email for ${profile.full_name}:`, updateErr.message);
      }
    } else {
      console.log(`Successfully updated ${profile.full_name}.`);
    }
  }
  console.log('=== BACKFILL COMPLETE ===');
}

run();
