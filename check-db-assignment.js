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
  console.log('Fetching assignment DSAAS from database...');
  const { data: assignments, error } = await supabase.from('assignments').select('id, title, folder_id, file_url');
  if (error) {
    console.error(error);
  } else {
    console.log('Assignments in database:');
    assignments.forEach(a => {
      console.log(`- Title: "${a.title}"`);
      console.log(`  Folder ID: "${a.folder_id}"`);
      console.log(`  File URL: "${a.file_url}"`);
    });
  }
}

run();
