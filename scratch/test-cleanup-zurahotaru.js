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

const targetUserId = 'a2ef2cbb-9312-4730-80e8-1a02e2701b81';
const email = 'zurahotaru22@gmail.com';

async function run() {
  try {
    console.log(`Setting teacher_id = NULL for all classes matching teacher_id: ${targetUserId}...`);
    const { data: updateData, error: updateErr } = await supabase
      .from('classes')
      .update({ teacher_id: null })
      .eq('teacher_id', targetUserId);
      
    if (updateErr) throw updateErr;
    console.log('Successfully nullified teacher_id in classes!');
    
    console.log(`Deleting user from Auth: ${email}...`);
    const { error: delErr } = await supabase.auth.admin.deleteUser(targetUserId);
    if (delErr) {
      console.error(`Failed to delete ${email}:`, delErr.message);
    } else {
      console.log(`Successfully deleted ${email} from Supabase Auth!`);
    }
  } catch (error) {
    console.error('Error executing cleanup:', error);
  }
}

run();
